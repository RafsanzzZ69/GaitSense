# Bounded Android multi-device and failure-state acceptance plan

9 October 2026. Planning only; reviewed HEAD/origin main:
`326679f1d61417bc88c736d8a3f5012d7fcb2425`.
Model: GPT-6.1 Sol; reasoning: High. No phone, video or dataset used for this plan.
Scientific status: **NOT_EVALUATED**. App reliability and defensible ML/thesis work
remain equal priorities. This plan authorizes no collection or implementation.

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
Budget: one second-device visit, at most **three engineering clips**: one brief
preview/discard clip, one 10–15 s empty-scene rejection clip, one fresh 10–15 s
walking success clip. One cancelled countdown creates no clip. Use the successful
clip for all save/reopen/analysis checks; no separate knee/interval recordings.
Do not create repeated <70% recordings to hunt a pass. If the empty scene unexpectedly
passes or the walking clip fails, record the result and pause that branch for diagnosis.
One targeted rerun is allowed only after a documented cause/fix or test-precondition
correction; otherwise mark BLOCKED and open a focused defect task. No soak loop,
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
| B1 / P0 second-device pipeline | Different physical Android phone, supported API, sufficient storage, correct package/signing identity. Install or update exact APK; enable Airplane mode and confirm Wi-Fi/mobile data off **before** capture. After B3 rejection, explicitly choose anatomical side, direction and upright; record/process once, save; open History/analysis; close/reopen offline and reload. | Install succeeds; >=70% gate passes without tuning; session remains after reopen; geometry and assertions retain provenance; knee, motion and intervals render available for an eligible run. No crash, stuck UI, duplicate save or missing data. Partial output is not automatically a crash: retain component reason and diagnose eligibility; incomplete positive-path proof stays BLOCKED. | Device identity, installation route, full diagnostics, summary/session ID, setup/geometry and three component statuses before/after reopen; network state. | Yes / one walking clip / yes throughout / adds disposable session / reuse saved result for all reloads. |
| B2 / P0 cancellation and preview recovery | Before B3, no active processing; choose setup, start countdown, cancel. Then record a brief clip, Stop recording, inspect preview, Discard video / retake. | Countdown cancellation creates no History entry. Stop produces preview, **not cancellation**; discard removes preview, resets direction/upright, releases controls; subsequent camera preview and Record are usable; existing History unchanged. Error, stuck lock or stale setup is FAIL. Do not process the short clip. | Before/after History count, setup states, preview/discard/Record availability and any error. | Yes / one brief discard clip / yes / deletes only test temporary clip / existing History used as preservation control. |
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
| Countdown cancel; stop/preview/discard | Capture hooks test cancelled countdown, discard and reset; wiring inspected | No newest-build explicit failure-path PASS | B2; stop means preview, discard means cleanup | P0 / History and controls |
| Processing rejects; retry | Mock native error/cleanup and schema rollback tests | Earlier gate failures exist, but new diagnostic rejection/recovery not demonstrated | B3 then B1; no partial session, full error, recover | P0 / diagnostics + successful retry |
| <70% joint quality | Native boundary/mapping/Optional/overlap tests; actual error display harness | Earlier 39/123 and 88/131, reasons unavailable; latest 115/115 success | Automated P0 closure plus B3 shared error path; no deliberately induced low-quality walking clip required | P0 automated; physical reason-specific check P1 only if naturally encountered |
| No pose / multiple people | Native structural accounting and native guard wiring; no-pose branch to be exercised by B3 | Latest zeros; no newest multiple-person rejection evidence | No pose B3; multi guard remains unchanged (existing <=5% multi proportion rule plus exactly-one-pose usable samples), no synthetic people needed | No pose P0; multi physical P1 / full counters if encountered |
| Wrong anatomical side | Binding/mapping tests; no auto-switch | Latest side_right positive path only | Cannot authenticate anatomy or necessarily reject a wrong assertion; B5 comprehension, never require automatic correction | P0 UX; extra opposite-side capture P2 |
| Missing direction/upright | Parser/adapter/presenter tests; unassessed supported | No latest unassessed physical run | Save allowed if capture gate passes; knee may remain, motion/intervals limited with reasons | P0 automated; physical P1 using an existing legacy session, no forced recording |
| Direction/upright conflict | Adapter/loader tests verify null motion and dependent intervals, supported knee independent | No current physical conflict demonstration | Caller/persisted conflict fails closed; current capture UI cannot inject arbitrary conflicting callers | P0 automated only; no production tampering/manual injection |
| Malformed/incomplete payload; native read fails | Loader/adapter validation, count mismatch, stale reads, UI/integration tests | No corrupted-device experiment | Explicit failure/unavailable state, no old session substituted or fabricated measurements; list absence is not proof of deletion | P0 automated only; do not corrupt Android DB |
| Partial/unavailable components | Adapter/presenter/UI tests and continuity exclusions | Latest available components; partial-run evidence not required | Supported components remain, reason/exclusions/nulls retained | P0 automated; physical P1 only if present naturally |
| Close/reopen saved session | Loader lifecycle/metadata tests | Latest offline PASS, unspecified close semantics | Reuse Level A; B1 covers different device and offline-from-start | P0 / B1 shared evidence |
| Delete/reopen; cleanup | SQL cascade/rollback, capture discard/cleanup failure hooks, native cleanup source | Historical deletion PASS; newest deletion absent | B4 UI deletion and saved-data isolation; no all-history deletion | P0 / B4; filesystem inspection P1 |
| Cancel processing; background interruption | UI cancel wiring, mock failure/unmount cleanup; no claim of real JNI cancellation coverage | Historical interruptions, no latest bounded native cancel PASS | Cancellation before save should not commit; keep recoverable cleanup; do not assert instantaneous cancellation or discard committed results | P1 / one targeted physical check if feasible; no repeated kill loop |
| Camera denied; disk full; process death mid-save | Consent/state gates; transaction rollback source/test, not full OS fault proof | No latest qualified fault-injection evidence | Honest error/no partial commit, existing sessions preserved | P1 permission-denied/low-storage if safe; destructive disk exhaustion/kill injection P2, no forced storage damage |

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
| B: second phone | Identify device/OS and exact APK; conditional update preservation if possible; B5 and B2, then B3 rejection, then shared B1 walking pipeline fully offline. | Yes / at most three clips as budgeted / no / no; informed engineering operator. |
| C: bounded recovery closure | B4 on the disposable B1 session; inspect all P0 outcomes. Stop/diagnose a failure; one evidence-directed rerun maximum per corrected case. Record skipped P1/P2. | Yes / no extra by default / no / no. |
| D: pre-ML exit | Sign off B0–B5 scope; pause ordinary app features/testing and focus on ML/research. Research planning can already proceed in parallel; actual collection awaits approved protocol/reference/governance and stable capture. | No / no / none for signoff; future collection separately approved / research decisions yes, app signoff no. |
| E: return after model selection | Selected learned model integration, parity fixtures, versioned saved prediction provenance and performance budgets. Separate authorized implementation task. | Phone for integration/performance / fixed engineering inputs as needed / approved research artifacts for model selection, no new collection implied / research model/evaluation decisions yes. |
| F: final acceptance | Final affected multi-device regression, runtime/memory/thermal characterization and offline release/demo path; close P0 and stop. | Yes / bounded engineering demo inputs as needed / no new research dataset for app acceptance / no additional engineering approval; thesis research approvals remain separate. |

Execution evidence should update the existing acceptance owner document rather than
create competing status histories. Initial planning used no production changes, build,
ADB, phone/video, training or data collection. The subsequent review checkpoint adds
only bounded frontend wording/accessibility and related tests; it performs no APK build
or physical acceptance. Current pre-ML exit status is **PARTIAL**, with second-device
B1, bounded B2–B4 recovery evidence, B5 unaided comprehension and baseline device
identity confirmation still pending. ML/research planning remains allowed in parallel.
