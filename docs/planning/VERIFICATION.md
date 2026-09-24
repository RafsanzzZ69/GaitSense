# Step 1 and 2 preparation verification

Date: 23 September 2026. All results below observed locally on Windows.

| Check | Result |
| --- | --- |
| Checklist structure, complete 42-ID coverage, owners, dependencies, evidence paths | Passed |
| Study validator unit/CLI tests | 15 passed |
| Ruff formatting/lint for new study tools | Passed |
| Existing frontend tests | 16 passed |
| Frontend TypeScript check | Passed |
| Isolated backend tests including explicit real walking-video fixture | 23 passed |
| Real study readiness register | Correctly blocked: A-01 through A-05 pending |
| Private research directory ignored by Git | Verified |

Tests cover valid synthetic metadata; withdrawn/missing consent; weak estimated
labels; duplicate clips/video hashes; reused consent references; participant
split leakage; malformed numbers, timestamps, quality and speed arithmetic;
missing/duplicate/future approvals; unsupported views and identifying fields;
checklist coverage/cycles; strict JSON; CLI pass/reject behavior.

Synthetic approved records exist only in temporary unit-test fixtures and are
removed by the test harness. They do not alter the real pending approvals file.
No real consent, ethical approval or model validity is inferred from tests.
Backend integration tests used a disposable local database; original research
videos and Atlas data were not modified by this preparation task.

CI definition was added, but a remote GitHub Actions run was not executed.
Existing backend dependency deprecation warnings and frontend Node module-type
warnings remain non-fatal. No claim of universally error-free operation is made.

## Completed preparation

- Requirement traceability and readable checklist; accountable role assignments.
- Offline-first architecture decision with explicit unresolved stack approval.
- Draft participant protocol, capture and independent-reference procedures.
- Prediction-target and participant-grouped evaluation plan.
- Draft consent information, optional retention choices and withdrawal handling.
- Dataset contract, legacy-data quarantine policy and metadata gates.

## Still required before recruitment / main dataset collection

1. Supervisor accepts scope and stack/deviation decision (A-01).
2. Institution gives ethics approval or documented exemption (A-02).
3. Reviewers finalize protocol, sample size, endpoints and thresholds (A-03).
4. Consent language, contact fields, exact retention/withdrawal terms and any
   needed translation are completed and reviewed (A-04).
5. Actual team members accept the owner roles/access responsibilities (A-05).

Step 1 and 2 technical preparation is substantially drafted and tested, not
fully approved. Next engineering milestone: offline Android capture/MediaPipe/
local-storage feasibility spike, alongside human review of this package.
