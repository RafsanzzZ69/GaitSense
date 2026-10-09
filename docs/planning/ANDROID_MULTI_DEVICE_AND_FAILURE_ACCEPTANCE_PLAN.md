# Bounded Android multi-device and failure-state acceptance plan

9 October 2026. Original planning baseline; reviewed HEAD/origin main:
`326679f1d61417bc88c736d8a3f5012d7fcb2425`.
Model: GPT-6.1 Sol; reasoning: High. No phone, video or dataset used for this plan.
Scientific status: **NOT_EVALUATED**. App reliability and defensible ML/thesis work
remain equal priorities. This plan authorizes no collection or implementation.
Recovery automation checkpoint reviewed source/remote
`34dd8a7987c9ed570408c7a8017f39e1d76df0d5`; only deterministic tests and this plan
are updated. No phone, engineering video, research data or APK build used.

## Evidence audit and Level A: accepted baseline

[Latest physical evidence](../OFFLINE_ANDROID.md) records owner-reported PASS on
8 October, documented 9 October. Accepted source: `7d41b5987d204a173c5dca5f91a73d2a50781f22`;
APK SHA-256: `f0fe6c22950ecba42a92e3e2cfa2ba9800d9bb14631802f3549a3711c5c3bfa8`.
Package `com.gaitsense.research`; minimum API 26, target 36. Use this artifact for
the baseline pipeline run; it does not contain the subsequent UX clarification.
Physical B5 acceptance of revised wording needs a separately verified future build;
no build is performed in this checkpoint. Do not rebuild just to repeat acceptance.
A later relevant source
change requires an identified replacement build and only affected regression checks.

Already **PASS for the reported device/session/build**:

- Capture and MediaPipe processing; side_right, image-right travel and upright
  assertion; 115 samples / 115 pose frames / 115 usable (100%). noPose, multi,
  jointRejected, missingRequiredLandmark and all four joint rejection counts zero.
- Save, metadata-v2/native inference geometry, operator setup persistence, History
  reload, projected 2D knee flexion, candidate ankle extrema and candidate intervals.
- Airplane mode with Wi-Fi unavailable after saving; close/reopen; History, setup,
  geometry and all three analysis components still load.

The account does not restate phone model/OS, establish capture/processing offline
from the start, specify force-stop semantics, inspect SQLite/cache directly or
report a new deletion test. Historical A25 offline-from-start and deletion evidence
is separate. Do not require a repeat of the latest baseline on the same device.
The prior 39/123 and 88/131 failures remain retrospectively unexplained.

Inspected contracts and executable test cases:

| Evidence | Established engineering coverage; limits |
| --- | --- |
| [Quality diagnosis](../REQUIRED_JOINT_QUALITY_GATE_DIAGNOSIS.md), [native gate tests](../../frontend/modules/gaitsense-pose/android/src/test/java/expo/modules/gaitsensepose/RequiredJointQualityGateTest.kt) | Documented 42 JVM tests PASS across gate/diagnostics/setup/geometry, including 25 gate tests: mappings, boundaries, missing confidence, malformed/no/multiple poses and accounting. Synthetic; no camera/decoder execution. |
| [Recording setup contract](../../frontend/src/offline/RECORDING_ANALYSIS_SETUP.md), [capture tests](../../frontend/tests/recording-analysis-setup.test.mjs) | Documented 55 setup/capture tests PASS in the later diagnosis: immutable side/setup binding, cancelled countdown, discard, capture/processing errors, cleanup failure, late unmount, full rejection message, missing/conflicting assertions. Controlled hooks/native mocks; no TalkBack/physical layout proof. |
| [Metadata contract](../../frontend/src/offline/ANALYSIS_METADATA.md), [continuity contract](../../frontend/src/offline/SAVED_CONTINUITY.md) | Versioned additive summary metadata, component failures, checked requested-clock detector segments; no migration or authenticated images/PTS. Earlier v1-only statements are historical, superseded where the setup/continuity documents explicitly extend them. |
| [Loader contract](../../frontend/src/offline/SAVED_SESSION_LOADER.md), [loader tests](../../frontend/tests/saved-session-loader.test.mjs) | Documented 34 loader tests PASS: stale responses, malformed/read failures, counts, partial results; no transactional snapshot across native reads. |
| [Offline tests](../../frontend/tests/offline.test.mjs), [capture implementation](../../frontend/src/offline/OfflineCapture.tsx), [native implementation](../../frontend/modules/gaitsense-pose/android/src/main/java/expo/modules/gaitsensepose/GaitSensePoseModule.kt) | Eight documented offline tests cover consent/state gates, payload validation, production SQL schema rollback/cascade and privacy/model pin. Node SQLite is not Android SQLite. Native source removes temporary media before returning success, and checks deletion errors; UI has explicit leftover cleanup. |

These are previously reported automated PASS results plus this task's source audit,
not newly executed tests. `recording-state.test.mjs` exercises web recording state,
not Android cancellation. The local untracked ShortIntervalComponentTest is not
claimed as executed or accepted. No latest-build M36 acceptance found in repository
documentation; historical M36 testing is supplied user context, without verified
build/OS details. Old pending checklists are historical inputs, not cumulative new
requirements. This focused plan replaces an unbounded enumeration for this milestone.

## Levels and test budget

- **Level A:** baseline above already PASS. Confirm its device identity by operator
  record if possible; this requires no new recording and never overwrites history.
- **Level B:** P0 rows below must close before pre-ML app exit/defense release;
  conditional update preservation applies when old installed data is available.
- **Level C:** P1 useful if feasible; P2 optional. Neither delays pre-ML exit.

P0 = required for this bounded milestone; P1 = valuable if feasible; P2 = optional.
Revised P0 budget: one second-device visit, **two planned engineering clips**:
one 10–15 s empty-scene rejection clip and one fresh 10–15 s walking success clip.
Automated B2 handler closure removes the separate brief preview/discard clip from
P0; a physical discard experiment is P1 only if a specific cache/preview risk arises.
One cancelled countdown creates no clip. Use the successful
clip for all save/reopen/analysis checks; no separate knee/interval recordings.
Do not create repeated <70% recordings to hunt a pass. If the empty scene unexpectedly
passes or the walking clip fails, record the result and pause that branch for diagnosis.
At most **one extra clip across this bounded visit** is allowed after a documented
cause/fix or test-precondition correction: maximum **three P0 clips including that
contingency**, not three mandatory recordings or a rerun allowance per scenario.
Otherwise mark BLOCKED and open a focused defect task. No soak loop,
all-device claim, repeated orientation matrix or recording quota. Stop on any data-loss
defect; preserve the error before cleanup/retry. No production debug injection.

## Smallest P0 suite: exact criteria

All manual rows need a phone; all use consenting engineering operators, no research
participants. Screenshots/notes should exclude unrelated private History details.
Record APK hash/source, device model/OS/API, date, test ID, outcome and error text.
Unmet preconditions are BLOCKED, never PASS. Capture evidence locally; no uploads required.

| ID / priority | Precondition and action | Observable PASS / failure condition | Evidence | Phone / video / internet off / destructive / reuse |
| --- | --- | --- | --- | --- |
| B0 / P0 automated | Before physical execution, use reviewed source/build pairing. Run TypeScript, focused setup/offline/loader/saved analysis UI+integration tests and native gate/setup/diagnostics/metadata JVM tests; inspect cleanup/transaction wiring. No assembly. | All selected tests pass, no skips hiding required cases; gate/setup/provenance contracts unchanged. Any failure blocks affected physical row pending diagnosis. Historical results can be reused if code and test inputs are unchanged and provenance is recorded. | Commands, commit, suite totals, failures/skips; package/signature verification record. | No / no / not applicable / no / synthetic only. |
| B1 / P0 second-device pipeline | Different physical Android phone, supported API, sufficient storage, correct package/signing identity. Install or update exact APK; enable Airplane mode and confirm Wi-Fi/mobile data off **before** capture. After B3 rejection, explicitly choose anatomical side, direction and upright; record one walking clip, use Stop recording at 10–15 s, confirm preview (not cancellation), process/save; open History/analysis; close/reopen offline and reload. | Install succeeds; >=70% gate passes without tuning; session remains after reopen; geometry and assertions retain provenance; knee, motion and intervals render available for an eligible run. No crash, stuck UI, duplicate save or missing data. Partial output is not automatically a crash: retain component reason and diagnose eligibility; incomplete positive-path proof stays BLOCKED. | Device identity, installation route, full diagnostics, summary/session ID, setup/geometry and three component statuses before/after reopen; network state. | Yes / one walking clip / yes throughout / adds disposable session / reuse saved result for all reloads. |
| B2 / P0 cancellation and preview recovery — AUTOMATED EVIDENCE CLOSED | Actual capture handlers under controlled hooks/native mocks: cancel countdown and separately stop/preview/discard; then complete a fresh successful attempt. Before B3, a no-clip countdown cancel may be folded into B5 on the phone. | No cancelled/discarded History entry or native processing request; cancellation starts no camera recording. Stop produces preview, **not cancellation**; discard clears snapshot and direction/upright; controls recover; new request uses fresh setup and old History remains intact. Physical preview/cache removal is not inferred from mocks. | New named P0 capture tests plus existing snapshot/unmount/failed-discard tests, source pairing and unchanged native cache-removal contract. | No for handler closure; optional phone gesture / no required extra clip / off during visit / only synthetic mocks here / old mock History preserved. |
| B3 / P0 rejected processing and retry | Record one empty scene 10–15 s, selected side recorded, no person; process once. Inspect complete error before retry. Then proceed to B1 normal recording. | Rejected with no accepted/fake/scored session; History unchanged; error contains applicable diagnostics (normally noPose); source/preview no longer offered after successful cleanup, setup reset and controls recover. B1 demonstrates retry succeeds. Unexpected acceptance, lost diagnostics, partial saved record or unrecoverable lock is FAIL. | Full selectable error, sampled/pose/usable/noPose/multi/gate counters, before/after History and setup; link subsequent B1 outcome. | Yes / one empty-scene clip plus B1 shared walking clip / yes / rejected temporary clip removed / existing History preservation control. |
| B4 / P0 bounded deletion and cleanup | After B1 reopen, mark **only its new engineering session** disposable. Cancel the deletion confirmation once; verify retained. Then confirm Delete this session, close/reopen. Invoke Clear leftover temporary camera videos once with no active preview/processing. | Cancel preserves session; confirmed deletion removes selected session after reopen, analysis clears, unrelated History remains readable. Cleanup reports completion and preserves saved landmarks. No claim of filesystem erasure from UI alone: removal-before-save and rollback/cascade are source/automated evidence; filesystem inspection remains P1 if needed. Wrong-session deletion, stale analysis or saved-data loss is FAIL. | Selected disposable ID, remaining History before/after/reopen, cleared analysis and cleanup result. No Delete all required. | Yes / no extra / yes / deletes disposable session and app camera-cache leftovers only; first ensure leftovers are disposable / B1 session and untouched older History. |
| B5 / P0 setup understanding and basic operability | Before B1, operator uses built-in labels/help, without developer coaching. Identify visible anatomical side, image-x travel and upright image. Inspect chosen state and essential controls with normal device text size. | Operator correctly distinguishes their own left/right anatomy from image direction, explains head-up image assertion and selects intended values; essential controls/error/History are readable and reachable. Needing developer explanation or clipped/inaccessible critical controls is FAIL requiring bounded UX work. | Operator explanation, selections, screen dimensions/text setting and any confusing label. | Yes / no extra (B1 shares setup) / yes / no / existing screen and B1 session. |

B4 is explicit reversible-test preparation followed by intentional deletion of disposable
engineering data; never delete unrelated sessions or uninstall to manufacture test state.
Do not promise native processing cancellation after atomic save has already committed.

## Device matrix

| Device | Historical evidence | Newest diagnostic-build evidence | Remaining action / priority |
| --- | --- | --- | --- |
| Samsung Galaxy A25 5G, SM-A256E | Android 16/API36 established historically; September capture, offline, restart and deletion reports in OFFLINE_ANDROID. Strongest named-device history. | Latest 115/115 PASS exists, but latest account does not independently restate model/OS. User context associates strongest current evidence with A25; retain qualification until owner confirms identity. | Confirm identity without recording; retain Level A. No routine baseline repeat. P0 evidence bookkeeping. |
| Samsung Galaxy M36 5G, SM-M366B/DS | Historical testing supplied by owner; exact Android/One UI and build provenance not established in reviewed docs. | No established newest-build PASS. | Preferred B1–B5 second phone if available; record actual OS/API/One UI, never guess. P0 second-device class, not mandatory specific model. |
| Another supported physical Android phone | No assumed access or PASS. | Unknown. | May substitute for M36 if distinct from confirmed baseline device. P0 substitute. If baseline identity cannot be resolved, establish two named device records before claiming two-device acceptance. |
| Older/lower-end supported phone (API >=26) | Unknown. | Unknown. | P1 if available: one pipeline/runtime observation, preferably different tier/OEM. Does not block current exit. |

Two Samsung models provide bounded compatibility evidence, not broad OEM coverage.
Do not purchase/borrow a third phone merely to satisfy a generic matrix.

### Conditional update preservation (P1; release blocker if regression found)

If a device already has an older compatible GaitSense installation and saved data,
record existing History IDs/count and open a representative session, then update in
place using matching package/certificate. **Do not uninstall**, clear storage or
reconstruct historical state. PASS: same sessions readable after update/reopen,
old metadata retains its original version; missing old setup yields honest partial
analysis rather than invented v2 assertions. Capture before/after evidence. Existing
sessions suffice; no video needed; offline after transferring APK. If unavailable,
mark NOT TESTED with rationale; it is not a blocker to ML/research or pre-ML exit.
Any demonstrated update data-loss defect becomes P0 before final release.

## Failure-state matrix: automation versus physical evidence

| Scenario | Current automated coverage | Physical evidence | Expected behavior / remaining check | Priority / evidence |
| --- | --- | --- | --- | --- |
| Countdown cancel; stop/preview/discard | AUTOMATED EVIDENCE CLOSED: actual handlers, no camera/request/save on cancel, preview/discard then successful fresh attempt; snapshot/reset preserved | No new physical failure-path PASS; primary preview/process path already PASS | B2 handlers closed; no mandatory brief discard clip. Real cache behavior remains qualified by source and bounded B4; targeted physical discard P1 only if justified | P0 automated closure / named tests; no-clip gesture may share B5 |
| Processing rejects; retry | AUTOMATED EVIDENCE CLOSED: quality-error and processing-error sequences preserve History, clean/reset, then save exactly one successful retry; SQL rollback already covered | Earlier gate failures exist, but new diagnostic rejection/recovery not demonstrated | PHYSICAL EVIDENCE STILL REQUIRED: B3 then B1 exercise native no-pose rejection and successful fresh camera/inference path | P0 / two shared clips, full diagnostics |
| <70% joint quality | Native boundary/mapping/Optional/overlap tests; actual error display harness | Earlier 39/123 and 88/131, reasons unavailable; latest 115/115 success | Automated P0 closure plus B3 shared error path; no deliberately induced low-quality walking clip required | P0 automated; physical reason-specific check P1 only if naturally encountered |
| No pose / multiple people | Native structural accounting and native guard wiring; no-pose branch to be exercised by B3 | Latest zeros; no newest multiple-person rejection evidence | No pose B3; multi guard remains unchanged (existing <=5% multi proportion rule plus exactly-one-pose usable samples), no synthetic people needed | No pose P0; multi physical P1 / full counters if encountered |
| Wrong anatomical side | Binding/mapping tests; no auto-switch | Latest side_right positive path only | Cannot authenticate anatomy or necessarily reject a wrong assertion; B5 comprehension, never require automatic correction | P0 UX; extra opposite-side capture P2 |
| Missing direction/upright | Parser/adapter/presenter tests; unassessed supported | No latest unassessed physical run | Save allowed if capture gate passes; knee may remain, motion/intervals limited with reasons | P0 automated; physical P1 using an existing legacy session, no forced recording |
| Direction/upright conflict | Adapter/loader tests verify null motion and dependent intervals, supported knee independent | No current physical conflict demonstration | Caller/persisted conflict fails closed; current capture UI cannot inject arbitrary conflicting callers | P0 automated only; no production tampering/manual injection |
| Malformed/incomplete payload; native read fails | Loader/adapter validation, count mismatch, stale reads, UI/integration tests | No corrupted-device experiment | Explicit failure/unavailable state, no old session substituted or fabricated measurements; list absence is not proof of deletion | P0 automated only; do not corrupt Android DB |
| Partial/unavailable components | Adapter/presenter/UI tests and continuity exclusions | Latest available components; partial-run evidence not required | Supported components remain, reason/exclusions/nulls retained | P0 automated; physical P1 only if present naturally |
| Close/reopen saved session | Loader lifecycle/metadata tests | Latest offline PASS, unspecified close semantics | Reuse Level A; B1 covers different device and offline-from-start | P0 / B1 shared evidence |
| Delete/reopen; cleanup | AUTOMATED EVIDENCE CLOSED for handler deletion: Cancel preserves selection; confirmed selected ID deletion clears frames/analysis, ignores late read, stays absent on mock remount, preserves unrelated History. Existing Node SQLite cascade/rollback and native cleanup source remain separate | Historical deletion PASS; newest deletion absent | PHYSICAL EVIDENCE STILL REQUIRED: B4 confirms Android persisted deletion/offline reopen and leftover-clear control on the single disposable B1 session; no all-history deletion. Mock remount is not process restart | P0 / no new clip; filesystem inspection P1 |
| Cancel processing; background interruption | UI cancel wiring, mock failure/unmount cleanup; no claim of real JNI cancellation coverage | Historical interruptions, no latest bounded native cancel PASS | Cancellation before save should not commit; keep recoverable cleanup; do not assert instantaneous cancellation or discard committed results | P1 / one targeted physical check if feasible; no repeated kill loop |
| Camera denied; disk full; process death mid-save | Consent/state gates; transaction rollback source/test, not full OS fault proof | No latest qualified fault-injection evidence | Honest error/no partial commit, existing sessions preserved | P1 permission-denied/low-storage if safe; destructive disk exhaustion/kill injection P2, no forced storage damage |

### P0 recovery audit before/after automation

A = AUTOMATED COVERAGE SUFFICIENT; B = PARTIAL; C = MISSING;
D = REQUIRES PHYSICAL DEVICE; E = CONDITIONAL / NOT REPRODUCIBLE SAFELY.
Classification below is the pre-change audit, not a claim of newly completed
physical evidence. Only partial deterministic gaps were changed.

| Bounded P0 case | Before / actual repository evidence | After / remaining physical obligation |
| --- | --- | --- |
| B2 countdown cancellation / future attempt | B: existing isolated cancel/reset and immutable binding tests; no complete next-attempt History/camera assertion | AUTOMATED EVIDENCE CLOSED by new countdown-cancel→fresh-success test. No camera call or History addition on cancelled attempt; fresh side/setup verified. Optional no-clip gesture can share B5; no dedicated recording. |
| B2 stop/preview/discard / future attempt | B: isolated discard and cleanup-retry covered, but no successful new capture/process/save sequence | AUTOMATED EVIDENCE CLOSED by stopped-preview→discard→fresh-success test. Remove separate brief clip from P0. Mock discard call does not prove physical erasure. |
| B3 low quality / rejected processing → retry | B: native gate boundaries/wiring, error-display hooks and SQL rollback; no successful retry sequence | AUTOMATED EVIDENCE CLOSED for UI lifecycle by quality-rejection→success test using native result seam, not a copied quality algorithm. PHYSICAL EVIDENCE STILL REQUIRED for one native empty-scene rejection then B1 success; no deliberate low-confidence walking recording. |
| B3 general processing error / cleaned failure | B: existing error/reset test, without complete next-attempt and History assertions | AUTOMATED EVIDENCE CLOSED by processing-failure→success test. No decoder fault injection on the phone; B3 shares rejection/catch/finally path. New raw camera input/native inference still belongs to B1. |
| B3 cleanup failure with retained preview | B: failed **discard** retention covered, but not cleanup failure in processing finally | AUTOMATED EVIDENCE CLOSED: snapshot remains locked, no saved failure; successful discard resets, new attempt succeeds. Cleanup error is the displayed error under the current contract. Real deletion error cannot safely be forced: E for that optional physical fault, no required extra clip. |
| B4 selected-session deletion / stale analysis | B: SQL cascade plus generic binding clear/late-response tests; missing execution of actual deletion-confirmation handler | AUTOMATED EVIDENCE CLOSED: Cancel, correct ID Delete, frames/analysis clear, late read suppressed, mock remount absent, unrelated session readable. PHYSICAL EVIDENCE STILL REQUIRED for Android persistence after offline reopen, reusing B1 session. |
| Missing setup; conflict; malformed/incomplete/read-failed payload; partial/unavailable output | A: setup, saved loader/adapter/wrapper/presentation/UI/integration suites already distinguish independent knee/motion/interval availability, nulls, failed reads, conflicts and stale responses | AUTOMATED EVIDENCE CLOSED; retained existing tests, no duplicate cases. No DB corruption, caller-conflict injection or additional physical clip prescribed. |
| Raw temporary-file cleanup and real saved History restart | D: mock cleanup callbacks; source deletes before success and in native finally; Node SQLite tests cover schema transactions, not Android filesystem/process restart | PHYSICAL EVIDENCE STILL REQUIRED within B1/B3/B4: preview gone after processing, offline History/reopen, selected deletion and leftover-clear result. Actual filesystem inspection remains P1 if needed; UI completion alone does not prove erasure. Research retention is out of scope. |

Six new tests in the existing [capture/setup suite](../../frontend/tests/recording-analysis-setup.test.mjs)
execute production handlers. The harness now supports separate per-attempt camera
promises, explicit mock native outcomes, a shared synthetic History store, real
saved-analysis binding and captured confirmation buttons. It does not implement
native quality decisions, real files or Android SQLite. Mock remount uses the same
in-memory store; it is not Android process persistence. Existing test expectations
remain intact. No production defect was found and no source behavior was changed.

Focused verification at this checkpoint: **258/258 tests PASS**, zero failures,
skips or cancellations across eight suites: recording setup/capture **62**
(previously 56; six new), offline **8**, loader **34**, presentation **27**, saved
analysis UI **22**, integration **25**, saved payload adapter **56**, saved-session
wrapper **24**. Commands from `frontend/`:

```text
node --experimental-strip-types --test --test-reporter=spec tests/recording-analysis-setup.test.mjs tests/offline.test.mjs tests/saved-session-loader.test.mjs tests/analysis-presentation.test.mjs tests/saved-analysis-ui.test.mjs tests/saved-analysis-integration.test.mjs tests/saved-payload-analysis.test.mjs tests/session-analysis-saved.test.mjs
npm run typecheck
```

TypeScript passes. Native production/test inputs are unchanged; previously documented
native gate/diagnostic/setup evidence is reused, with no native compilation or
new JVM execution claimed. Node module-type and experimental SQLite warnings are
nonfatal. Whitespace and internal links pass. Automated closure does not change
Level A's physical scope or imply a new build/device PASS.

## Diagnose future quality failures once

Preserve left 11/23/25/27, right 12/24/26/28; visibility >=0.6, presence >=0.6,
inclusive x/y [0,1]; all selected joints simultaneously; session >=70% usable.
No threshold relaxation, camera-derived side substitution or automatic side switching.
Capture the **whole** local success/error diagnostic message before leaving:
selected request side, indices, cutoffs, sampled/usable/pose, noPose/multi/malformed,
missing confidence fields, exclusive first-failure and overlapping joint/reason counts.
Exclusive counts sum to jointRejected; overlapping counts are not distinct frames
and must not be added together. MissingRequiredLandmark is a subset, not an extra
denominator category. A first failure is not the only cause.

One failed diagnostic recording normally suffices for joint/reason attribution.
If message truncation or cleanup overwrites it, diagnose instrumentation/error
preservation first. Do not ask for another blind recording. These aggregates cannot
identify exact rejected frame timestamps or authenticate image/anatomical correctness.
Use supplied failures to select one focused code/device investigation; unknown cause
remains unknown until supported. Failed diagnostics are not a persistent study ledger.

## Bounded UX clarification: implemented; physical acceptance pending

Recent need for developer explanation is genuine usability evidence. The original
UI exposed raw `side_left`/`side_right` labels. The bounded source change implements
“Left side of the person” / “Right side of the person”, a question about which body
side faces the camera, and own-left/right help distinct from image direction.
Side buttons now announce selected state. Direction has an explicit across-image
question; its existing image-left/right choices remain. Upright confirmation names
head toward the top and feet toward the bottom, retaining the phone-posture warning.
Roles, 48-unit minimum targets, immutable setup and persisted values are preserved.
**IMPLEMENTED UX CLARIFICATION; PHYSICAL UNAIDED SETUP ACCEPTANCE STILL PENDING.**
Deterministic tests establish wiring/wording, not Android usability acceptance.

B5 is the acceptance criterion: unaided operator correctly explains and selects all
three, controls remain separate/locked/reset as contracted. Basic critical-path
readability is P0; TalkBack, larger text and contrast review are P1 here, and any
discovered essential-control accessibility failure becomes P0 before release.
No new recording is necessary solely to check revised wording. UI changes require
affected regression checks and identified build acceptance, not a full restart of this suite.

## Engineering and scientific boundaries

### Engineering acceptance can establish

Offline app execution, saved-session and metadata persistence, honest analysis
loading/limitations, rejection and recovery, and execution on the named tested devices.
Observed projected geometry and candidate outputs are engineering availability evidence.

### Engineering acceptance cannot establish

Clinical validity, speed accuracy, validated heel strikes/toe-offs, step/stride time,
cadence, anatomical 3D knee angles, scientific cross-device generalization, universal
Android reliability, actual decoded PTS, exact-image correspondence or independently
authenticated frame ownership. Requested sample times stay requested times; checked
continuity is requested-clock usable-motion continuity. **NOT_EVALUATED** remains.
Engineering clips do not enter scientific training/evaluation or count as participants.

## Explicit exit criteria and blocker classification

**PRE-ML-INTEGRATION APP EXIT CRITERION:** Level A remains PASS; two distinct device
identities documented with newest-build second-device B1 PASS; B0–B5 closed, where
failure subcases designated automated-only have justified existing test/source evidence;
no unresolved P0 crash/data-loss/persistence defect; offline save/reopen/History PASS;
actionable diagnostic rejection and retry; unaided setup understanding; focused
regression suite PASS with provenance. Conditional P1/P2 absence is recorded and
does not block this exit. Stop ordinary app feature/testing work when these are met;
resume only for a concrete defect, essential UX fix or later model integration.

**FINAL APP EXIT CRITERION AFTER ML INTEGRATION:** additionally integrate the selected
learned model; verify Python/mobile predictions against fixed versioned inputs with
predeclared numeric tolerance and mismatch handling; persist model/input/preprocessing
version and prediction provenance separately from reference labels; characterize final
runtime, peak memory and thermal behavior on named devices with budgets defined before
measurement; run affected final two-device regression and an offline final demo.
Do not invent parity/performance budgets before model selection. All P0 defects closed.
App final acceptance still cannot substitute for held-out scientific evaluation.

| Classification | Items / gate |
| --- | --- |
| BLOCKER BEFORE ML/RESEARCH CAN PROCEED | None established by this audit. Protocol, labels, governance and capture suitability separately gate research collection; those are not app smoke-test approval. If a genuine capture/data-integrity P0 appears, block only collection/dependent measurements, continue unrelated ML planning. |
| BLOCKER BEFORE FINAL DEFENSE/RELEASE | Open B0–B5 evidence/UX closure, any observed P0 defect, and post-ML integration/parity/provenance/performance/regression/demo criteria. |
| NON-BLOCKING / PARALLEL | Second-phone availability and app evidence closure while supervisor/reference/governance/benchmark planning proceeds; conditional update check and feasible P1 coverage. Availability delay is not a reason to suspend research planning. |
| OPTIONAL | P2 orientation/opposite-side extras, destructive OS fault injection and a third-device expansion without a specific risk. |

## Ordered remaining checklist

| Phase | Smallest next action and stop point | Android phone / engineering video / research dataset / supervisor approval |
| --- | --- | --- |
| A: no-phone | Review this plan; confirm Level A device identity from owner record; B0 evidence/recheck only if changed; review implemented bounded setup wording and focused regression evidence. Physical B5 remains pending. | No / no / no / no for engineering; research decisions remain separate. |
| B: second phone | Identify device/OS and exact verified APK containing revised UX; conditional update preservation if possible; B5 (optionally no-clip countdown cancel), then B3 rejection and shared B1 walking pipeline fully offline. B2 handler closure is automated; no separate brief discard recording. | Yes / two planned clips, maximum three including one justified contingency / no / no; informed engineering operator. |
| C: bounded recovery closure | B4 on the disposable B1 session; inspect all P0 outcomes. Stop/diagnose a failure; respect the visit-wide maximum of one evidence-directed extra clip after correction. Record skipped P1/P2. | Yes / no extra by default / no / no. |
| D: pre-ML exit | Sign off B0–B5 scope; pause ordinary app features/testing and focus on ML/research. Research planning can already proceed in parallel; actual collection awaits approved protocol/reference/governance and stable capture. | No / no / none for signoff; future collection separately approved / research decisions yes, app signoff no. |
| E: return after model selection | Selected learned model integration, parity fixtures, versioned saved prediction provenance and performance budgets. Separate authorized implementation task. | Phone for integration/performance / fixed engineering inputs as needed / approved research artifacts for model selection, no new collection implied / research model/evaluation decisions yes. |
| F: final acceptance | Final affected multi-device regression, runtime/memory/thermal characterization and offline release/demo path; close P0 and stop. | Yes / bounded engineering demo inputs as needed / no new research dataset for app acceptance / no additional engineering approval; thesis research approvals remain separate. |

Execution evidence should update the existing acceptance owner document rather than
create competing status histories. Initial planning used no production changes, build,
ADB, phone/video, training or data collection. The subsequent review checkpoint adds
only bounded frontend wording/accessibility and related tests; it performs no APK build
or physical acceptance. Current pre-ML exit status is **PARTIAL**, with second-device
B1, native B3 rejection/retry, Android B4 deletion/reopen/leftover-clear evidence,
B5 unaided comprehension and baseline device identity confirmation still pending.
B2 and the deterministic portions of B3/B4 are AUTOMATED EVIDENCE CLOSED; no
physical-device PASS is inferred. Baseline identity confirmation requires only an
owner record, no clip. A separately authorized build/identity verification is still
needed for the revised setup wording before B5; this checkpoint builds no APK.
Update preservation remains conditional P1 when an older installation/data already
exists; no uninstall/reconstruction. ML/research planning remains allowed in parallel.
