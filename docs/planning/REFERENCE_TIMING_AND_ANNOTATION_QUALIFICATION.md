# Reference timing and annotation qualification — synthetic review package

Sprint 6 Task 4 · 8 October 2026 · **PROPOSAL ONLY / SYNTHETIC ONLY**.
Scientific status: **NOT_EVALUATED**. No clock, collection protocol, observer,
research label or institutional permission is qualified by this package.
Model: GPT-6.1 Sol; reasoning: High. This task needs no phone, engineering video
or research dataset. All examples are fake; no real media is read.

Read the [speed SOP](WALKING_SPEED_REFERENCE_SOP_DRAFT.md),
[V2 proposal](RESEARCH_MANIFEST_V2_PROPOSAL.md),
[invariants](RESEARCH_MANIFEST_V2_INVARIANTS.md),
[supervisor brief](ML_SUPERVISOR_DECISION_BRIEF.md) and
[audit](ML_THESIS_READINESS_AND_EXPERIMENT_PLAN.md). Neither their pending
decisions nor the [V1 checker](../../research/study/check.py) is amended here.

## 1. Timing classes and the future qualification gate

| Class / fixture token | Meaning | Scientific speed-label eligibility |
| --- | --- | --- |
| A / `decoded_pts` | Qualified decoded-frame presentation ticks, rational timebase, documented origin, source/frame correspondence and conversion | Candidate route only after independently reviewed qualification and protocol approval |
| B / `external_sync` | Independently synchronized external timing, with calibrated clock, common crossing definition, clock mapping, offset/drift and uncertainty | Candidate route only after independent review of calibration/synchronization and protocol approval |
| C / `nominal_fps` | Frame ordinal divided by nominal/reported FPS | Diagnostic only here; ineligible. Any future exception needs a separately approved, evidenced policy; never rename it PTS |
| D / `android_requested` | Android frame-selection request / pose VIDEO context timestamp | Ineligible physical reference clock; remains an engineering sampling clock |
| E / `unknown` | Absent, unsupported or unqualified timing | Ineligible; preserve missingness and reason |

Class A is not merely a field called `pts`. Qualification must demonstrate
source integrity and frame-to-presentation-time mapping, rational conversion,
signed origin/offset handling, monotonic order within valid segments, repeated
images/requests, variable frame rate, gaps, discontinuities and transcode mapping.
Different presentation instants may contain identical pixels. Decode timestamps
are not interchangeable with presentation timestamps without qualified mapping.
Do not select a decoder technology in this specification.

For B, demonstrate calibration and independent boundary signals, correspondence
to the same attempted passage, synchronization before/after the passage, offset
and drift, resolution, uncertainty and discontinuity handling. A second phone
or device clock is not automatically synchronized. Both observers must refer
to the same source evidence and common qualified clock. Different clocks require
an independently qualified mapping first; matching class names is insufficient.

Future evidence dossier: tool/method/version, source and frame/boundary identities,
raw clock records, timebase and origin or calibration/mapping, measured-course
verification, crossing-rule version, uncertainty method, known synthetic vectors,
failure tests and signed review/decision references. Reviewers must confirm actual
evidence, not simulated fields. Synthetic arithmetic checks below do not test a
decoder, camera, synchronization instrument or physical precision.

## 2. Separate annotation workflow from V2 reference status

The V2 proposal has `not_requested`, `pending`, `accepted`, `rejected`,
`unavailable` reference statuses. The following **additional proposed workflow
axis** refines pending; it does not silently expand the V2 status enum.

Every record has attempt/source linkage, annotation/revision/policy versions,
status and reason where incomplete. Observer fields may preserve partial or
rejected observations. Final fields are `accepted_start_seconds`,
`accepted_end_seconds`, `crossing_duration_seconds`, `final_speed_mps` and
`reference_uncertainty`; all are null until accepted.

| Workflow state | V2 status | Required facts | Prohibited / final speed | ML training/evaluation |
| --- | --- | --- | --- | --- |
| `not_requested` | not_requested | Reason, no submissions | Observers and all final fields absent/null | No |
| `pending` | pending | Reason; zero submissions or two locked submissions awaiting policy review | Any final label; resolved/not-required acceptance shortcut | No |
| `observer_a_only` | pending | A submission; missing B reason | B submission and any final label | No |
| `observer_b_only` | pending | B submission; missing A reason | A submission and any final label | No |
| `disagreement_pending` | pending | Two locked submissions, disagreement or incompatible/ambiguous evidence, review reason | Final label; resolved adjudication | No |
| `adjudication_required` | pending | Two locked submissions, documented trigger and pending/unresolved adjudication | Final label; not-required/resolved shortcut | No |
| `accepted` | accepted | Two distinct independent blinded locked valid submissions; qualified common clock/source; measured distance; frozen reviewed combination or resolved adjudication; acceptance provenance and uncertainty | Prediction-derived labels; final speed must equal measured distance / accepted duration | Only after separate identity/governance/partition/input gates; synthetic records never enter ML |
| `rejected` | rejected | Rejection reason, revision; retain actual raw evidence while permitted | Any final label, including zero speed | No |
| `unavailable` | unavailable | Missing/uncertain evidence reason; preserve partial submissions | Any final label, including zero speed | No |

Missing/unknown distance can exist in the failure ledger with no accepted target.
Do not use `0` to mean missing. A valid reference can coexist with failed pose
processing: preserve reference yield and report absent prediction coverage.

## 3. Observer invariants and unresolved policy

Each complete submission records observer code, start/end with units, source,
clock and timing class, raw boundary support, uncertainty/confidence and their
method, tool/annotation version, immutable submission pointer, locked flag,
initial independence and model-blinding. For qualified PTS, include tick/timebase/
origin conversion and frame IDs; for B include independent timing event IDs.
Partial/ambiguous submissions have explicit status/reason and null missing
boundaries; do not force them into a complete observation.

Complete valid submissions require finite `end > start`, positive duration and
nonnegative stated uncertainty with a method (zero is not a default).
Accepted distance is finite and positive, independently measured with method,
verification, course identity and uncertainty. Observers A/B are distinct,
initially mutually blinded, and never see predictions, extrema, overlays or
pose-assisted prelabels. Lock originals before revealing differences. The
adjudicator first submits independently, blinded to predictions; retain raw A/B,
third observations, rationale and decision separately.

On a common qualified clock compute signed and absolute A-minus-B start, end and
duration differences. If clocks are incompatible, disagreement is unavailable,
not zero. Store annotation-eligibility disagreement separately from timing.
**The real disagreement threshold, readiness criteria and adjudication/combination
rule remain null/pending.** No knee-degree or candidate-motion tolerance applies.
No real acceptance is allowed while these policies are unresolved, even for exact
agreement. After future approval, exact/small agreement may qualify only under
that frozen rule; large disagreement requires its prescribed review. Unresolved
adjudication cannot produce an accepted target.

The isolated fixtures simulate one branch using `SYN-POLICY-1`: maximum absolute
start/end/duration disagreement <= **0.05 s**, mean boundaries for agreement,
third independent boundaries for adjudication. This number is **solely a branch
test parameter**, not a recommended scientific threshold. Other fixtures leave
the simulated policy pending. A numerical equality test in code is arithmetic
consistency, not a physical uncertainty/acceptance tolerance.

## 4. Accepted-label arithmetic and feature isolation

```text
accepted_crossing_duration_seconds = accepted_end_seconds - accepted_start_seconds
final_speed_mps = measured_distance_m / accepted_crossing_duration_seconds
```

Distance is an independent **reference input**; accepted crossing duration is a
**label input**. Neither is a prediction feature, including indirect encodings via
reference-selected window length or reference boundary indices. Reference start,
end, observer decisions, final speed and identity also stay out of predictors.
Freeze a deployment-available window rule independently of labels/predictions.

No label from candidate extrema, predicted gait events, Android requests,
unqualified nominal FPS, instruction categories, visually guessed speed or
historical fixed-distance values. Synthetic accepted values below only demonstrate
the formula; they are not ground truth for training or evidence of accuracy.

## 5. Annotation edge-case matrix

"Retain" means permitted accounting only; governance may require evidence and
identifying linkage deletion. No permanent identifiable ledger is promised.

| Case | Expected workflow / reference state | ML inclusion | Adjudication | Failure/accounting ledger |
| --- | --- | --- | --- | --- |
| Both agree | pending until policy/reviewer gate; accepted only after all gates | Conditional on accepted reference and all other gates | Not required only under frozen rule | Retain originals and decision |
| Small disagreement | pending or accepted under approved agreement rule | Conditional | Policy-defined; no default threshold | Retain pre-review disagreement |
| Large disagreement | adjudication_required / pending | No until resolved and accepted | Required under approved trigger | Retain A/B and resolution |
| One observer missing | observer_a_only or observer_b_only / pending | No | Obtain independent missing submission; do not substitute model | Retain reason |
| Invalid duration | rejected or unavailable, reasoned / no final value | No | Review raw error; correction gets new revision | Retain invalid attempt/submission |
| Timing unavailable | unavailable | No | Cannot repair by consensus alone | Retain clock reason |
| Source missing | unavailable | No | No annotation without authorized independent evidence route | Retain permitted missing/deletion receipt |
| Marker obscured | unavailable or rejected | No | Only if retained evidence can resolve under fixed rule | Retain reason |
| Ambiguous crossing | disagreement_pending, then adjudication_required or unavailable | No until resolved | Required if policy permits resolution | Retain ambiguity/brackets |
| Participant/trial mismatch | quarantine; pending reference or invalidate accepted revision | No | Steward resolves identity; reference reviewer may need repeat | Retain discrepancy audit |
| Duplicate attempt/media | quarantine/duplicate flag, reference may remain accepted | No extra independent trial/person | Lineage review, not observer averaging | Retain duplicate relationship |
| Replacement | New attempt, own pending-to-terminal reference | Conditional for new attempt | Normal reference rule applies | Original failure remains |
| Withdrawn | Governance withdrawn; reference state is independent | No regardless of accepted label | No adjudication overrides withdrawal | Permitted accounting/deletion receipt only |
| Accepted then invalidated | New rejected/unavailable revision, null current final fields | No; revoke affected dataset/features/runs/evaluation | Review correction, never tune toward predictions | Preserve authorized revision/invalidation history |
| Timing method version changed | pending requalification/new annotation version | No until requalified | Review method and affected boundaries | Retain versions/dependencies; never edit frozen test in place |

## 6. Synthetic package and qualification limits

[Fixture catalog](../../research/study/fixtures/v2-proposal/README.md) documents
the cases and expected ledger validity versus simulated reference/pair eligibility.
The [isolated validator](../../research/study/check_v2_proposal.py) reads only the
built-in synthetic JSON directory, takes no external input path, imports no V1
checker and performs no model/media processing. It rejects non-synthetic headers,
unknown/malformed fields and mismatched expected outcomes. Fake hashes are
generated from public synthetic identifier strings, not participant/video bytes.
It does not verify byte-to-media integrity, actual clock qualification, observer
honesty or permissions. PASS means only the bounded proposal invariants hold.

Representative PTS tests include rational ticks/timebases, signed origin,
conversion mismatch, incompatible clocks and nominal/requested-clock substitution.
Complete frame-series variable-rate ordering, actual decoder gaps, duplicate-frame
behavior, transcode timing and instrument calibration still require separately
scoped qualification after technology review.

## 7. Conflicts, owners and collection gates

| Preserved older/newer conflict | Decision owner | Gate |
| --- | --- | --- |
| [Study](STUDY_PROTOCOL.md) 15–30 / 3–5 trials versus newer planning ranges 8–12 pilot, 40–60 aim, 80–120+ expansion/repeats | Supervisor/research lead | Pilot design; main target after pilot; ranges are not power calculations or approval |
| Step/cadence-first and [knee-first](KNEE_FLEXION_VALIDATION_PROTOCOL.md) priorities versus speed-primary recommendation | Supervisor/panel | Endpoint confirmation before protocol/labels freeze |
| Landscape/1080p versus portrait/720p | Supervisor/engineering lead | Capture variant and actual properties qualified before pilot |
| Ordinary source deletion / [exact-image](EXACT_FRAME_EVIDENCE_WORKFLOW.md) minimized stills versus speed-crossing replay retention | Institution/steward/reference lead | Approved retention/evidence route before research acquisition |
| Strict [V1 contract](DATASET_CONTRACT.md) versus V2 entities/workflow | Schema/steward/ML lead | Separate design approval and future implementation/migration qualification |
| Nominal/requested clocks and [candidate-motion](CANDIDATE_MOTION_REFERENCE_VERIFICATION.md) sampling clock versus qualified physical reference | Reference/engineering lead | Independent qualification before pilot; no inherited numerical tolerances |

Open: course distance; crossing landmark; timing technology; observer threshold,
readiness and adjudication policy; pilot/main counts; model count (~10 remains
unconfirmed); pose-backbone versus downstream scope; governance/consent/ethics/
retention/withdrawal; public dataset use; device-diversity requirement. Supervisor,
reference reviewers and the institution must supply authentic decisions. No
simulation flag answers them. No pilot or main recruitment begins from this task.

## 8. Equal application and research tracks

This package changes no app behavior. An app session UUID is not participant,
research session, trial or attempt identity. Future approved research linkage and
source-retention design are separate work, not implemented here.

Application obligations remain newest exact-APK physical acceptance, capture and
multi-device reliability, persistence/offline/restart and saved-analysis/failure
checks, UX/accessibility, final ML integration, Python/app parity and runtime/
thermal/memory/release testing. The exact existing APK and fresh **engineering**
smoke-video checklist remain in the [brief](ML_SUPERVISOR_DECISION_BRIEF.md).

Research obligations remain supervisor decisions, approved reference method and
governance, qualified acquisition, pilot, main cohort, model benchmark, held-out
evaluation and literature novelty verification. Neither track replaces the other.
Next no-phone task: reviewer decisions and timing-technology qualification design;
any implementation or real evidence use needs separately scoped work and gates.
