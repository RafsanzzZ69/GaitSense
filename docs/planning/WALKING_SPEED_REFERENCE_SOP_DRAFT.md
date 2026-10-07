# GaitSense — Walking-Speed Reference / Annotation SOP

**DRAFT — NOT YET APPROVED FOR RESEARCH COLLECTION**

Proposal `GS-SPEED-REF-0.1-draft` · 8 October 2026 · Sprint 6 Task 2.

Scientific status: **NOT_EVALUATED**. This document does not authorize recruitment, retention, new annotations on private footage or research capture. No final distance, timing technology, numeric quality tolerance or adjudication rule is approved here. Owners below are proposed roles, not named assignments.

Read with the [supervisor brief](ML_SUPERVISOR_DECISION_BRIEF.md), [V2 manifest proposal](RESEARCH_MANIFEST_V2_PROPOSAL.md), [existing study](STUDY_PROTOCOL.md), [consent draft](CONSENT_DRAFT.md) and [pending approval register](approvals.json). Existing protocols and [checker](../../research/study/check.py) remain unchanged.

## 1. Purpose and target definition

For one straight-walking trial under a reviewed side-view smartphone protocol:

```text
crossing_duration_seconds = accepted_end_seconds - accepted_start_seconds
walking_speed_mps = measured_distance_m / crossing_duration_seconds
```

The distance and crossing duration must be independently established, finite and positive. Both endpoints must refer to the same measured zone, body landmark, source evidence and qualified clock. Store the underlying measurements and uncertainty, not only the calculated speed. Whole recording duration, waiting time, turns and lead-in/out are not crossing duration.

Reference speed must not come from model output, visually guessed speed, assumed legacy distance, Android requested sampling timestamps, candidate extrema/intervals, estimated cadence, a "walk slowly" instruction or historical guessed values. Pose output must not supply its own reference landmark tracking. The historical [measurement tool](../../research/gaitsense_poc/scripts/measure_walking_speed.py) uses fixed 4 m/frame-FPS arithmetic; it is not a qualified SOP implementation.

The label describes trial-average speed through the measured zone. Future predictor inputs must omit these reference crossing times/duration, the calculated target, observer decisions and participant identity. Freeze a deployment-available pose-window rule separately; it must not encode target duration or select favorable frames after viewing predictions.

## 2. Preconditions and accountable roles

Before any research recruitment/capture, authentic institutional determination and supervisor decisions must cover the study question, protocol/cohort, safe walking conditions, consent language, source retention/withdrawal/deletion, access and named owners. A-01–A-05 are presently pending; a filled metadata field or app local-processing notice is not consent or ethics approval.

| Proposed role | Responsibility |
| --- | --- |
| Supervisor/research approval owner | Confirm primary endpoint, course, timing route, pilot and final protocol; identify the institution's decision authority |
| Course/setup operator | Measure/verify course and record capture configuration; no reference guesses |
| Data steward | Private participant/session/trial linkage, consent eligibility, source integrity, controlled blinded packages and retention ledger |
| Observer A / Observer B | Independent, initially mutually blinded start/end annotations and uncertainty/missingness decisions |
| Reference reviewer/adjudicator | Resolve discrepancies under the approved rule, without model predictions |
| Engineering/ML owners | Qualify evidence/timing and link frozen references to outputs; application acceptance and model parity remain separate obligations |

Retain the current adult comfortable-walking safety scope unless separately reviewed: safe unobstructed course, ordinary comfortable clothing/shoes, rest, voluntary stop/withdrawal, no forced limp/weights/balance challenge or pressure to walk faster. Optional self-selected pace variation requires protocol review. No clinical recruitment/diagnostic claim follows from this SOP.

## 3. Course and camera setup record

| Required future setup information | What to document |
| --- | --- |
| Course identity/version | Stable coded course/layout and protocol version; level straight path |
| Actual zone distance | `measured_distance_m`, instrument/method, measurement date/code, independent verification record and distance uncertainty |
| Boundary/marker layout | Start/end boundary IDs, exact measured endpoints, diagram and approved way their planes/lines are identified in the image |
| Lead-in/lead-out | Space to enter/leave comfortably; record actual arrangement, keeping acceleration/turns outside the intended zone |
| Camera placement | Stationary side-view setup, camera height, approximate distance, alignment and framing; log lens/camera mode/zoom/stabilization if known |
| Recorded evidence | Source orientation, actual dimensions, codec/rate/timebase metadata and source hash; nominal settings separately identified |
| Operator assertions | Visible anatomical side, image-x direction and upright-image check with source; these are not native geometry or verified physical timing |

**4 m is only a provisional candidate** inherited from historical tooling and the older study draft. Final zone distance remains supervisor/protocol confirmation pending. Never assign 4 m to a recording because of a filename or tool default. Measure the chosen course; do not derive ground distance from uncalibrated image displacement.

The broader study requests landscape/1080p/30 FPS; the knee amendment proposes portrait/720p. Choose/version one primary speed capture variant, verify actual output and label approved variants separately before the pilot. No variant is silently adopted here. Full required body region and both boundaries must be observable for the chosen reference rule; marker perspective/occlusion needs setup review, not a model-based repair.

## 4. One crossing convention for every eligible trial

The approved protocol must name **one body/reference landmark** and **one fixed boundary rule**. Candidate for review: a manually identified pelvis-midpoint visual proxy crossing the image projection of each independently positioned course boundary. This is a proposed visual definition, not an anatomical-center claim or an approved choice.

Specify which image evidence establishes crossing, how perspective is handled, whether observers bracket the crossing between last-before/first-after frames, how any interpolated boundary estimate is formed, and whether an instant or interval is reported. Freeze that method/tool version after qualification/pilot review. Do not change landmark, choose a visible foot on difficult trials or tune a crossing toward model output.

For opposite travel direction, the entering boundary becomes start and the exiting boundary becomes end under a prespecified mapping; the same measured distance and landmark convention apply. Record both boundary IDs and image-x direction. A turn or repeated crossing must not be resolved by choosing the pair that yields a preferred speed; use the fixed selection rule or reject ambiguity.

Unclear landmark, hidden boundary, camera movement, incomplete passage or uncertain steady-walking eligibility produces a reasoned unavailable/rejected reference. Preserve the actual attempt. It does not imply zero speed or absence of walking.

## 5. Reference timing qualification

| Timing representation | Meaning | Permitted role in this draft |
| --- | --- | --- |
| Qualified decoded-frame PTS/timebase | Source presentation ticks with verified timebase, origin and frame correspondence; seconds derived by documented rational conversion | Candidate scientific reference route after qualification/review |
| Nominal-FPS timing | Frame ordinal divided by reported/assumed FPS | Diagnostic or rehearsal information only; not sufficient scientific reference provenance |
| Android requested sampling time | Request `0,100,...` ms used for nearest-frame selection and MediaPipe VIDEO context | Pose-analysis sampling clock only; not decoded PTS or physical reference time |
| Independently approved alternative | A reviewed independent timing system with boundary definition, clock/calibration and uncertainty; synchronization if it uses another recording | May support labels only after explicit independent approval/qualification |

If qualified PTS is unavailable, scientific reference timing remains **unavailable** unless another independently approved timing route exists. Do not fill PTS from requested time, FPS, wall-clock creation time or a frame index. Keep nominal metadata without upgrading its provenance. The [native path](../../frontend/modules/gaitsense-pose/android/src/main/java/expo/modules/gaitsensepose/GaitSensePoseModule.kt) uses `OPTION_CLOSEST` and saves requested times; repeated selections can occur and actual PTS is not provided by ordinary saved sessions.

Future qualification evidence must show decoder/tool/version, source hash, frame-to-PTS correspondence, timebase numerator/denominator and origin, time ordering/discontinuities, repeated-frame policy and start/end support on known synthetic timing fixtures. Review variable-rate/transcoded sources, timestamp offsets and boundary uncertainty. Never substitute decode timestamp for presentation timestamp without a qualified mapping. A nominal FPS number, strict time increase or metadata checker pass alone cannot establish timing correctness.

Observers must annotate the same evidence and qualified clock. If an external timing route is chosen, version its equivalent measurement SOP before use; document calibration, crossing signal, start/end uncertainty and any synchronization/drift. No technology or precision guarantee is selected here.

## 6. Independent annotation procedure

1. **Prepare and link:** after genuine governance clearance, data steward binds source → participant → session → planned trial → actual attempt, verifies source/alias lineage and approved retention, and creates coded evidence packages with course/crossing instructions. Hide pose overlays, predictions, candidates, confidence and other observers' submissions. Retain the immutable authorized source while policy permits.
2. **Observer A:** independently records start and end, source frame IDs/ordinals if known, PTS/timebase or approved timing records, boundary brackets, timing source, confidence/uncertainty, ambiguity and rejection reason. Do not force a boundary when evidence is missing.
3. **Observer B:** performs the same work independently, blinded to A and all model outputs. Capture observation status even if one boundary is unavailable. Raw partial/rejected annotations remain evidence; they are not accepted speed labels.
4. **Lock submissions:** preserve both records, observer pseudonymous codes, tool/annotation versions, evidence digests and revision history before comparison. Do not overwrite A/B with an agreed result.
5. **Assess disagreement:** record signed/absolute start difference, end difference and duration difference in seconds on the same qualified clock; compare annotatability decisions and uncertainty. No valid common clock makes disagreement unavailable, not zero. Report pre-adjudication agreement and blinded repeat annotations on a pilot-defined subset.
6. **Apply reviewed adjudication:** proposed route is a third reviewer initially blinded to A/B and models, followed by documented resolution. Accepted-pair averaging, selecting one observer or another combination rule all remain decisions; no automatic rule or numeric threshold is adopted here. Preserve independent third observations, rationale and unresolved cases. Never choose whichever result agrees with the model.
7. **Accept or retain unavailable/rejected:** a designated reviewer applies the frozen governance/reference rule. Only an accepted reference has final start/end, crossing duration and speed. Missing, rejected, pending or unresolved records have null final label fields and explicit reasons.
8. **Seal then join:** freeze annotation/reference version and integrity records before releasing predictions for evaluation. Corrections require a new version with reason and downstream invalidation/recomputation; do not tune labels on held-out prediction errors.

Observer training/readiness, repeat workload, allowable start/end/duration disagreement, confidence semantics, uncertainty budget and adjudication triggers are **pilot/reviewer decisions**. Knee-angle degree thresholds and candidate-extremum millisecond thresholds cannot be transferred to speed reference timing.

## 7. Uncertainty and acceptance

Record uncertainty for measured distance and both crossing boundaries, how it was established, and whether values are intervals or another agreed representation. Review how duration and speed uncertainty propagate; no universal confidence level or acceptable error bound is assumed. If the timing method cannot support the intended endpoint precision, narrow the claim or revise the approved acquisition design before main collection.

For an accepted reference, `end > start`, positive measured distance, common source/clock, finite numeric values and formula consistency are necessary checks. These arithmetic checks do not establish physical validity, authentic consent or correct boundary annotation. The eventual acceptance policy must be versioned and frozen before held-out evaluation.

## 8. Planned-trial and actual-attempt failure ledger

Statuses are **separate axes**, not one overwritable label; the [V2 proposal](RESEARCH_MANIFEST_V2_PROPOSAL.md) defines their allowed combinations.

| Concept | Proposed ledger treatment |
| --- | --- |
| Planned / unattempted | Planned trial exists; zero attempt records until capture is actually attempted; explain non-attempt at closure |
| Attempted / capture_failed | New immutable attempt ID; capture outcome and reason, partial/source evidence if any; no invented completed video |
| Processing_failed | Same attempt keeps capture/reference facts; feature/prediction outputs remain unavailable if unsupported |
| Reference_unavailable | Boundary, qualified timing or necessary source absent; final label null |
| Reference_rejected | Review finds the evidence ineligible/ambiguous; final label null; reason retained |
| Accepted | **Reference accepted**, not study/model/clinical acceptance; eligible pairing additionally requires permitted use and supported output |
| Replacement_attempt | New attempt ID and explicit `replacement_of_attempt_id`, reviewed reason/authorization; original take remains in accounting |

Maximum replacements, allowed reasons and approval authority remain unresolved. Do not inherit the knee protocol's one-replacement rule without review. No replacement may erase the original failure or become a best-error selection after viewing predictions. A captured trial may have a valid independent reference even if pose processing failed: retain the label under approved policy and count unavailable prediction coverage separately.

Report planned/unattempted trials, actual attempts, failures, reference yield, prediction availability, duplicates and exclusions by participant/session/device. A successful replacement does not turn the original into a success. Withdrawal/deletion follows approved policy, retaining only permitted accounting rather than keeping identifiable data indefinitely.

## 9. Future review checklist — no invented numeric thresholds

- [ ] Measured straight zone, instrument/method, actual distance and verification documented.
- [ ] Correct marker/boundary mapping, lead-in/out and camera setup; required body region visible.
- [ ] One frozen crossing definition; both crossings unambiguous for this direction.
- [ ] Reference timing path qualified, with source/clock/uncertainty evidence.
- [ ] Participant/session/trial/attempt linkage and protocol version valid.
- [ ] Two independent blinded submissions locked; disagreement/adjudication rules approved and satisfied.
- [ ] Source/reference evidence retained within approved consent, access and retention policy.
- [ ] Duplicate/alias/re-encoded lineage resolved; no derivative counted as a new trial/person.
- [ ] Governance/consent/withdrawal eligibility authentically checked; no app-notice substitution.
- [ ] Final values exist only for accepted references; failures and missingness retained; reference sealed before model comparison.

This is a proposed review checklist. Checking it in a draft does not activate institutional approval or change `NOT_EVALUATED`.

## 10. Retention, conflicts and next readiness gate

Ordinary app processing deletes source video; saved History cannot reconstruct reference crossings or deleted inference images. Choose a separately authorized research harness/evidence route or controlled retained-source workflow before collection. Full walking-speed crossing evidence is not supplied by the knee workflow's 20 still images alone. Its minimized-image retention and temporal replay tradeoff require a separate speed decision. No cache interception or undocumented production retention change is authorized here.

Store authorized sources/annotations/labels privately with encryption/access controls, coded identifiers and consent/linkage in a separate restricted registry. Define exact expiry for originals, derived images/annotations/features, linkage and backups; define withdrawal and deletion receipts. Public release/third-party annotation/cloud backup needs its own reviewed permission. Existing 30-day/12-month proposals are not adopted. Follow the [repository data policy](../REPOSITORY_DATA_POLICY.md); neither a private repo nor `.gitignore` is a privacy control by itself.

The [brief's conflict table](ML_SUPERVISOR_DECISION_BRIEF.md#conflicts-requiring-explicit-resolution) records owners/timing for cohort/trials, speed-primary scope, capture variant, deletion/retention, checker/V2 and clock differences. Resolve course distance, landmark/boundary rule, timing technology, observer thresholds/adjudication and governance before approved pilot recruitment; validate/freeze pilot-derived changes before main collection. Preserve the pending phone smoke milestone independently of research approval.

Next no-phone preparation: a synthetic-only reference-timing/annotation qualification specification and reviewer decision form, followed by separately scoped tool implementation if authorized. No real media or labels are needed to define those cases. This SOP changes no app, protocol/checker, approval record or data.
