# Requirements and study preparation baseline

Version 1.0-draft, 23 September 2026. Technical preparation, not ethics approval.

This package implements serial-plan steps 1 and 2. It does not claim that the
offline app, trained model, research study or acceptance tests are completed.
The requirements-analysis PDF (13 August 2026, sections 2-24) is the primary
scope; the roadmap (9 August 2026) supplies additional research/engineering gates.
Source PDFs remain in Downloads; their text is not copied into this package.

## Read in order

1. [Architecture decision](ARCHITECTURE.md): preserve existing work, offline core.
2. [Readable checklist](CHECKLIST.md) and [full acceptance matrix](requirements.json): IDs, owner roles, status, evidence,
   dependency and executable/manual acceptance procedure for every requirement.
3. [Study protocol](STUDY_PROTOCOL.md): recording, eligibility and ground truth.
4. [Consent draft](CONSENT_DRAFT.md): participant-facing information and choices.
5. [Dataset contract](DATASET_CONTRACT.md): fields, provenance, splits, retention.
6. [Approvals register](approvals.json): external decisions are honestly pending.
7. [Verification results](VERIFICATION.md): tests run and remaining human gates.

Owners are accountable ROLE assignments, not claims that people have accepted
the roles. The team lead must assign actual people before collection. Reviewers
must sign off protocol, consent, targets and institutional ethics determination.

## Reproducible checks (Python standard library only)

From the repository root:

```powershell
backend/.venv/Scripts/python.exe research/study/check.py --check
backend/.venv/Scripts/python.exe -m unittest discover -s research/study/tests -v
backend/.venv/Scripts/python.exe research/study/check.py --readiness
```

`--check` verifies checklist integrity and referenced evidence; it does NOT run
all product acceptance tests. Unit tests exercise the dataset rejection rules.
`--readiness` returns exit code 2 while required approvals are pending. That is
an expected safety gate, not an application error. Exit 1 means malformed input
or invalid checklist/dataset. Exit 0 means the requested checks passed only.

After real approvals are recorded in a private copy of the approval register:

```powershell
backend/.venv/Scripts/python.exe research/study/check.py --dataset research/private/dataset.json --approvals research/private/approvals.json
```

The checker validates metadata, NOT actual signatures, video contents, true
distance, examiner agreement or scientific validity. A human audit remains
mandatory. Never mark approval based solely on this checker.

## Scope and completion rules

- `partial` includes server-only equivalents of required offline phone features.
- `not_started` means no accepted implementation/evidence for this requirement.
- `excluded` follows explicit exclusions, not silently dropped requirements.
- `stretch` remains on the backlog; it cannot delay core acceptance.
- An item becomes `verified` only with dated evidence and its acceptance test.
- Clinical diagnosis, universal health scores, fall risk and hazardous simulated
  gait tasks are not study outputs. No signup or cloud dependency in offline core.
- Database schemas and public demo are unchanged by this preparation sprint.

## Immediate handoff

The next engineering task is a two-device Android feasibility spike: capture,
bundled MediaPipe, local landmarks, airplane mode. In parallel, obtain review of
this protocol and consent draft. Then record a small approved protocol pilot,
annotate it and repair/validate features BEFORE collecting the main cohort.

The previous 45% full-project estimate in PROJECT_PROGRESS_2026-09-23.md refers
to an earlier web-weighted scope. Against the offline requirements, the current
planning estimate is 25-30%; this document package is not more model validation.
