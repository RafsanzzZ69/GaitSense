import copy
import importlib.util
import tempfile
import unittest
from pathlib import Path

spec = importlib.util.spec_from_file_location(
    "study_check", Path(__file__).parents[1] / "check.py"
)
gate = importlib.util.module_from_spec(spec)
spec.loader.exec_module(gate)


def fixture():
    """Synthetic metadata only; never real participants or a collection approval."""
    return {
        "dataset_version": "synthetic-test",
        "protocol_version": gate.PROTOCOL,
        "records": [
            {
                "participant_id": "P001",
                "clip_id": "P001_T01",
                "protocol_version": gate.PROTOCOL,
                "consent_id": "C001",
                "consent_status": "accepted",
                "view": "side_left",
                "pace": "comfortable",
                "split": "train",
                "file_sha256": "a" * 64,
                "duration_seconds": 12,
                "fps": 30,
                "usable_frame_ratio": 0.9,
                "step_count_manual": 8,
                "walking_interval_seconds": 5,
                "ground_truth": {
                    "method": "marked_distance_timing",
                    "distance_m": 4,
                    "start_seconds": 2,
                    "end_seconds": 7,
                    "speed_mps": 0.8,
                    "markers_visible": True,
                    "distance_verified": True,
                    "reviewer_ids": ["R01", "R02"],
                },
            }
        ],
    }


class StudyChecks(unittest.TestCase):
    def test_baseline_complete(self):
        self.assertEqual(
            gate.check_requirements(gate.read_json(gate.PLAN / "requirements.json")), 42
        )

    def test_real_approvals_remain_pending(self):
        self.assertEqual(
            set(gate.approval_blockers(gate.read_json(gate.PLAN / "approvals.json"))),
            gate.APPROVAL_IDS,
        )
        self.assertEqual(gate.main(["--readiness"]), 2)

    def test_good_synthetic_metadata(self):
        self.assertEqual(gate.check_dataset(fixture())["clips"], 1)

    def test_withdrawn_or_missing_consent(self):
        for field, value in [("consent_status", "withdrawn"), ("consent_id", "")]:
            data = fixture()
            data["records"][0][field] = value
            with self.subTest(field=field), self.assertRaises(ValueError):
                gate.check_dataset(data)

    def test_estimated_labels_rejected(self):
        data = fixture()
        data["records"][0]["ground_truth"]["method"] = "visual_boundary_estimate"
        with self.assertRaisesRegex(ValueError, "ground truth"):
            gate.check_dataset(data)

    def test_participant_split_leakage(self):
        data = fixture()
        other = copy.deepcopy(data["records"][0])
        other.update(clip_id="P001_T02", file_sha256="b" * 64, split="test")
        data["records"].append(other)
        with self.assertRaisesRegex(ValueError, "leakage"):
            gate.check_dataset(data)

    def test_duplicates_and_consent_reuse(self):
        for duplicate in ("clip", "hash", "consent"):
            data = fixture()
            other = copy.deepcopy(data["records"][0])
            if duplicate != "clip":
                other["clip_id"] = "P002_T01"
                other["participant_id"] = "P002"
            if duplicate != "hash":
                other["file_sha256"] = "b" * 64
            if duplicate != "consent":
                other["consent_id"] = "C002"
            data["records"].append(other)
            with self.subTest(duplicate=duplicate), self.assertRaises(ValueError):
                gate.check_dataset(data)

    def test_invalid_numeric_and_quality_fields(self):
        for field, value in [
            ("fps", float("nan")),
            ("fps", True),
            ("duration_seconds", 4),
            ("usable_frame_ratio", 0.5),
            ("step_count_manual", 2),
            ("walking_interval_seconds", 99),
        ]:
            data = fixture()
            data["records"][0][field] = value
            with self.subTest(field=field), self.assertRaises(ValueError):
                gate.check_dataset(data)

    def test_reference_boundaries_math_and_reviewers(self):
        for field, value in [
            ("end_seconds", 99),
            ("speed_mps", 99),
            ("markers_visible", False),
            ("distance_verified", False),
            ("reviewer_ids", ["R01", "R01"]),
        ]:
            data = fixture()
            data["records"][0]["ground_truth"][field] = value
            with self.subTest(field=field), self.assertRaises(ValueError):
                gate.check_dataset(data)

    def test_unknown_view_protocol_and_identifying_field(self):
        for field, value in [
            ("view", "unknown"),
            ("protocol_version", "old"),
            ("name", "not allowed"),
        ]:
            data = fixture()
            data["records"][0][field] = value
            with self.subTest(field=field), self.assertRaises(ValueError):
                gate.check_dataset(data)

    def test_fake_approval_missing_signature_reference(self):
        data = gate.read_json(gate.PLAN / "approvals.json")
        data["approvals"][0]["decision"] = "approved"
        with self.assertRaises(ValueError):
            gate.approval_blockers(data)

    def test_synthetic_approved_cli_and_invalid_dataset_exit_codes(self):
        approvals = gate.read_json(gate.PLAN / "approvals.json")
        for row in approvals["approvals"]:
            row.update(
                decision="approved",
                reviewer="SYNTHETIC TEST ONLY",
                date="2026-01-01",
                evidence_ref="synthetic-not-real-approval",
            )
        with tempfile.TemporaryDirectory(prefix="gaitsense-study-test-") as folder:
            approval_path = Path(folder) / "approvals.json"
            dataset_path = Path(folder) / "dataset.json"
            approval_path.write_text(gate.json.dumps(approvals), encoding="utf-8")
            dataset_path.write_text(gate.json.dumps(fixture()), encoding="utf-8")
            self.assertEqual(
                gate.main(
                    ["--dataset", str(dataset_path), "--approvals", str(approval_path)]
                ),
                0,
            )
            data = fixture()
            data["records"][0]["consent_status"] = "withdrawn"
            dataset_path.write_text(gate.json.dumps(data), encoding="utf-8")
            self.assertEqual(
                gate.main(
                    ["--dataset", str(dataset_path), "--approvals", str(approval_path)]
                ),
                1,
            )

    def test_invalid_approval_dates_and_coverage(self):
        original = gate.read_json(gate.PLAN / "approvals.json")
        for kind in ("future", "missing", "duplicate"):
            data = copy.deepcopy(original)
            if kind == "future":
                data["approvals"][0].update(
                    decision="approved",
                    reviewer="synthetic",
                    date="2999-01-01",
                    evidence_ref="synthetic",
                )
            elif kind == "missing":
                data["approvals"].pop()
            else:
                data["approvals"][1] = data["approvals"][0]
            with self.subTest(kind=kind), self.assertRaises(ValueError):
                gate.approval_blockers(data)

    def test_checklist_missing_duplicate_and_cycle(self):
        original = gate.read_json(gate.PLAN / "requirements.json")
        for kind in ("missing", "duplicate", "cycle"):
            data = copy.deepcopy(original)
            if kind == "missing":
                data["requirements"].pop()
            elif kind == "duplicate":
                data["requirements"].append(data["requirements"][0])
            else:
                data["requirements"][0]["depends_on"] = ["FR-02"]
                data["requirements"][1]["depends_on"] = ["FR-01"]
            with self.subTest(kind=kind), self.assertRaises(ValueError):
                gate.check_requirements(data)

    def test_json_rejects_duplicate_keys_and_nan(self):
        with tempfile.TemporaryDirectory(prefix="gaitsense-study-test-") as folder:
            path = Path(folder) / "synthetic.json"
            for value in ('{"a":1,"a":2}', '{"a":NaN}'):
                path.write_text(value, encoding="utf-8")
                with self.assertRaises(ValueError):
                    gate.read_json(path)


if __name__ == "__main__":
    unittest.main()
