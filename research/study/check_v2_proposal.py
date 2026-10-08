"""PROPOSAL ONLY: fixed synthetic fixtures; never research approval or V1 validation.

No media, external input paths, network, training, imports from check.py or writes.
This is a bounded fixture projection, not the production Research Manifest V2.
"""

import json
import math
import re
import sys
from fractions import Fraction
from pathlib import Path

FIXTURES = Path(__file__).resolve().parent / "fixtures" / "v2-proposal"
SCHEMA = "gaitsense-v2-invariant-fixture-0.1"
PARTITIONS = {"train", "validation", "test"}
WORKFLOW = {
    "not_requested": "not_requested", "pending": "pending",
    "observer_a_only": "pending", "observer_b_only": "pending",
    "disagreement_pending": "pending", "adjudication_required": "pending",
    "accepted": "accepted", "rejected": "rejected", "unavailable": "unavailable",
}
FORBIDDEN_INPUTS = {
    "measured_distance_m", "crossing_duration_seconds", "final_speed_mps",
    "accepted_start_seconds", "accepted_end_seconds", "reference_start_seconds",
    "reference_end_seconds", "observer_decision", "participant_id", "session_id",
    "trial_id", "attempt_id", "predicted_speed_mps",
}


class Invalid(ValueError):
    def __init__(self, code):
        self.code = code
        super().__init__(code)


def need(condition, code):
    if not condition:
        raise Invalid(code)


def shape(value, keys):
    need(type(value) is dict and set(value) == set(keys.split()), "SHAPE")


def array(value):
    need(type(value) is list, "SHAPE")
    return value


def code(value):
    return isinstance(value, str) and re.fullmatch(r"SYN-[A-Z0-9-]+", value) is not None


def pointer(value):
    need(code(value), "SYNTHETIC_POINTER")


def num(value):
    return type(value) in (int, float) and math.isfinite(value)


def q(value):
    need(num(value), "NUMBER")
    return Fraction(str(value))


def read_json(path):
    def unique(pairs):
        result = {}
        for key, value in pairs:
            need(key not in result, "JSON_DUPLICATE_KEY")
            result[key] = value
        return result

    def constant(_):
        raise Invalid("JSON_NONFINITE")

    def finite_float(raw):
        value = float(raw)
        need(math.isfinite(value), "JSON_NONFINITE")
        return value

    return json.loads(path.read_text(encoding="utf-8"), object_pairs_hook=unique,
                      parse_constant=constant, parse_float=finite_float)


def indexed(rows, key):
    result = {}
    for row in array(rows):
        need(type(row) is dict and code(row.get(key)), "ID_REQUIRED")
        need(row[key] not in result, "ID_DUPLICATE")
        result[row[key]] = row
    return result


def timing(t):
    shape(t, "class simulated_qualified qualification_ref clock_id method_version "
             "timebase_num timebase_den origin_ticks sync_ref")
    need(t["class"] in {"decoded_pts", "external_sync", "nominal_fps",
                        "android_requested", "unknown"}, "TIMING_CLASS")
    need(type(t["simulated_qualified"]) is bool, "SHAPE")
    pointer(t["clock_id"])
    pointer(t["method_version"])
    qualified = t["class"] in {"decoded_pts", "external_sync"} and t["simulated_qualified"]
    if qualified:
        pointer(t["qualification_ref"])
        if t["class"] == "decoded_pts":
            need(all(type(t[k]) is int for k in
                     ("timebase_num", "timebase_den", "origin_ticks")) and
                 t["timebase_num"] > 0 and t["timebase_den"] > 0, "TIMEBASE")
            need(t["sync_ref"] is None, "SHAPE")
        else:
            pointer(t["sync_ref"])
            need(all(t[k] is None for k in
                     ("timebase_num", "timebase_den", "origin_ticks")), "SHAPE")
    return qualified


def observation(o):
    shape(o, "observer_id start_seconds end_seconds timing source_file_id "
             "start_support end_support uncertainty_seconds uncertainty_method "
             "confidence independent model_blinded locked submission_ref annotation_version")
    for key in ("observer_id", "source_file_id", "submission_ref", "annotation_version",
                "uncertainty_method"):
        pointer(o[key])
    need(all(o[k] is True for k in ("independent", "model_blinded", "locked")),
         "OBSERVER_INDEPENDENCE")
    need(q(o["end_seconds"]) > q(o["start_seconds"]), "DURATION")
    need(q(o["uncertainty_seconds"]) >= 0 and o["confidence"] in
         {"synthetic_clear", "synthetic_uncertain"}, "OBSERVER_UNCERTAINTY")
    qualified = timing(o["timing"])
    for support_key, seconds_key in (("start_support", "start_seconds"),
                                     ("end_support", "end_seconds")):
        support = o[support_key]
        shape(support, "evidence_id ticks")
        pointer(support["evidence_id"])
        if qualified and o["timing"]["class"] == "decoded_pts":
            t = o["timing"]
            need(type(support["ticks"]) is int, "PTS_MAPPING")
            seconds = Fraction((support["ticks"] - t["origin_ticks"]) *
                               t["timebase_num"], t["timebase_den"])
            need(seconds == q(o[seconds_key]), "PTS_MAPPING")
        elif o["timing"]["class"] == "external_sync":
            need(support["ticks"] is None, "PTS_MAPPING")
    return qualified


def check_reference(r, attempt, assets, policy):
    shape(r, "status workflow reason source_file_id provenance_ref annotation_version "
             "revision policy_version crossing_rule_version method timing distance "
             "observer_a observer_b adjudication accepted_start_seconds accepted_end_seconds "
             "crossing_duration_seconds final_speed_mps reference_uncertainty")
    need(WORKFLOW.get(r["workflow"]) == r["status"], "REFERENCE_STATE")
    for key in ("annotation_version", "revision", "policy_version", "crossing_rule_version"):
        pointer(r[key])
    need(r["annotation_version"] == attempt["annotation_version"] and
         r["policy_version"] == policy["version"], "REFERENCE_VERSION")
    need(r["method"] == "independent_measured_zone", "REFERENCE_METHOD")
    qualified = timing(r["timing"])
    if r["source_file_id"] is not None:
        asset = assets.get(r["source_file_id"])
        need(asset is not None and asset["attempt_id"] == attempt["attempt_id"],
             "REFERENCE_SOURCE")
    distance = r["distance"]
    if distance is not None:
        shape(distance, "value_m uncertainty_m method_ref verification_ref course_id")
        need(q(distance["value_m"]) > 0 and q(distance["uncertainty_m"]) >= 0, "DISTANCE")
        for key in ("method_ref", "verification_ref", "course_id"):
            pointer(distance[key])
    a, b = r["observer_a"], r["observer_b"]
    for o in (a, b):
        if o is not None:
            observation(o)
            need(o["annotation_version"] == r["annotation_version"] and
                 o["source_file_id"] == r["source_file_id"], "OBSERVER_SOURCE")
    if a is not None and b is not None:
        need(a["observer_id"] != b["observer_id"], "OBSERVER_DISTINCT")
    adj = r["adjudication"]
    shape(adj, "status observer rationale_ref decision_ref")
    need(adj["status"] in {"pending", "not_required", "resolved", "unresolved"},
         "ADJUDICATION")
    if adj["observer"] is not None:
        observation(adj["observer"])
        third = adj["observer"]
        need(third["source_file_id"] == r["source_file_id"] and
             third["annotation_version"] == r["annotation_version"] and
             all(o is None or third["observer_id"] != o["observer_id"] for o in (a, b)),
             "ADJUDICATION")
    if adj["status"] == "resolved":
        pointer(adj["rationale_ref"])
        pointer(adj["decision_ref"])
    if r["workflow"] == "observer_a_only":
        need(a is not None and b is None, "REFERENCE_STATE")
    if r["workflow"] == "observer_b_only":
        need(b is not None and a is None, "REFERENCE_STATE")
    if r["workflow"] == "not_requested":
        need(a is None and b is None, "REFERENCE_STATE")
    if r["workflow"] == "pending":
        need((a is None) == (b is None), "REFERENCE_STATE")
    if r["workflow"] in {"disagreement_pending", "adjudication_required"}:
        need(a is not None and b is not None, "REFERENCE_STATE")
    final_keys = ("accepted_start_seconds", "accepted_end_seconds",
                  "crossing_duration_seconds", "final_speed_mps", "reference_uncertainty")
    if r["status"] != "accepted":
        need(all(r[k] is None for k in final_keys), "FINAL_LABEL_FORBIDDEN")
        need(code(r["reason"]), "REFERENCE_REASON")
        if r["status"] in {"pending", "not_requested"}:
            need(adj["status"] in {"pending", "unresolved"}, "REFERENCE_STATE")
        # Rejected/unavailable decisions may retain prior completed adjudication.
        # The null current label, not erased annotation history, blocks inclusion.
        return False
    need(r["reason"] is None, "REFERENCE_REASON")
    pointer(r["provenance_ref"])
    need(qualified, "TIMING_UNQUALIFIED")
    need(r["source_file_id"] is not None and
         assets[r["source_file_id"]]["availability"] == "synthetic_available" and
         assets[r["source_file_id"]]["kind"] == "original", "REFERENCE_SOURCE")
    need(distance is not None, "DISTANCE_REQUIRED")
    need(a is not None and b is not None, "OBSERVERS_REQUIRED")
    need(all(o["timing"] == r["timing"] for o in (a, b)), "TIMING_INCOMPATIBLE")
    need(policy["status"] == "simulated", "POLICY_PENDING")
    threshold = q(policy["disagreement_seconds"])
    need(threshold >= 0, "POLICY")
    differences = [abs(q(a[k]) - q(b[k])) for k in ("start_seconds", "end_seconds")]
    differences.append(abs((q(a["end_seconds"]) - q(a["start_seconds"])) -
                           (q(b["end_seconds"]) - q(b["start_seconds"]))))
    if adj["status"] == "not_required":
        need(adj["observer"] is None and max(differences) <= threshold, "ADJUDICATION_REQUIRED")
        start = (q(a["start_seconds"]) + q(b["start_seconds"])) / 2
        end = (q(a["end_seconds"]) + q(b["end_seconds"])) / 2
    else:
        need(adj["status"] == "resolved" and adj["observer"] is not None,
             "ADJUDICATION_REQUIRED")
        third = adj["observer"]
        need(third["observer_id"] not in {a["observer_id"], b["observer_id"]} and
             third["timing"] == r["timing"] and third["source_file_id"] == r["source_file_id"]
             and third["annotation_version"] == r["annotation_version"], "ADJUDICATION")
        pointer(adj["rationale_ref"])
        pointer(adj["decision_ref"])
        start, end = q(third["start_seconds"]), q(third["end_seconds"])
    need(end > start and q(r["crossing_duration_seconds"]) > 0, "DURATION")
    need(q(r["accepted_start_seconds"]) == start and q(r["accepted_end_seconds"]) == end and
         q(r["crossing_duration_seconds"]) == end - start and
         q(r["final_speed_mps"]) == q(distance["value_m"]) / (end - start), "SPEED_FORMULA")
    uncertainty = r["reference_uncertainty"]
    shape(uncertainty, "duration_seconds speed_mps method_ref")
    need(q(uncertainty["duration_seconds"]) >= 0 and q(uncertainty["speed_mps"]) >= 0,
         "REFERENCE_UNCERTAINTY")
    pointer(uncertainty["method_ref"])
    return True


def validate_manifest(m):
    def finite_tree(value):
        if type(value) is float:
            need(math.isfinite(value), "NUMBER")
        elif type(value) is dict:
            for child in value.values():
                finite_tree(child)
        elif type(value) is list:
            for child in value:
                finite_tree(child)

    finite_tree(m)
    shape(m, "schema evidence_kind scientific_status versions simulated_policy participants "
             "trials attempts assets derived runs split_frozen frozen_test_participants")
    need(m["schema"] == SCHEMA and m["evidence_kind"] == "synthetic" and
         m["scientific_status"] == "NOT_EVALUATED", "SYNTHETIC_BOUNDARY")
    shape(m["versions"], "dataset annotation feature preprocessing split protocol")
    for value in m["versions"].values():
        pointer(value)
    policy = m["simulated_policy"]
    shape(policy, "status version disagreement_seconds combination_rule")
    pointer(policy["version"])
    need(policy["status"] in {"simulated", "pending"} and
         policy["combination_rule"] == "mean_or_third", "POLICY")
    need((policy["status"] == "pending" and policy["disagreement_seconds"] is None) or
         (policy["status"] == "simulated" and num(policy["disagreement_seconds"]) and
          policy["disagreement_seconds"] >= 0), "POLICY")
    need(type(m["split_frozen"]) is bool, "SHAPE")
    participants = {}
    for p in array(m["participants"]):
        shape(p, "participant_id identity_status partition governance consent_ref "
                 "institution_ref retention_ref withdrawal_status")
        pointer(p["participant_id"])
        need(p["participant_id"] not in participants, "PARTICIPANT_PARTITION")
        need(p["identity_status"] in {"known", "unknown"}, "IDENTITY")
        need(p["partition"] is None or p["partition"] in PARTITIONS, "PARTITION")
        need(p["governance"] in {"simulated_permitted", "simulated_pending", "simulated_withdrawn"}
             and p["withdrawal_status"] in {"none", "requested", "resolved"}, "GOVERNANCE")
        for key in ("consent_ref", "institution_ref", "retention_ref"):
            pointer(p[key])
        participants[p["participant_id"]] = p
    frozen = array(m["frozen_test_participants"])
    need(all(code(pid) for pid in frozen) and len(frozen) == len(set(frozen)), "SPLIT_FROZEN")
    if m["split_frozen"]:
        need(set(frozen) == {pid for pid, p in participants.items() if p["partition"] == "test"},
             "SPLIT_FROZEN")
    trials = indexed(m["trials"], "trial_id")
    sessions = {}
    for t in trials.values():
        shape(t, "trial_id session_id participant_id planned_status reason")
        pointer(t["session_id"])
        need(t["participant_id"] is None or t["participant_id"] in participants, "IDENTITY")
        need(sessions.setdefault(t["session_id"], t["participant_id"]) == t["participant_id"],
             "OWNERSHIP")
        need(t["planned_status"] in {"planned", "unattempted", "attempted"}, "LIFECYCLE")
    attempts = indexed(m["attempts"], "attempt_id")
    assets = indexed(m["assets"], "source_file_id")
    counts = {tid: 0 for tid in trials}
    for a in attempts.values():
        shape(a, "participant_id session_id trial_id attempt_id partition attempt_status "
                 "capture_status processing_status failure_reason replacement_of_attempt_id "
                 "replacement_decision_ref use_requested annotation_version reference prediction")
        need(a["trial_id"] in trials and code(a["session_id"]), "ID_REQUIRED")
        t = trials[a["trial_id"]]
        need((a["participant_id"], a["session_id"]) == (t["participant_id"], t["session_id"]),
             "OWNERSHIP")
        p = participants.get(a["participant_id"])
        need(a["partition"] is None or a["partition"] in PARTITIONS, "PARTITION")
        need(p is None or a["partition"] == p["partition"], "PARTICIPANT_PARTITION")
        need(type(a["use_requested"]) is bool, "SHAPE")
        need(a["attempt_status"] in {"in_progress", "completed", "interrupted"} and
             a["capture_status"] in {"in_progress", "captured", "partial", "failed", "cancelled"}
             and a["processing_status"] in {"not_requested", "pending", "processing",
                 "succeeded", "partial", "failed", "cancelled"}, "LIFECYCLE")
        if a["capture_status"] in {"failed", "partial", "cancelled"} or a["processing_status"] in {
                "failed", "partial", "cancelled"} or a["attempt_status"] == "interrupted":
            need(code(a["failure_reason"]), "FAILURE_REASON")
        if a["use_requested"]:
            need(p is not None and p["identity_status"] == "known", "IDENTITY")
            need(p["governance"] == "simulated_permitted" and p["withdrawal_status"] == "none",
                 "GOVERNANCE")
            need(a["partition"] in PARTITIONS and m["split_frozen"], "PARTITION")
        need(a["annotation_version"] == m["versions"]["annotation"], "REFERENCE_VERSION")
        counts[a["trial_id"]] += 1
        parent = a["replacement_of_attempt_id"]
        if parent is not None:
            need(parent in attempts and parent != a["attempt_id"] and
                 attempts[parent]["trial_id"] == a["trial_id"] and
                 code(a["replacement_decision_ref"]), "REPLACEMENT")
            seen = {a["attempt_id"]}
            while parent is not None:
                need(parent in attempts and parent not in seen, "REPLACEMENT")
                seen.add(parent)
                parent = attempts[parent]["replacement_of_attempt_id"]
        else:
            need(a["replacement_decision_ref"] is None, "REPLACEMENT")
    for tid, t in trials.items():
        need((t["planned_status"] == "attempted") == (counts[tid] > 0), "LIFECYCLE")
        if t["planned_status"] == "unattempted":
            need(code(t["reason"]), "FAILURE_REASON")
    hashes, lineages = {}, {}
    for asset in assets.values():
        shape(asset, "source_file_id attempt_id file_sha256 content_lineage_id kind "
                     "parent_source_file_id relationship provenance_ref availability")
        need(asset["attempt_id"] in attempts, "ASSET_OWNERSHIP")
        need(isinstance(asset["file_sha256"], str) and re.fullmatch(r"[0-9a-f]{64}",
             asset["file_sha256"]) is not None, "HASH")
        pointer(asset["content_lineage_id"])
        pointer(asset["provenance_ref"])
        need(asset["kind"] in {"original", "reencoded", "derived"} and
             asset["availability"] in {"synthetic_available", "synthetic_missing"}, "SHAPE")
        a = attempts[asset["attempt_id"]]
        owner = (a["participant_id"], a["attempt_id"])
        digest, lineage = asset["file_sha256"], asset["content_lineage_id"]
        need(hashes.setdefault(digest, (a["partition"], owner))[0] == a["partition"],
             "HASH_PARTITION")
        need(lineages.setdefault(lineage, (a["partition"], owner))[0] == a["partition"],
             "LINEAGE_PARTITION")
        need(hashes[digest][1] == owner and lineages[lineage][1] == owner, "ASSET_OWNERSHIP")
        parent = asset["parent_source_file_id"]
        if parent is None:
            need(asset["kind"] == "original" and asset["relationship"] is None, "MEDIA_LINEAGE")
        else:
            need(parent in assets and parent != asset["source_file_id"], "MEDIA_LINEAGE")
            original = assets[parent]
            need(original["attempt_id"] == asset["attempt_id"] and
                 original["content_lineage_id"] == lineage, "MEDIA_LINEAGE")
            need((asset["kind"], asset["relationship"]) in {
                 ("original", "alias"), ("original", "duplicate"),
                 ("reencoded", "reencoded"), ("derived", "overlay"), ("derived", "derived")},
                 "MEDIA_LINEAGE")
            if asset["relationship"] == "alias":
                need(digest == original["file_sha256"], "MEDIA_LINEAGE")
            seen = {asset["source_file_id"]}
            while parent is not None:
                need(parent in assets and parent not in seen, "MEDIA_LINEAGE")
                seen.add(parent)
                parent = assets[parent]["parent_source_file_id"]
    reference_eligible, paired = [], []
    for a in attempts.values():
        if a["capture_status"] == "captured":
            need(any(asset["attempt_id"] == a["attempt_id"] and asset["kind"] == "original"
                     for asset in assets.values()), "CAPTURE_SOURCE")
        accepted = check_reference(a["reference"], a, assets, policy)
        pred = a["prediction"]
        shape(pred, "status predicted_speed_mps model_run_id")
        need(pred["status"] in {"available", "unavailable", "not_requested", "failed"}, "PREDICTION")
        if pred["status"] == "available":
            need(num(pred["predicted_speed_mps"]) and pred["predicted_speed_mps"] > 0
                 and a["processing_status"] == "succeeded", "PREDICTION")
            pointer(pred["model_run_id"])
        else:
            need(pred["predicted_speed_mps"] is None, "PREDICTION")
        p = participants.get(a["participant_id"])
        eligible = accepted and p is not None and p["identity_status"] == "known" and \
            p["governance"] == "simulated_permitted" and p["withdrawal_status"] == "none" and \
            a["partition"] in PARTITIONS and m["split_frozen"]
        need(not a["use_requested"] or eligible, "REFERENCE_INCLUSION")
        if eligible:
            reference_eligible.append(a["attempt_id"])
            if pred["status"] == "available":
                paired.append(a["attempt_id"])
    derived = indexed(m["derived"], "artifact_id")
    for d in derived.values():
        shape(d, "artifact_id kind source_file_id attempt_id participant_id partition feature_version")
        need(d["kind"] in {"frame", "window", "augmentation"}, "SHAPE")
        need(d["source_file_id"] in assets and d["attempt_id"] in attempts and
             assets[d["source_file_id"]]["attempt_id"] == d["attempt_id"], "DERIVED_OWNERSHIP")
        a = attempts[d["attempt_id"]]
        need(d["participant_id"] == a["participant_id"] and d["partition"] == a["partition"],
             "DERIVED_PARTITION")
        need(d["feature_version"] == m["versions"]["feature"], "FEATURE_VERSION")
    runs = indexed(m["runs"], "model_run_id")
    for run in runs.values():
        shape(run, "model_run_id model_run_version input_names fit_participants tune_participants")
        pointer(run["model_run_version"])
        inputs = array(run["input_names"])
        need(inputs and all(isinstance(name, str) for name in inputs), "SHAPE")
        need(not (set(inputs) & FORBIDDEN_INPUTS), "TARGET_LEAKAGE")
        for field, allowed in (("fit_participants", {"train"}),
                               ("tune_participants", {"train", "validation"})):
            for pid in array(run[field]):
                need(pid in participants and participants[pid]["partition"] in allowed and
                     participants[pid]["identity_status"] == "known" and
                     participants[pid]["governance"] == "simulated_permitted" and
                     participants[pid]["withdrawal_status"] == "none", "RUN_PARTITION")
    for a in attempts.values():
        if a["prediction"]["status"] == "available":
            need(a["prediction"]["model_run_id"] in runs, "PREDICTION_RUN")
    return {"ledger_valid": True, "error": None,
            "reference_eligible": sorted(reference_eligible), "paired_eligible": sorted(paired)}


def outcome(manifest):
    try:
        return validate_manifest(manifest)
    except Invalid as error:
        return {"ledger_valid": False, "error": error.code,
                "reference_eligible": [], "paired_eligible": []}
    except (TypeError, KeyError, AttributeError, OverflowError):
        # Wrong nested types must fail closed rather than crash or confer eligibility.
        return {"ledger_valid": False, "error": "SHAPE",
                "reference_eligible": [], "paired_eligible": []}


def load_fixtures():
    need(FIXTURES.is_dir() and not FIXTURES.is_symlink(), "FIXTURE_PATH")
    cases = []
    for path in sorted(FIXTURES.glob("*.json")):
        need(not path.is_symlink() and path.resolve().parent == FIXTURES.resolve(), "FIXTURE_PATH")
        data = read_json(path)
        shape(data, "fixture_id description expected manifest")
        pointer(data["fixture_id"])
        need(isinstance(data["description"], str), "SHAPE")
        shape(data["expected"], "ledger_valid error reference_eligible paired_eligible")
        expected = data["expected"]
        need(type(expected["ledger_valid"]) is bool, "FIXTURE_ORACLE")
        need((expected["ledger_valid"] and expected["error"] is None) or
             (not expected["ledger_valid"] and isinstance(expected["error"], str)
              and expected["error"]), "FIXTURE_ORACLE")
        for field in ("reference_eligible", "paired_eligible"):
            rows = array(expected[field])
            need(all(code(aid) for aid in rows) and rows == sorted(set(rows)), "FIXTURE_ORACLE")
        need(set(expected["paired_eligible"]) <= set(expected["reference_eligible"]) and
             (expected["ledger_valid"] or not expected["reference_eligible"]), "FIXTURE_ORACLE")
        cases.append((path.name, data))
    need(cases and len({d["fixture_id"] for _, d in cases}) == len(cases), "FIXTURE_COUNT")
    return cases


def main():
    if len(sys.argv) != 1:
        print("REFUSED: no external input/approval paths supported; synthetic fixtures only.")
        return 2
    try:
        passed = expected_fail = mismatches = 0
        for filename, case in load_fixtures():
            actual = outcome(case["manifest"])
            matched = actual == case["expected"]
            mismatches += not matched
            passed += matched and actual["ledger_valid"]
            expected_fail += matched and not actual["ledger_valid"]
            print(f"{'OK' if matched else 'MISMATCH'} {filename}: "
                  f"{'PASS' if actual['ledger_valid'] else actual['error']}")
        print(f"Synthetic proposal only: {passed} PASS; {expected_fail} expected FAIL; "
              f"{mismatches} mismatches. Scientific status NOT_EVALUATED.")
        return 1 if mismatches else 0
    except (Invalid, OSError, json.JSONDecodeError, TypeError, KeyError) as error:
        print(f"INVALID SYNTHETIC PACKAGE: {error}", file=sys.stderr)
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
