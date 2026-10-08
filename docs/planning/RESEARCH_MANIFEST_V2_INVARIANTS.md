# Research Manifest V2 invariants — synthetic proposal subset

Sprint 6 Task 4 · 8 October 2026 · **PROPOSAL ONLY; NOT A PRODUCTION SCHEMA**.
Scientific status: **NOT_EVALUATED**. Read the [V2 proposal](RESEARCH_MANIFEST_V2_PROPOSAL.md),
[timing/annotation specification](REFERENCE_TIMING_AND_ANNOTATION_QUALIFICATION.md),
[SOP](WALKING_SPEED_REFERENCE_SOP_DRAFT.md), [V1 contract](DATASET_CONTRACT.md) and
[supervisor conflicts](ML_SUPERVISOR_DECISION_BRIEF.md#conflicts-requiring-explicit-resolution).
The [V1 checker](../../research/study/check.py) remains unchanged.

## 1. Two different results and the synthetic boundary

**Ledger validity** means recorded facts/statuses are internally consistent.
It can PASS with a rejected/unavailable reference, a failed attempt or a withdrawn
person, provided no fabricated accepted target or scientific-use request appears.
**Scientific inclusion** additionally needs authentic governance, known identity,
accepted qualified reference, supported input and reviewed partition/run rules.
Synthetic entries never qualify for scientific training/evaluation.

The [isolated validator](../../research/study/check_v2_proposal.py) returns first
error code or a bounded ledger PASS plus simulated reference-eligible and paired
attempt lists. `use_requested` is a **simulated inclusion-gate test**, not an actual
training/evaluation request. Pair eligibility additionally requires a succeeded
processing status and separate available synthetic prediction. Reference yield
does not depend on model success. Training-input eligibility (without predictions)
needs its own future feature contract; paired eligibility is not that contract.

Its fixture projection uses flattened attempt identities, linked assets and
derived artifacts, participants, planned trials and simulated runs. It is not
the final V2 serialization. It rejects unknown keys within this bounded projection.
Strict projection shapes must not be confused with approved production JSON Schema.
All fake IDs/pointers begin `SYN-`, `evidence_kind=synthetic`, schema discriminator
`gaitsense-v2-invariant-fixture-0.1`, status `NOT_EVALUATED`; no media is loaded,
no real manifests imported and no V1 dependencies invoked. Prefixes/flags do not
prove authenticity or permit relabeling real data as synthetic.

## 2. Future machine-checkable rules and executable coverage

| Group | Future invariant | Bounded executable coverage |
| --- | --- | --- |
| I01 Identity | Required participant/session/trial/attempt IDs, uniqueness and foreign keys; one participant per session, session per trial, trial per attempt; pseudonymous namespace | Fake-code IDs, complete chain ownership, duplicates; unknown/missing participant blocks simulated use |
| I02 Identity provenance | Never infer person from filename or app UUID; private registry attests linkage | `identity_status=known` required for inclusion; real registry authenticity **not tested** |
| I03 Planned lifecycle | Closed unattempted trial has zero attempts and reason; attempted has actual attempts | Planned-trial ownership/count/reason checks; no invented media for failure |
| I04 Attempts/replacements | Each attempt retains independent lifecycle/capture/processing/reference axes; same-trial acyclic replacement links, original retained, decision/reason | Missing/self/cyclic/cross-trial originals fail; terminal failures require reason; replacement does not overwrite original |
| I05 Source integrity | Completed capture requires actual source provenance; absent bytes stay absent | Captured fake records require linked original asset; unavailable source blocks accepted reference; digest shape only, no actual bytes |
| I06 Lineage | Aliases same bytes, reviewed duplicates/common origin; re-encoded/derived/overlay child linked to original; no asset/lineage across scientific partitions | SHA-256 equality, explicit parent links, cycles, inherited content lineage and same-attempt ownership; different digests do not evade known lineage |
| I07 Person grouping | Sessions/trials/attempts/videos/frames/windows/augmentations inherit participant outer partition | Participant exclusivity and derived ownership/partition checks; no random frame split |
| I08 Reference states | V2 status and proposed workflow agree; only accepted has final boundary/duration/speed/uncertainty; rejected/unavailable reason retained | Workflow map, missing observer states, final nulls, prediction namespace exclusion |
| I09 Independent reference | Qualified A/B timing, measured course distance, locked independent blinded submissions, uncertainty, provenance, annotation policy and version | Fake qualification/decision pointers, rational PTS mapping or simulated external clock, observer compatibility and positive finite arithmetic |
| I10 Acceptance | Frozen approved agreement or adjudication rule; keep A/B and third raw submissions; derive final speed consistently | Simulated policy only: threshold, agreement mean or third boundaries; pending/missing/invalid adjudication blocks acceptance |
| I11 Outer split | One participant in train/validation/test; test membership versioned/frozen; unknown blocks final evaluation; prior frozen test snapshot immutable | Frozen fake split version and membership equality; null allowed only for ledger intake with no use request |
| I12 ML leakage | Reference distance/duration/target/decisions/identity not predictors; train-only fit/preprocessing, validation-only tuning; test never selection | Synthetic run input denylist and fit/tune participant checks; indirect target encodings and actual fitted transforms **not proved** |
| I13 Versions | Dataset/annotation/feature/preprocessing/split/model-run/source/protocol versions, artifact hashes and immutable corrections | Required fake version pointers; run version and lineage; full artifact/revision invalidation graph **future** |
| I14 Governance | Eligible purpose/consent, institutional decision, withdrawal/access/retention references; no identifying consent contents in ML manifest | Simulated permission/withdrawal gate and opaque pointers; no authentic approval or deletion audit |

No same-origin content may cross partitions, including re-encodes with different
hashes. A file alias is not a new physical attempt. Contradictory person/attempt
ownership quarantines content. Hash equality detects exact duplicates; different
hashes do not prove distinct media. Unknown/undeclared re-encodes require future
manual/content-lineage review and cannot be discovered by this metadata validator.
Hashes prove byte integrity only when checked against bytes, not consent, anatomy
or physical timing. Overlays are derived files, never independent reference images.

Reference distance/crossing duration must remain independent label inputs.
Predictions reside in a separate attempt `prediction` object; reference objects
cannot contain predictions. Prediction availability never manufactures a label.
Unavailable prediction is not zero speed. In real runs, fit/tune/selection and
early-stopping artifacts must attest no test access, beyond membership lists.

## 3. Fixture projection and arithmetic convention

Each fixture envelope has `fixture_id`, `description`, exact `expected` result and
`manifest`. The manifest contains fake versions, simulated policy, participants,
planned trials, attempts, assets, derived records, simulated runs and a frozen
test-participant list. Observer boundaries carry integer ticks and rational
timebase/origin for A or event IDs for B, plus normalized seconds. Frames/windows/
augmentations link an asset and attempt, and inherit identity/partition.

The code uses exact rational arithmetic on decimal JSON numbers for fixture
consistency (e.g. 6 synthetic metres / 5 seconds = 1.2 m/s). These are synthetic
test values, **not a proposed final course distance**. No production tolerance,
uncertainty confidence level, physical error limit or floating serialization
policy is selected. A future real schema must review numerical rounding and
uncertainty conventions instead of adopting exact-decimal comparisons blindly.

Simulated governance uses `simulated_permitted`, `simulated_pending`,
`simulated_withdrawn`; it cannot be mistaken for an actual `eligible` determination.
`simulated_policy` is simulated or pending, never approved. Raw A/B differences
are derived by the validator; a final storage representation remains future work.
Raw submitted observations here are complete or null; partial boundaries/confidence
scales, observer repeat/readiness evidence, per-sample capture geometry and full
retention/deletion structures are documented future checks, not implemented V2.

## 4. Revisions, failures and partition rules

Keep all failed/rejected/partial attempts in denominators and each replacement as
a distinct attempt. A successful replacement cannot erase or relabel the original.
Non-attempted scheduled trials are separate from capture failures. A valid label
with processing failure stays in reference yield; no paired result is fabricated.
Withdrawn data is excluded regardless of reference acceptance; retain only legally
permitted accounting and complete approved derivative/replica deletion.

After reference invalidation, create a new revision with null current final label,
reason and dependency revocation/recomputation. Do not use stale labels/features/
metrics. After method changes, requalification and versioned review precede reuse.
Rejected/unavailable current states can retain completed adjudication and original
observer submissions; do not erase those facts to make a null target valid.
The synthetic examples exercise current-state gates; an actual append-only revision,
deletion and downstream invalidation engine is **not implemented**.

All person-owned children stay in the same outer partition. Development CV folds
are a separate versioned concept inside train/validation, never reassignment of
held-out people. Pilot people used to design reference/model rules are excluded
from final held-out testing; pilot training reuse remains a decision. Freeze
test-membership version before selection; an altered inspected test becomes
development evidence and needs a new independent evaluation, not an in-place edit.

## 5. Running and interpreting the bounded tests

From repository root:

```powershell
python -B research/study/check_v2_proposal.py
python -B -m unittest discover -s research/study/tests -p test_v2_proposal.py
```

The [catalog](../../research/study/fixtures/v2-proposal/README.md) lists every JSON
case and its exact expected first-error code or PASS and simulated eligible lists.
No CLI path/import/approval arguments exist. The runner reads only regular JSON
fixtures under its fixed directory and refuses symlinks; JSON duplicate keys,
NaN/infinity, invalid types, unknown keys and non-synthetic headers fail closed.
Fixture expectations are compared by the runner, never used to validate facts.
PASS and expected FAIL are both successful tests only when the exact oracle matches.

These are metadata/logic tests, not approved research authorization, verified media,
empirical speed accuracy, validated observer performance or Android acceptance.
The existing V1 suite and unrelated research reconciliation remain separate.

## 6. Pending review and both project tracks

Course distance, technology, observer thresholds/adjudication, pilot/cohort, model
count and backbone scope, governance/consent/retention, public datasets and device
requirements remain pending. Older study/cohort/view/retention/clock/schema conflicts
and their owners/gates remain in the [qualification conflict table](REFERENCE_TIMING_AND_ANNOTATION_QUALIFICATION.md#7-conflicts-owners-and-collection-gates).
No original protocol/checker/approval file is rewritten by this package.

App session UUID remains a separate optional mapping, not research identity;
future approved linkage is necessary before real collection. Application physical
acceptance, reliability, UX/accessibility, model parity/integration and device
runtime testing continue equally alongside research decisions, qualified references,
governance, pilot/main cohort, benchmarking, held-out evaluation and novelty review.
This local package activates neither research collection nor app acceptance.

## 7. Local verification record

The isolated runner matched **all 51 hand-declared JSON outcomes: 23 ledger PASS,
28 expected FAIL, zero mismatches**. All JSON parsed with duplicate-key/nonfinite
rejection. Expected states, null labels and simulated eligible lists matched the
validator. The [focused tests](../../research/study/tests/test_v2_proposal.py)
passed **15 tests**, including rational/signed clock conversion, malformed inputs,
external-path refusal, target leakage, replacement cycles, all derived grouping
kinds and preservation of adjudication after rejection/invalidation.

These results qualify only this bounded synthetic logic. No decoder/instrument,
real observer, reference label, ethics decision or scientific model is qualified.
The simulated 0.05-second parameter is not an approved policy.

Created files only: this document, the timing/annotation document, the separate
proposal validator, its focused tests and the fixture README plus 51 JSON files
listed by exact filename in its catalog. No existing files were edited. All 274
pre-existing tracked/untracked/protected file digests matched the starting snapshot,
including V1 checker/protocols, original Sprint 6 documents, unrelated reconciliation,
the preserved Android test, APK verification script and release APK. Internal links
and new-file whitespace checks passed; `git diff --check` passed. HEAD remains
`3c24741dfb7ee189ad5247a26ce91f0d79551d06` on `main`; nothing staged/committed/pushed.

No Android/production behavior, real participant/video data, training, model
artifacts, APK build, approved protocol, V1 manifest/checker or approval register
was changed. App/ML tracks and pending physical acceptance remain independent.
