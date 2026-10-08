"""Analytical expectations and adversarial SYN cases; no model training or IO."""

from dataclasses import FrozenInstanceError, replace
import json
import math
import unittest

from .fixtures import cohort, prediction
from .guards import (
    FitReader, Reference, SafetyError, assert_references_unchanged,
    attach_predictions, fit_preprocessor, grouped_split, reference_digest, validate_rows,
)


class GuardsTest(unittest.TestCase):
    def setUp(self):
        self.rows = cohort()
        self.counts = {"development": 2, "validation": 1, "final_test": 2}

    def changed(self, index, **fields):
        return self.rows[:index] + (replace(self.rows[index], **fields),) + self.rows[index + 1:]

    def rejects(self, code, operation):
        with self.assertRaises(SafetyError) as error:
            operation()
        self.assertEqual(error.exception.code, code)

    def fitted(self, rows=None, **kwargs):
        return fit_preprocessor(self.rows if rows is None else rows,
                                min_available_fraction=0.5, **kwargs)

    def split(self, rows=None, seed=42, **kwargs):
        return grouped_split(self.rows if rows is None else rows,
                             seed=seed, counts=self.counts, **kwargs)

    def test_valid_disjoint_participants(self):
        self.assertEqual(validate_rows(self.rows), (
            ("SYN-P1", "development"), ("SYN-P2", "development"),
            ("SYN-P3", "validation"), ("SYN-P4", "final_test"), ("SYN-P5", "final_test")))

    def test_development_to_final_test_participant_overlap(self):
        self.rejects("PARTICIPANT_OVERLAP", lambda: validate_rows(self.changed(1, role="final_test")))

    def test_validation_to_final_test_participant_overlap(self):
        new = replace(self.rows[3], row_id="SYN-R7", role="final_test")
        self.rejects("PARTICIPANT_OVERLAP", lambda: validate_rows(self.rows + (new,)))

    def test_multiple_trials_same_person_one_role(self):
        self.assertNotEqual(self.rows[0].trial_id, self.rows[1].trial_id)
        self.assertEqual(validate_rows(self.rows[:2]), (("SYN-P1", "development"),))

    def test_multiple_sessions_same_person_final_test(self):
        new = replace(self.rows[4], row_id="SYN-R7", session_id="SYN-S7", trial_id="SYN-T7",
                      attempt_id="SYN-A7", media_id="SYN-M7", canonical_source_id="SYN-C7")
        self.assertEqual(validate_rows((self.rows[4], new)), (("SYN-P4", "final_test"),))

    def test_duplicate_media_development_to_test(self):
        self.rejects("MEDIA_OVERLAP", lambda: validate_rows(self.changed(4, media_id="SYN-M1")))

    def test_canonical_alias_development_to_test(self):
        self.rejects("SOURCE_OVERLAP", lambda: validate_rows(
            self.changed(4, canonical_source_id="SYN-C1")))

    def test_alias_within_owner_is_permitted(self):
        validate_rows(self.changed(1, canonical_source_id="SYN-C1"))

    def test_missing_participant_identity(self):
        for value in (None, "", " ", []):
            with self.subTest(value=value):
                self.rejects("PARTICIPANT_ID", lambda: self.split(self.changed(0, participant_id=value)))

    def test_unknown_identity_no_filename_fallback(self):
        for value in ("unknown", "UNKNOWN", "P001", "person-from-filename.mp4"):
            with self.subTest(value=value):
                self.rejects("PARTICIPANT_ID", lambda: validate_rows(self.changed(0, participant_id=value)))

    def test_required_lineage_ids(self):
        for field in ("row_id", "session_id", "trial_id", "attempt_id", "media_id", "canonical_source_id"):
            with self.subTest(field=field):
                self.rejects("IDENTITY", lambda: validate_rows(self.changed(0, **{field: None})))

    def test_hierarchical_ownership(self):
        for field, value, code in (("session_id", "SYN-S1", "SESSION_OWNERSHIP"),
                                   ("trial_id", "SYN-T1", "TRIAL_OWNERSHIP"),
                                   ("attempt_id", "SYN-A1", "ATTEMPT_OWNERSHIP")):
            with self.subTest(field=field):
                self.rejects(code, lambda: validate_rows(self.changed(2, **{field: value})))

    def test_synthetic_only_boundary(self):
        self.rejects("SYNTHETIC_ONLY", lambda: validate_rows(self.changed(0, evidence_kind="real")))
        self.rejects("SYNTHETIC_ONLY", lambda: validate_rows(self.changed(0, scientific_status="VALIDATED")))

    def test_duplicate_row(self):
        self.rejects("DUPLICATE_ROW", lambda: validate_rows(self.rows + (self.rows[0],)))

    def test_fixed_feature_schema_and_finite_values(self):
        self.rejects("FEATURE_SCHEMA", lambda: validate_rows(self.changed(0, features=(("f0", 2),))))
        for value in (float("nan"), float("inf"), True, "2"):
            with self.subTest(value=value):
                self.rejects("FEATURE_VALUE", lambda: validate_rows(self.changed(0, features=(("f0", value),))))

    def test_same_seed_deterministic(self):
        self.assertEqual(self.split(), self.split())
        rows, plan = self.split()
        self.assertEqual(tuple(sum(role == expected for _, role in plan.assignments)
                               for expected in ("development", "validation", "final_test")), (2, 1, 2))
        self.assertEqual(len(rows), 6)
        self.assertEqual(dict(plan.assignments), dict(validate_rows(rows)))

    def test_reordered_rows_stable(self):
        self.assertEqual(self.split(), self.split(tuple(reversed(self.rows))))

    def test_different_seed_can_change_development_keep_final_fixed(self):
        first_rows, first = self.split(seed=1, fixed_final_test=("SYN-P4", "SYN-P5"))
        second_rows, second = self.split(seed=2, fixed_final_test=("SYN-P5", "SYN-P4"))
        self.assertNotEqual(first.assignments, second.assignments)
        for plan in (first, second):
            self.assertEqual(tuple(pid for pid, role in plan.assignments if role == "final_test"),
                             ("SYN-P4", "SYN-P5"))
        validate_rows(first_rows)
        validate_rows(second_rows)

    def test_serialization_explicit_one_person_oracle(self):
        # Allocation is analytically forced by these counts; no implementation-derived oracle.
        _, plan = grouped_split(self.rows[:2], seed=7,
                                counts={"development": 1, "validation": 0, "final_test": 0})
        expected = {"assignments": [["SYN-P1", "development"]],
                    "counts": [["development", 1], ["validation", 0], ["final_test", 0]],
                    "evidence_kind": "synthetic", "fixed_final_test": [],
                    "schema": "benchmark-safety-synthetic-1", "scientific_status": "NOT_EVALUATED",
                    "seed": 7, "input_identity_digest": plan.input_identity_digest}
        self.assertEqual(plan.serialize(), json.dumps(expected, sort_keys=True, separators=(",", ":")))
        self.assertEqual(len(plan.input_identity_digest), 64)
        self.assertEqual(plan.serialize(), grouped_split(tuple(reversed(self.rows[:2])), seed=7,
                         counts={"development": 1, "validation": 0, "final_test": 0})[1].serialize())

    def test_invalid_split_policy(self):
        self.rejects("SEED", lambda: self.split(seed=True))
        self.rejects("COUNTS", lambda: grouped_split(self.rows, seed=1, counts={"development": 5}))
        self.rejects("FIXED_TEST", lambda: self.split(fixed_final_test=("SYN-P4", None)))
        self.rejects("FIXED_TEST", lambda: self.split(fixed_final_test=("SYN-P4", "SYN-P4")))

    def test_training_only_imputer_analytical_median(self):
        fitted = self.fitted()
        self.assertEqual(fitted.selected, ("f0", "f2"))
        self.assertEqual(fitted.medians, (4, 4))
        self.assertEqual(tuple(read.row_id for read in fitted.fit_reads if read.stage == "imputer"),
                         ("SYN-R1", "SYN-R2", "SYN-R3"))

    def test_training_only_scaler_analytical_mean_variance(self):
        fitted = self.fitted()
        self.assertEqual(fitted.means, (4, 4))
        self.assertAlmostEqual(fitted.scales[0], math.sqrt(8 / 3))
        self.assertEqual(fitted.scales[1], 1)
        self.assertEqual(tuple(read.row_id for read in fitted.fit_reads if read.stage == "scaler"),
                         ("SYN-R1", "SYN-R2", "SYN-R3"))

    def test_all_three_actual_fit_traces_exclude_heldout(self):
        trace = self.fitted().fit_reads
        self.assertEqual(len(trace), 9)
        for stage, names in (("selector", ("f0", "f1", "f2")),
                             ("imputer", ("f0", "f2")), ("scaler", ("f0", "f2"))):
            self.assertEqual(tuple((r.row_id, r.feature_names) for r in trace if r.stage == stage),
                             tuple((rid, names) for rid in ("SYN-R1", "SYN-R2", "SYN-R3")))

    def test_heldout_access_denied_at_read(self):
        reader = FitReader(self.rows)
        for stage in ("selector", "imputer", "scaler"):
            for rid in ("SYN-R4", "SYN-R5", "SYN-R6"):
                with self.subTest(stage=stage, rid=rid):
                    self.rejects("FIT_SCOPE", lambda: reader.read(stage, rid))
        self.assertEqual(reader.trace, ())

    def test_caller_cannot_authorize_heldout_participant(self):
        for pid in ("SYN-P3", "SYN-P4", "unknown"):
            with self.subTest(pid=pid):
                self.rejects("FIT_SCOPE", lambda: self.fitted(fit_participants=(pid,)))

    def test_no_development_rows_fail_closed(self):
        self.rejects("FIT_SCOPE", lambda: self.fitted(self.rows[3:]))

    def test_inner_development_subset_has_fresh_fit_scope(self):
        first = self.fitted(fit_participants=("SYN-P1",))
        second = self.fitted(fit_participants=("SYN-P2",))
        self.assertEqual(first.medians, (2, 4))
        self.assertEqual(second.medians, (6, 4))
        self.assertEqual({r.row_id for r in first.fit_reads}, {"SYN-R1", "SYN-R2"})
        self.assertEqual({r.row_id for r in second.fit_reads}, {"SYN-R3"})

    def test_heldout_only_feature_excluded(self):
        # The unsafe whole table has 3/6 f1 values; train has 0/3. Literal expected counts.
        self.assertEqual(sum(dict(r.features)["f1"] is not None for r in self.rows), 3)
        self.assertNotIn("f1", self.fitted().selected)

    def test_heldout_features_and_references_do_not_change_fit(self):
        mutated = self.rows[:3] + tuple(replace(r, features=(("f0", -999), ("f1", None), ("f2", 999)),
                                              reference=Reference("eligible", "SYN-DIFFERENT"))
                                       for r in self.rows[3:])
        self.assertEqual(self.fitted(), self.fitted(mutated))

    def test_all_missing_development_features_fail_closed(self):
        rows = tuple(replace(r, features=(("f0", None), ("f1", None), ("f2", None)))
                     if r.role == "development" else r for r in self.rows)
        self.rejects("NO_TRAIN_FEATURES", lambda: self.fitted(rows))

    def test_training_fraction_is_explicit_and_valid(self):
        for fraction in (0, -1, 1.1, True, float("nan")):
            with self.subTest(fraction=fraction):
                self.rejects("FRACTION", lambda: fit_preprocessor(self.rows, min_available_fraction=fraction))

    def test_transform_heldout_does_not_fit(self):
        fitted = self.fitted()
        before = fitted.fit_reads
        output = fitted.transform(self.rows[3:])
        self.assertEqual(tuple(rid for rid, _ in output), ("SYN-R4", "SYN-R5", "SYN-R6"))
        self.assertAlmostEqual(output[0][1][0], 96 / math.sqrt(8 / 3))
        self.assertEqual(fitted.fit_reads, before)

    def test_prediction_keeps_existing_reference(self):
        bundle = attach_predictions(self.rows, (prediction("SYN-R1", "SYN-OTHER"),))
        self.assertEqual(bundle.rows[0].reference, Reference("eligible", "SYN-LABEL-A"))
        self.assertEqual(bundle.reference_digest, reference_digest(self.rows))

    def test_prediction_never_fills_missing_reference(self):
        for index in (1, 4, 5):
            with self.subTest(index=index):
                bundle = attach_predictions(self.rows, (prediction(self.rows[index].row_id),))
                self.assertIsNone(bundle.rows[index].reference.value)
                self.assertEqual(bundle.rows[index].reference.eligibility, self.rows[index].reference.eligibility)

    def test_references_frozen_and_replacement_detected(self):
        with self.assertRaises(FrozenInstanceError):
            self.rows[0].reference.value = "SYN-OVERWRITE"
        changed = self.changed(0, reference=Reference("eligible", "SYN-OVERWRITE"))
        self.rejects("REFERENCE_MUTATION", lambda: assert_references_unchanged(reference_digest(self.rows), changed))

    def test_prediction_namespace_rejects_reference_field(self):
        payload = prediction()
        payload["reference"] = Reference("eligible", 99)
        self.rejects("PREDICTION_SHAPE", lambda: attach_predictions(self.rows, (payload,)))

    def test_prediction_payload_is_defensively_copied(self):
        payload = prediction()
        bundle = attach_predictions(self.rows, (payload,))
        payload["value"] = -100
        self.assertEqual(bundle.predictions[0].value, 99)

    def test_prediction_identity_duplicate_and_missing_value(self):
        self.rejects("PREDICTION_DUPLICATE", lambda: attach_predictions(self.rows, (prediction(), prediction())))
        self.rejects("PREDICTION_VALUE", lambda: attach_predictions(self.rows, (prediction(value=None),)))
        self.rejects("PREDICTION_ID", lambda: attach_predictions(self.rows, (prediction(row_id=[]),)))

    def test_unavailable_prediction_keeps_failure_reason(self):
        payload = prediction()
        payload.update(status="failed", value=None, reason="SYN-FAILURE")
        bundle = attach_predictions(self.rows, (payload,))
        self.assertEqual(bundle.predictions[0].reason, "SYN-FAILURE")
        self.assertIsNone(bundle.rows[4].reference.value)

    def test_invalid_reference_cannot_be_silently_repaired(self):
        rows = self.changed(4, reference=Reference("unavailable", 99))
        self.rejects("REFERENCE_VALUE", lambda: attach_predictions(rows, (prediction(),)))


if __name__ == "__main__":
    unittest.main()
