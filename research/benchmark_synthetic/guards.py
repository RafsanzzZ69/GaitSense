"""Endpoint-independent SYN fixtures; standard library, no IO or model fitting.

These are bounded, in-process safety checks, not authenticity verification,
production V2, approved partitions or a sandbox for arbitrary Python code.
"""

from dataclasses import dataclass, replace
import hashlib
import json
import math
import re
import statistics

VERSION = "benchmark-safety-synthetic-1"
ROLES = ("development", "validation", "final_test")
STAGES = ("selector", "imputer", "scaler")


class SafetyError(ValueError):
    def __init__(self, code):
        self.code = code
        super().__init__(code)


def require(ok, code):
    if not ok:
        raise SafetyError(code)


def identifier(value):
    return type(value) is str and re.fullmatch(r"SYN-[A-Z0-9-]+", value) is not None


def numeric(value):
    try:
        return type(value) in (int, float) and math.isfinite(value)
    except OverflowError:
        return False


def opaque(value):
    return numeric(value) or (type(value) is str and bool(value.strip()))


def canonical(value):
    return json.dumps(value, sort_keys=True, separators=(",", ":"), allow_nan=False)


def digest(value):
    return hashlib.sha256(canonical(value).encode("utf-8")).hexdigest()


@dataclass(frozen=True)
class Reference:
    eligibility: str
    value: object


@dataclass(frozen=True)
class SyntheticRow:
    row_id: str
    participant_id: str
    session_id: str
    trial_id: str
    attempt_id: str
    media_id: str
    canonical_source_id: str
    features: tuple
    reference: Reference
    role: str
    evidence_kind: str = "synthetic"
    scientific_status: str = "NOT_EVALUATED"


def validate_rows(rows):
    """Fail closed before splitting/fitting; never infer identity from a name."""
    require(type(rows) is tuple and bool(rows), "ROWS")
    row_ids, participant_roles = set(), {}
    sessions, trials, attempts, media, sources = {}, {}, {}, {}, {}
    names = None

    def ownership(table, key, owner, code):
        require(key not in table or table[key] == owner, code)
        table[key] = owner

    for row in rows:
        require(type(row) is SyntheticRow, "ROW_TYPE")
        require(row.evidence_kind == "synthetic" and
                row.scientific_status == "NOT_EVALUATED", "SYNTHETIC_ONLY")
        require(identifier(row.participant_id), "PARTICIPANT_ID")
        for key in (row.row_id, row.session_id, row.trial_id, row.attempt_id,
                    row.media_id, row.canonical_source_id):
            require(identifier(key), "IDENTITY")
        require(row.row_id not in row_ids, "DUPLICATE_ROW")
        row_ids.add(row.row_id)
        require(row.role in ROLES, "ROLE")
        ownership(participant_roles, row.participant_id, row.role, "PARTICIPANT_OVERLAP")
        ownership(sessions, row.session_id, row.participant_id, "SESSION_OWNERSHIP")
        ownership(trials, row.trial_id, (row.participant_id, row.session_id), "TRIAL_OWNERSHIP")
        ownership(attempts, row.attempt_id,
                  (row.participant_id, row.session_id, row.trial_id), "ATTEMPT_OWNERSHIP")
        # Same source/content token must retain both person and protected role.
        ownership(sources, row.canonical_source_id,
                  (row.participant_id, row.role), "SOURCE_OVERLAP")
        ownership(media, row.media_id,
                  (row.participant_id, row.role, row.canonical_source_id), "MEDIA_OVERLAP")
        require(type(row.features) is tuple and bool(row.features), "FEATURES")
        feature_names = []
        for pair in row.features:
            require(type(pair) is tuple and len(pair) == 2, "FEATURES")
            name, value = pair
            require(type(name) is str and re.fullmatch(r"f[0-9]+", name), "FEATURE_NAME")
            require(value is None or numeric(value), "FEATURE_VALUE")
            feature_names.append(name)
        require(len(set(feature_names)) == len(feature_names), "FEATURE_DUPLICATE")
        schema = tuple(sorted(feature_names))
        require(names is None or names == schema, "FEATURE_SCHEMA")
        names = schema
        require(type(row.reference) is Reference, "REFERENCE")
        require(row.reference.eligibility in ("eligible", "unavailable", "pending", "rejected"),
                "REFERENCE")
        if row.reference.eligibility == "eligible":
            require(opaque(row.reference.value), "REFERENCE_VALUE")
        else:
            require(row.reference.value is None, "REFERENCE_VALUE")
    return tuple(sorted(participant_roles.items()))


@dataclass(frozen=True)
class SplitPlan:
    seed: int
    counts: tuple
    fixed_final_test: tuple
    assignments: tuple
    input_identity_digest: str

    def serialize(self):
        return canonical({"schema": VERSION, "evidence_kind": "synthetic",
                          "scientific_status": "NOT_EVALUATED", "seed": self.seed,
                          "counts": self.counts, "fixed_final_test": self.fixed_final_test,
                          "assignments": self.assignments,
                          "input_identity_digest": self.input_identity_digest})


def grouped_split(rows, *, seed, counts, fixed_final_test=None):
    """Caller-supplied SYN counts; stable SHA-256 ranking, no approved allocation."""
    people = [pid for pid, _ in validate_rows(rows)]
    require(type(seed) is int, "SEED")
    require(type(counts) is dict and set(counts) == set(ROLES), "COUNTS")
    require(all(type(n) is int and n >= 0 for n in counts.values()) and
            sum(counts.values()) == len(people), "COUNTS")
    require(fixed_final_test is None or type(fixed_final_test) is tuple, "FIXED_TEST")
    require(fixed_final_test is None or all(identifier(pid) for pid in fixed_final_test),
            "FIXED_TEST")
    fixed = tuple(sorted(fixed_final_test or ()))
    if fixed_final_test is not None:
        require(len(set(fixed)) == len(fixed) and set(fixed) <= set(people) and
                len(fixed) == counts["final_test"], "FIXED_TEST")
    ranked = sorted((pid for pid in people if pid not in fixed),
                    key=lambda pid: (digest([VERSION, seed, pid]), pid))
    allocation = {pid: "final_test" for pid in fixed}
    cursor = 0
    for role in ROLES:
        count = 0 if role == "final_test" and fixed_final_test is not None else counts[role]
        allocation.update((pid, role) for pid in ranked[cursor:cursor + count])
        cursor += count
    require(cursor == len(ranked), "COUNTS")
    result = tuple(sorted((replace(r, role=allocation[r.participant_id]) for r in rows),
                          key=lambda r: r.row_id))
    validate_rows(result)
    # This identifies the canonical ownership input, not features/references/data bytes.
    identity = sorted((r.row_id, r.participant_id, r.session_id, r.trial_id,
                       r.attempt_id, r.media_id, r.canonical_source_id) for r in rows)
    plan = SplitPlan(seed, tuple((r, counts[r]) for r in ROLES), fixed,
                     tuple(sorted(allocation.items())), digest(identity))
    return result, plan


@dataclass(frozen=True)
class FitRead:
    stage: str
    row_id: str
    feature_names: tuple


class FitReader:
    """Feature-only reads recorded at access; references never returned to fits."""
    def __init__(self, rows, *, fit_participants=None):
        participants = dict(validate_rows(rows))
        if fit_participants is None:
            requested = tuple(pid for pid, role in participants.items() if role == "development")
        else:
            require(type(fit_participants) is tuple, "FIT_SCOPE")
            requested = fit_participants
        require(all(identifier(pid) for pid in requested), "FIT_SCOPE")
        require(bool(requested) and len(set(requested)) == len(requested) and
                all(participants.get(pid) == "development" for pid in requested), "FIT_SCOPE")
        self._rows = {r.row_id: r for r in rows}
        self._allowed = frozenset(r.row_id for r in rows if r.participant_id in requested)
        self._reads = []
        self.participants = tuple(sorted(requested))

    @property
    def row_ids(self):
        return tuple(sorted(self._allowed))

    @property
    def trace(self):
        return tuple(self._reads)

    def read(self, stage, row_id, names=None):
        require(stage in STAGES, "FIT_STAGE")
        require(identifier(row_id) and row_id in self._allowed, "FIT_SCOPE")
        values = dict(self._rows[row_id].features)
        selected = tuple(sorted(values)) if names is None else names
        require(type(selected) is tuple and set(selected) <= set(values), "FEATURE_SCHEMA")
        self._reads.append(FitRead(stage, row_id, selected))
        return tuple(values[name] for name in selected)


@dataclass(frozen=True)
class FittedPreprocessor:
    schema: tuple
    selected: tuple
    medians: tuple
    means: tuple
    scales: tuple
    fit_participants: tuple
    fit_reads: tuple

    def transform(self, rows):
        validate_rows(rows)
        output = []
        for row in sorted(rows, key=lambda r: r.row_id):
            values = dict(row.features)
            require(tuple(sorted(values)) == self.schema, "FEATURE_SCHEMA")
            transformed = tuple(((values[n] if values[n] is not None else self.medians[i]) -
                                 self.means[i]) / self.scales[i]
                                for i, n in enumerate(self.selected))
            require(all(numeric(v) for v in transformed), "TRANSFORM_VALUE")
            output.append((row.row_id, transformed))
        return tuple(output)


def fit_preprocessor(rows, *, min_available_fraction, fit_participants=None):
    """Toy availability -> median -> population scaler; no predictive model fit."""
    require(numeric(min_available_fraction) and 0 < min_available_fraction <= 1, "FRACTION")
    reader = FitReader(rows, fit_participants=fit_participants)
    schema = tuple(sorted(dict(rows[0].features)))  # validated fixed schema, not availability
    selection_rows = [reader.read("selector", rid, schema) for rid in reader.row_ids]
    selected = tuple(name for i, name in enumerate(schema)
                     if sum(v[i] is not None for v in selection_rows) / len(selection_rows)
                     >= min_available_fraction)
    require(bool(selected), "NO_TRAIN_FEATURES")
    imputer_rows = [reader.read("imputer", rid, selected) for rid in reader.row_ids]
    medians = tuple(statistics.median(v[i] for v in imputer_rows if v[i] is not None)
                    for i in range(len(selected)))
    scaler_rows = [reader.read("scaler", rid, selected) for rid in reader.row_ids]
    filled = [tuple(medians[i] if v is None else v for i, v in enumerate(row))
              for row in scaler_rows]
    try:
        means = tuple(math.fsum(v[i] for v in filled) / len(filled) for i in range(len(selected)))
        scales = tuple(math.sqrt(math.fsum((v[i] - means[i]) ** 2 for v in filled) /
                                 len(filled)) or 1.0 for i in range(len(selected)))
    except (OverflowError, ValueError):
        raise SafetyError("FIT_STATISTIC") from None
    require(all(numeric(v) for v in medians + means + scales), "FIT_STATISTIC")
    return FittedPreprocessor(schema, selected, medians, means, scales,
                              reader.participants, reader.trace)


def reference_digest(rows):
    validate_rows(rows)
    return digest(sorted((r.row_id, r.reference.eligibility, r.reference.value) for r in rows))


def assert_references_unchanged(expected, rows):
    require(reference_digest(rows) == expected, "REFERENCE_MUTATION")


@dataclass(frozen=True)
class Prediction:
    row_id: str
    model_id: str
    status: str
    value: object
    reason: object


@dataclass(frozen=True)
class PredictionBundle:
    rows: tuple
    predictions: tuple
    reference_digest: str


def attach_predictions(rows, payloads):
    """Strict prediction namespace; no mutation, merge or reference-repair hook."""
    before = reference_digest(rows)
    require(type(payloads) is tuple, "PREDICTIONS")
    ids = {r.row_id for r in rows}
    seen, result = set(), []
    for p in payloads:
        require(type(p) is dict and set(p) == {"row_id", "model_id", "status", "value", "reason"},
                "PREDICTION_SHAPE")
        require(identifier(p["row_id"]) and p["row_id"] in ids and
                identifier(p["model_id"]), "PREDICTION_ID")
        key = (p["row_id"], p["model_id"])
        require(key not in seen, "PREDICTION_DUPLICATE")
        seen.add(key)
        require(p["status"] in ("available", "unavailable", "failed"), "PREDICTION_STATUS")
        if p["status"] == "available":
            require(opaque(p["value"]) and p["reason"] is None, "PREDICTION_VALUE")
        else:
            require(p["value"] is None and type(p["reason"]) is str and bool(p["reason"].strip()),
                    "PREDICTION_VALUE")
        result.append(Prediction(**p))
    assert_references_unchanged(before, rows)
    return PredictionBundle(rows, tuple(sorted(result, key=lambda p: (p.row_id, p.model_id))), before)
