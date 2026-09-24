"""Read-only planning/curated-dataset gates. Standard library; no network or DB."""

import argparse
import json
import math
import re
import sys
from datetime import UTC, date, datetime
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
PLAN = ROOT / "docs" / "planning"
PROTOCOL = "GS-SIDE-1.0-draft"
APPROVAL_IDS = {f"A-{i:02}" for i in range(1, 6)}
REQUIREMENT_IDS = (
    {f"FR-{i:02}" for i in range(1, 17)}
    | {f"NFR-{i:02}" for i in range(1, 13)}
    | {f"DATA-{i:02}" for i in range(1, 5)}
    | {f"ML-{i:02}" for i in range(1, 4)}
    | {f"EXT-{i:02}" for i in range(1, 4)}
    | {"FEAT-01", "RES-01", "RES-02", "SAFE-01"}
)


def require(condition, message):
    if not condition:
        raise ValueError(message)


def number(value):
    return type(value) in (int, float) and math.isfinite(value)


def read_json(path):
    def reject_constant(value):
        raise ValueError(f"Non-standard JSON constant: {value}")

    def unique_keys(pairs):
        result = {}
        for key, value in pairs:
            require(key not in result, f"Duplicate JSON key: {key}")
            result[key] = value
        return result

    return json.loads(
        Path(path).read_text(encoding="utf-8"),
        parse_constant=reject_constant,
        object_pairs_hook=unique_keys,
    )


def check_requirements(spec):
    rows = spec["requirements"]
    ids = [row["id"] for row in rows]
    require(len(ids) == len(set(ids)), "Duplicate requirement ID")
    require(
        set(ids) == REQUIREMENT_IDS, "Requirement coverage differs from frozen baseline"
    )
    for row in rows:
        prefix = row["id"]
        require(row["owner"] in spec["owner_roles"], f"{prefix}: unknown owner role")
        require(
            row["status"] in {"partial", "not_started", "verified", "excluded"},
            f"{prefix}: invalid status",
        )
        require(
            row["priority"] in {"core", "optional", "stretch", "excluded"},
            f"{prefix}: invalid priority",
        )
        require(
            (row["status"] == "excluded") == (row["priority"] == "excluded"),
            f"{prefix}: exclusion/status mismatch",
        )
        require(
            len(row["acceptance"].strip()) >= 30, f"{prefix}: missing acceptance test"
        )
        require(row["evidence"], f"{prefix}: missing evidence reference")
        require(
            set(row["depends_on"]) <= set(ids) - {prefix},
            f"{prefix}: invalid dependency",
        )
        if row["status"] == "verified":
            require(row.get("verified_at"), f"{prefix}: verified without date")
            require(
                date.fromisoformat(row["verified_at"])
                <= datetime.now(UTC).astimezone().date(),
                f"{prefix}: future verification",
            )
        for evidence in row["evidence"]:
            path = (ROOT / evidence).resolve()
            require(
                path.is_relative_to(ROOT) and path.exists(),
                f"{prefix}: missing/unsafe evidence path",
            )
    graph = {r["id"]: r["depends_on"] for r in rows}

    def visit(node, active, done):
        require(node not in active, "Cyclic requirements dependency")
        if node in done:
            return
        for dependency in graph[node]:
            visit(dependency, active | {node}, done)
        done.add(node)

    done = set()
    for node in graph:
        visit(node, set(), done)
    return len(rows)


def approval_blockers(spec):
    require(spec["protocol_version"] == PROTOCOL, "Approval protocol mismatch")
    rows = spec["approvals"]
    require(
        len(rows) == 5 and {r["id"] for r in rows} == APPROVAL_IDS,
        "Missing/duplicate approval entries",
    )
    blockers = []
    for row in rows:
        allowed = {"pending", "approved", "rejected"}
        if row["id"] == "A-02":
            allowed.add("exempt")
        require(row["decision"] in allowed, "Invalid approval decision")
        if row["decision"] not in {"approved", "exempt"}:
            blockers.append(row["id"])
            continue
        for field in ("reviewer", "date", "evidence_ref"):
            require(
                isinstance(row.get(field), str) and row[field].strip(),
                f"{row['id']}: approval lacks {field}",
            )
        require(
            date.fromisoformat(row["date"]) <= datetime.now(UTC).astimezone().date(),
            "Future approval date",
        )
    return blockers


def check_dataset(dataset):
    require(
        set(dataset) == {"dataset_version", "protocol_version", "records"},
        "Invalid dataset fields",
    )
    require(
        isinstance(dataset["dataset_version"], str)
        and dataset["dataset_version"].strip(),
        "Missing dataset version",
    )
    require(dataset["protocol_version"] == PROTOCOL, "Dataset protocol mismatch")
    records = dataset["records"]
    require(isinstance(records, list) and records, "Empty dataset")
    fields = {
        "participant_id",
        "clip_id",
        "protocol_version",
        "consent_id",
        "consent_status",
        "view",
        "pace",
        "split",
        "file_sha256",
        "duration_seconds",
        "fps",
        "usable_frame_ratio",
        "step_count_manual",
        "walking_interval_seconds",
        "ground_truth",
    }
    gt_fields = {
        "method",
        "distance_m",
        "start_seconds",
        "end_seconds",
        "speed_mps",
        "markers_visible",
        "distance_verified",
        "reviewer_ids",
    }
    clips, hashes, groups, consent_groups = set(), set(), {}, {}
    for index, record in enumerate(records):
        context = f"Record {index + 1}"
        require(
            isinstance(record, dict) and set(record) == fields,
            f"{context}: invalid/missing fields; do not add identifying data",
        )
        pid, cid = record["participant_id"], record["clip_id"]
        require(
            isinstance(pid, str) and re.fullmatch(r"P\d{3}", pid),
            f"{context}: invalid participant code",
        )
        require(
            isinstance(cid, str) and re.fullmatch(re.escape(pid) + r"_T\d{2}", cid),
            f"{context}: invalid clip code",
        )
        require(cid not in clips, f"{context}: duplicate clip")
        clips.add(cid)
        digest = record["file_sha256"]
        require(
            isinstance(digest, str) and re.fullmatch(r"[0-9a-fA-F]{64}", digest),
            f"{context}: invalid SHA256",
        )
        require(digest.lower() not in hashes, f"{context}: duplicate video hash")
        hashes.add(digest.lower())
        require(record["protocol_version"] == PROTOCOL, f"{context}: protocol mismatch")
        consent = record["consent_id"]
        require(
            isinstance(consent, str) and re.fullmatch(r"C\d{3}", consent),
            f"{context}: missing consent reference",
        )
        require(
            record["consent_status"] == "accepted", f"{context}: consent not accepted"
        )
        require(
            consent_groups.setdefault(consent, pid) == pid,
            f"{context}: consent reused by different participant",
        )
        split = record["split"]
        require(split in {"train", "validation", "test"}, f"{context}: invalid split")
        require(
            groups.setdefault(pid, split) == split,
            f"{context}: participant leakage across splits",
        )
        require(
            record["view"] in {"side_left", "side_right"},
            f"{context}: unsupported view",
        )
        require(record["pace"] == "comfortable", f"{context}: unsupported pace")
        duration, fps, ratio = (
            record[k] for k in ("duration_seconds", "fps", "usable_frame_ratio")
        )
        require(
            number(duration) and 10 <= duration <= 15,
            f"{context}: duration outside protocol",
        )
        require(number(fps) and 29 <= fps <= 61, f"{context}: invalid FPS")
        require(
            number(ratio) and 0.7 <= ratio <= 1, f"{context}: inadequate pose coverage"
        )
        steps, interval = (
            record["step_count_manual"],
            record["walking_interval_seconds"],
        )
        require(
            type(steps) is int and steps >= 6, f"{context}: insufficient manual steps"
        )
        require(
            number(interval) and 0 < interval <= duration,
            f"{context}: invalid walking interval",
        )
        gt = record["ground_truth"]
        require(
            isinstance(gt, dict) and set(gt) == gt_fields,
            f"{context}: invalid reference fields",
        )
        require(
            gt["method"] == "marked_distance_timing",
            f"{context}: estimated or unsupported ground truth",
        )
        require(
            gt["markers_visible"] is True and gt["distance_verified"] is True,
            f"{context}: unverified distance/markers",
        )
        reviewers = gt["reviewer_ids"]
        require(
            isinstance(reviewers, list)
            and len(reviewers) == 2
            and all(
                isinstance(r, str) and re.fullmatch(r"R\d{2}", r) for r in reviewers
            )
            and len(set(reviewers)) == 2,
            f"{context}: two independent reviewer codes required",
        )
        distance, start, end, speed = (
            gt[k] for k in ("distance_m", "start_seconds", "end_seconds", "speed_mps")
        )
        require(
            all(number(v) for v in (distance, start, end, speed)),
            f"{context}: nonfinite/nonnumeric reference",
        )
        require(
            0 < distance <= 10 and 0 <= start < end <= duration and speed > 0,
            f"{context}: impossible reference boundaries",
        )
        require(
            math.isclose(interval, end - start, abs_tol=0.001),
            f"{context}: annotation intervals differ",
        )
        require(
            math.isclose(speed, distance / (end - start), rel_tol=0.001),
            f"{context}: incorrect speed arithmetic",
        )
    return {
        "clips": len(clips),
        "participants": len(groups),
        "splits": sorted(set(groups.values())),
    }


def main(argv=None):
    parser = argparse.ArgumentParser(description=__doc__)
    action = parser.add_mutually_exclusive_group(required=True)
    action.add_argument("--check", action="store_true")
    action.add_argument("--readiness", action="store_true")
    action.add_argument("--dataset", type=Path)
    parser.add_argument("--approvals", type=Path, default=PLAN / "approvals.json")
    args = parser.parse_args(argv)
    try:
        if args.check:
            count = check_requirements(read_json(PLAN / "requirements.json"))
            approval_blockers(read_json(args.approvals))
            print(
                f"PASS: {count} requirements have owners, acceptance tests and evidence references."
            )
            print(
                "This validates preparation structure, not product acceptance or ethics approval."
            )
            return 0
        blockers = approval_blockers(read_json(args.approvals))
        if blockers:
            print("NOT READY: human approval pending: " + ", ".join(blockers))
            return 2
        if args.dataset:
            summary = check_dataset(read_json(args.dataset))
            print("PASS: curated metadata checks: " + json.dumps(summary))
        else:
            print(
                "Approval fields complete; authentic documents and consent still require human verification."
            )
        return 0
    except (ValueError, TypeError, KeyError, OSError) as error:
        print(f"INVALID: {error}", file=sys.stderr)
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
