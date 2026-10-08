"""Synthetic proposal boundary/regression tests. No study/media/model execution."""

import copy
import importlib.util
import json
import subprocess
import sys
import tempfile
import unittest
from pathlib import Path

SPEC = importlib.util.spec_from_file_location(
    "v2_proposal_only", Path(__file__).parents[1] / "check_v2_proposal.py"
)
gate = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(gate)


class ProposalFixtures(unittest.TestCase):
    def setUp(self):
        self.cases = gate.load_fixtures()
        self.base = copy.deepcopy(self.cases[0][1]["manifest"])

    def assert_error(self, data, error):
        self.assertEqual(gate.outcome(data), {
            "ledger_valid": False, "error": error,
            "reference_eligible": [], "paired_eligible": [],
        })

    def test_all_hand_declared_fixture_oracles(self):
        self.assertEqual(len(self.cases), 51)
        self.assertEqual(sum(c["expected"]["ledger_valid"] for _, c in self.cases), 23)
        for filename, case in self.cases:
            with self.subTest(fixture=filename):
                self.assertEqual(gate.outcome(case["manifest"]), case["expected"])

    def test_non_synthetic_envelope_never_accepted(self):
        for key, value in (("evidence_kind", "research"), ("schema", "dataset-v1"),
                           ("scientific_status", "PASS")):
            data = copy.deepcopy(self.base)
            data[key] = value
            with self.subTest(key=key):
                self.assert_error(data, "SYNTHETIC_BOUNDARY")

    def test_no_external_input_path_cli(self):
        result = subprocess.run([sys.executable, "-B", str(Path(gate.__file__)),
                                 "--dataset", "DO-NOT-OPEN.json"],
                                capture_output=True, text=True, check=False)
        self.assertEqual(result.returncode, 2)
        self.assertIn("REFUSED", result.stdout)

    def test_json_duplicate_keys_and_nonfinite_rejected(self):
        # Only artificial JSON in an OS temporary directory; never study inputs.
        with tempfile.TemporaryDirectory(prefix="gaitsense-synthetic-v2-") as folder:
            path = Path(folder) / "synthetic-parser-test.json"
            for source, error in (("{\"x\":1,\"x\":2}", "JSON_DUPLICATE_KEY"),
                                  ("{\"x\":NaN}", "JSON_NONFINITE"),
                                  ("{\"x\":Infinity}", "JSON_NONFINITE"),
                                  ("{\"x\":1e999}", "JSON_NONFINITE")):
                path.write_text(source, encoding="utf-8")
                with self.subTest(source=source), self.assertRaises(gate.Invalid) as caught:
                    gate.read_json(path)
                self.assertEqual(caught.exception.code, error)
            path.write_text("{", encoding="utf-8")
            with self.assertRaises(json.JSONDecodeError):
                gate.read_json(path)

    def test_required_chain_ids(self):
        for field in ("session_id", "trial_id", "attempt_id"):
            data = copy.deepcopy(self.base)
            data["attempts"][0][field] = None
            with self.subTest(field=field):
                self.assert_error(data, "ID_REQUIRED")

    def test_boolean_nan_and_infinite_are_not_measurements(self):
        for value in (True, float("nan"), float("inf")):
            data = copy.deepcopy(self.base)
            data["attempts"][0]["reference"]["distance"]["value_m"] = value
            with self.subTest(value=value):
                self.assert_error(data, "NUMBER")

    def test_unknown_fields_and_malformed_types_fail_closed(self):
        data = copy.deepcopy(self.base)
        data["participants"][0]["name"] = "SYN-IDENTIFYING-FIELD-FORBIDDEN"
        self.assert_error(data, "SHAPE")
        for field in ("participants", "trials", "attempts", "assets", "derived", "runs"):
            data = copy.deepcopy(self.base)
            data[field] = None
            with self.subTest(field=field):
                self.assert_error(data, "SHAPE")
        data = copy.deepcopy(self.base)
        data["attempts"][0]["reference"]["timing"]["class"] = []
        self.assert_error(data, "SHAPE")

    def test_replacement_cycles_and_cross_trial_links(self):
        # Two genuine synthetic attempts from distinct planned trials.
        data = copy.deepcopy(self.cases[13][1]["manifest"])
        data["attempts"][1].update(replacement_of_attempt_id="SYN-A-1",
                                    replacement_decision_ref="SYN-REPLACE-DECISION")
        self.assert_error(data, "REPLACEMENT")
        data = copy.deepcopy(self.cases[4][1]["manifest"])
        data["attempts"][0].update(replacement_of_attempt_id="SYN-A-2",
                                    replacement_decision_ref="SYN-REPLACE-DECISION")
        self.assert_error(data, "REPLACEMENT")

    def test_all_final_fields_forbidden_for_pending_and_unavailable(self):
        for index in (5, 7, 19, 31, 36):
            for field in ("accepted_start_seconds", "accepted_end_seconds",
                          "crossing_duration_seconds", "final_speed_mps",
                          "reference_uncertainty"):
                data = copy.deepcopy(self.cases[index][1]["manifest"])
                data["attempts"][0]["reference"][field] = 0
                with self.subTest(index=index, field=field):
                    self.assert_error(data, "FINAL_LABEL_FORBIDDEN")

    def test_all_reference_target_and_identity_inputs_blocked(self):
        for field in gate.FORBIDDEN_INPUTS:
            data = copy.deepcopy(self.base)
            data["runs"][0]["input_names"].append(field)
            with self.subTest(field=field):
                self.assert_error(data, "TARGET_LEAKAGE")

    def test_frames_windows_augmentations_inherit_test_partition(self):
        for kind in ("frame", "window", "augmentation"):
            data = copy.deepcopy(self.cases[17][1]["manifest"])
            data["derived"][0]["kind"] = kind
            with self.subTest(kind=kind):
                self.assert_error(data, "DERIVED_PARTITION")
            data["derived"][0]["partition"] = "test"
            self.assertTrue(gate.outcome(data)["ledger_valid"])

    def test_unknown_identity_and_partition_are_quarantined_without_use(self):
        data = copy.deepcopy(self.base)
        data["participants"][0]["identity_status"] = "unknown"
        data["attempts"][0]["use_requested"] = False
        data["attempts"][0]["prediction"] = {
            "status": "unavailable", "predicted_speed_mps": None, "model_run_id": None,
        }
        data["runs"] = []
        result = gate.outcome(data)
        self.assertTrue(result["ledger_valid"])
        self.assertEqual(result["reference_eligible"], [])

    def test_rational_pts_and_unknown_timing(self):
        data = copy.deepcopy(self.base)
        reference = data["attempts"][0]["reference"]
        for clock in (reference["timing"], reference["observer_a"]["timing"],
                      reference["observer_b"]["timing"]):
            clock.update(timebase_num=3, timebase_den=90000)
        for observer in (reference["observer_a"], reference["observer_b"]):
            observer["start_support"]["ticks"] = 60000
            observer["end_support"]["ticks"] = 210000
        self.assertTrue(gate.outcome(data)["ledger_valid"])
        reference["timing"]["timebase_den"] = 0
        self.assert_error(data, "TIMEBASE")
        data = copy.deepcopy(self.base)
        data["attempts"][0]["reference"]["timing"]["class"] = "unknown"
        self.assert_error(data, "TIMING_UNQUALIFIED")

    def test_prediction_and_reference_yield_are_separate(self):
        data = copy.deepcopy(self.cases[28][1]["manifest"])
        result = gate.outcome(data)
        self.assertTrue(result["ledger_valid"])
        self.assertEqual(result["reference_eligible"], ["SYN-A-1"])
        self.assertEqual(result["paired_eligible"], [])
        data = copy.deepcopy(self.cases[14][1]["manifest"])
        self.assertEqual(gate.outcome(data)["reference_eligible"], [])

    def test_rejected_and_invalidated_reference_retains_adjudication(self):
        for status in ("rejected", "unavailable"):
            data = copy.deepcopy(self.cases[8][1]["manifest"])
            attempt = data["attempts"][0]
            reference = attempt["reference"]
            reference.update(status=status, workflow=status, reason="SYN-INVALIDATED",
                             revision="SYN-REV-2")
            for field in ("accepted_start_seconds", "accepted_end_seconds",
                          "crossing_duration_seconds", "final_speed_mps", "reference_uncertainty"):
                reference[field] = None
            attempt["use_requested"] = False
            with self.subTest(status=status):
                result = gate.outcome(data)
                self.assertTrue(result["ledger_valid"])
                self.assertEqual(result["reference_eligible"], [])
                self.assertEqual(reference["adjudication"]["status"], "resolved")


if __name__ == "__main__":
    unittest.main()
