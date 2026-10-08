"""Six wholly invented rows / five people; no files, media or clinical meaning."""

from .guards import Reference, SyntheticRow


def cohort():
    # f1 is absent from ALL development rows, present in ALL held-out rows.
    # f0 development values are 2, missing, 6: median 4, filled mean 4.
    specifications = (
        (1, 1, "development", 2, None, 4, Reference("eligible", "SYN-LABEL-A")),
        (2, 1, "development", None, None, 4, Reference("pending", None)),
        (3, 2, "development", 6, None, 4, Reference("eligible", 0)),
        (4, 3, "validation", 100, 10, 10, Reference("eligible", 42)),
        (5, 4, "final_test", 200, 20, 20, Reference("unavailable", None)),
        (6, 5, "final_test", 300, 30, 30, Reference("rejected", None)),
    )
    return tuple(SyntheticRow(
        row_id=f"SYN-R{rid}", participant_id=f"SYN-P{pid}",
        session_id=f"SYN-S{pid}", trial_id=f"SYN-T{rid}",
        attempt_id=f"SYN-A{rid}", media_id=f"SYN-M{rid}",
        canonical_source_id=f"SYN-C{rid}", features=(("f0", f0), ("f1", f1), ("f2", f2)),
        reference=reference, role=role,
    ) for rid, pid, role, f0, f1, f2, reference in specifications)


def prediction(row_id="SYN-R5", value=99):
    return {"row_id": row_id, "model_id": "SYN-MODEL-PLACEHOLDER",
            "status": "available", "value": value, "reason": None}
