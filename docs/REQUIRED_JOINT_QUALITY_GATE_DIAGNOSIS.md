# Required-joint quality gate: real-device diagnosis

8 October 2026. Audited baseline: `3f93b105eeb8d8f4fcfddaee9e8bde38dd897f66`.
Model: GPT-6.1 Sol; reasoning: High. Local diagnosis requires no phone, new video,
or research dataset. Scientific status remains **NOT_EVALUATED**.

## Conclusion and limits of the evidence

**C. CURRENT DIAGNOSTICS ARE INSUFFICIENT TO DISTINGUISH A FROM B.**

No anatomical-side, Sprint 5 setup, count, threshold or coordinate-remapping bug
is demonstrated by the inspected source/history and deterministic tests. This
does not establish that the physical recording's quality was insufficient, nor
exclude a device/model/decoder problem. Framing is not established as the cause.

| User-reported engineering evidence | Samples | Pose frames | Usable | Rejected joint-quality samples | Ratio | Minimum usable for acceptance |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| Earlier failed attempt, 12,210 ms | 123 | 123 | 39 | 84 | 31.71% | 87 |
| 7th attempt, 13,066 ms | 131 | 131 | 88 | 43 | 67.18% | 92 |

Both have `noPose=0`, `multi=0`, encoded 1280x720, rotation metadata 90,
decoded 720x1280. The 7th misses acceptance by four usable samples; this is not a
reason to lower the gate. The user confirms the whole person, head and feet
remained framed. Detection on every sample does not prove confidence/bounds
success on every selected joint. Neither the identity nor the reason for the
43 (or earlier 84) failures is recoverable from those aggregate diagnostics.
The old accepted ~129-frame/~74%/side_left session is not a controlled comparison.

Original diagnostics counted missing/multiple poses and aggregate usable frames,
but not per-joint rejection reasons or the failed request's selected side.
The raw outputs temporarily existed inside processing. Rejected sessions are not
committed; source cache video is deleted in native cleanup. They cannot be
retrospectively reconstructed from the error string. No private video was opened
or used in this task.

## Exact production path and unchanged definition

Evidence: [capture component](../frontend/src/offline/OfflineCapture.tsx),
[immutable setup binding](../frontend/src/offline/recording-analysis-setup.ts),
[bridge interface](../frontend/modules/gaitsense-pose/index.ts),
[native module/processor](../frontend/modules/gaitsense-pose/android/src/main/java/expo/modules/gaitsensepose/GaitSensePoseModule.kt),
[native setup parser](../frontend/modules/gaitsense-pose/android/src/main/java/expo/modules/gaitsensepose/RecordingAnalysisSetup.kt).

1. Each side button calls `setView(side)` with its own literal value. `view` starts
   as side_left on mounting. It means the participant's anatomical side, not
   screen position or image-x direction. Controls lock during the attempt.
2. `recordingSetup.current.start(view,direction,upright)` creates a frozen snapshot
   before countdown. It stays bound through capture and preview.
3. Processing reads that snapshot and calls
   `processVideoWithSetup(source,setup.view,consent,serializeRecordingSetup(setup))`.
   The serialized setup contains direction/upright only; view is argument two.
4. Kotlin receives `(uri, view, consent, setupJson, promise)`, parses the setup
   before queuing, and forwards view unchanged to `OfflinePoseProcessor.process`.
   Unknown view is rejected. The setup parser does not default/swap anatomical side.
5. Native processing verifies the bundled full pose model, requests frames every
   100 ms, resizes without upscaling to maximum edge 768, converts to ARGB_8888,
   and calls MediaPipe Tasks Vision 0.10.32 in VIDEO mode, up to two poses.
6. A usable sample must have **exactly one pose, exactly 33 landmarks, and every
   selected shoulder/hip/knee/ankle passing all tests simultaneously**:

| Side | Shoulder | Hip | Knee | Ankle |
| --- | ---: | ---: | ---: | ---: |
| Anatomical side_left | 11 | 23 | 25 | 27 |
| Anatomical side_right | 12 | 24 | 26 | 28 |

For each required joint: `visibility.orElse(0f) >= .6f`,
`presence.orElse(0f) >= .6f`, `x in 0f..1f`, `y in 0f..1f`.
Bounds and confidence cutoffs are inclusive; no epsilon or edge tolerance is
applied. Missing confidence fails as zero. NaN fails these comparisons; no new
numeric acceptance policy is introduced. z is not used by this capture gate.
Heel and foot-index landmarks are not required. Opposite-side joints cannot
reject an otherwise usable selected-side capture sample.

`poseFrames` counts full single-pose outputs even when joint quality fails.
`usable` counts only outputs passing all four joint checks. Every requested sample
stays in the denominator, including decode-null, no-pose, malformed or multiple
outputs. Acceptance requires `usable / sampled >= .7` and separately the existing
multiple-pose proportion `<= .05`. The single-person gate remains unchanged.
Thus full outputs on 123 samples can coexist with only 39 usable ones.

Rotation metadata is logged, not used to rotate coordinates, choose side or
remap joints. Coordinates are tested in the inference bitmap's normalized image
space, after decoder output and resize. For the reported 720x1280 output the
current resize produces 432x768. Dimensions alone do not authenticate upright
image content or decoder correctness. The app supplies no extra MediaPipe image
rotation option. The upstream video overload documents default processing
without an additional rotation. [Pinned MediaPipe API source](https://github.com/google-ai-edge/mediapipe/blob/v0.10.32/mediapipe/tasks/java/com/google/mediapipe/tasks/vision/poselandmarker/PoseLandmarker.java).

Visibility/presence are Optional fields; absent values are preserved as absent
in the API conversion, rather than guaranteed to exist on every result.
[Pinned container source](https://github.com/google-ai-edge/mediapipe/blob/v0.10.32/mediapipe/tasks/java/com/google/mediapipe/tasks/components/containers/NormalizedLandmark.java).
The Android guide describes normalized image coordinates and landmark visibility,
and its output example includes both confidence fields. That example is not
proof that these failed recordings supplied them. [Official Android guide](https://developers.google.com/edge/mediapipe/solutions/vision/pose_landmarker/android).

The gate operates on raw Float outputs before landmark JSON serialization;
Float-to-Double storage conversion does not choose usability. New instrumentation
records Optional availability, distinguishing missing fields from genuine low
scores, while retaining zero-fallback acceptance. No evidence currently proves
missing presence, occlusion, wrong side or out-of-frame estimates caused failure.

On failure, Expo rejects with the native message. `reportError` displays that
message in a selectable alert Text inside the existing ScrollView. Cleanup then
clears the active binding and direction/upright. It does not mutate the frozen
snapshot or in-flight native arguments. `resetSetup` itself does not set view;
a screen remount initializes side_left. A post-failure control value is not
evidence of the failed request's anatomical side. Cleanup errors can still
supersede the original message; that existing failure path was not changed.

## Required-set audit and Sprint 5 comparison

| Layer | Required landmarks | Implication |
| --- | --- | --- |
| Current native capture contract, preserved | Selected shoulder/hip/knee/ankle | Shoulder is a legacy capture-quality requirement |
| [Knee analysis](../frontend/src/offline/knee-flexion.ts) | Left 23/25/27, right 24/26/28 | Shoulder is not used for knee flexion |
| [Motion candidates](../frontend/src/offline/motion-candidates.ts) | Both hips 23/24 plus selected ankle 27 or 28 | Capture acceptance does not guarantee motion availability; opposite hip has its own downstream checks |

This is a difference between layers, not a demonstrated implementation defect.
The shoulder belongs to the older capture gate rather than either current
downstream calculation. Any proposed future change needs an explicit capture
contract review and evidence, including how motion's bilateral-hip requirements
should be handled. It is not relaxed here. Component-level exclusions remain.

Inspected `git diff 92b4648 d366c62` (immediately before explicit recording setup)
and `git diff 92b4648 HEAD` for native/capture code. Native changes add the queued
helper/setup overload and persist assertions. Required indices, .6 confidence,
inclusive bounds, bitmap processing, usable counting and .7 gate did not change.
JS invocation now uses the immutable captured view rather than live state; its
argument order matches Kotlin. The earlier `b6f51fd..HEAD` native diff likewise
preserves those required joints/cutoffs. No Sprint 5 quality-gate regression is
demonstrated. This source comparison cannot rule out every physical-device issue.

## Local diagnostic enhancement

[RequiredJointQualityGate](../frontend/modules/gaitsense-pose/android/src/main/java/expo/modules/gaitsensepose/RequiredJointQualityGate.kt)
extracts the unchanged decision into the tested accumulator used by production.
[DiagnosticPoint adapter](../frontend/modules/gaitsense-pose/android/src/main/java/expo/modules/gaitsensepose/PoseSampleDiagnostics.kt)
keeps raw values and Optional availability. Native diagnostic text now adds:

- `qualityGate=required-joint-1`, request `view`, required indices and cutoffs.
- `qualitySamples`, `qualityPoseFrames`, total rejected, noPose, multi and invalid
  landmark count. `missingRequiredLandmark` is a subset of invalid-count outputs;
  malformed outputs never enter the full-pose joint counters.
- `jointRejected`: number of rejected full 33-point single-pose samples.
- `firstFailureExclusive`: one index/reason attribution per joint-rejected sample,
  ordered shoulder, hip, knee, ankle, then visibility, presence, bounds. These
  counts sum exactly to `jointRejected`. First failure is not the sole cause.
- `jointFailuresOverlapping`: each named joint's failed-sample count and all
  `lowVisibility`, `missingVisibility`, `lowPresence`, `missingPresence`,
  `outOfFrame` counts, including zeroes. These can overlap within/across joints
  and must not be summed as distinct rejected samples. Low-confidence counters
  mean a supplied value failed `>= .6f`, including NaN; outOfFrame also includes
  nonfinite coordinate failures of the original bounds comparison.

Accounting identity:
`sampled = usable + jointRejected + noPose + multiple + invalidLandmarkCount`.
For the 7th attempt's shape, exclusive first-failure counts would account for all
43 rejected samples and overlapping counts would expose additional joint/reason
failures. **The current APK did not produce this information**. It cannot be
retroactively applied. No per-frame coordinates, images or timestamps are added
to logs, no network analytics, no alternate-side fallback. Diagnostic counts
stay in the existing local error/success-summary channel. Successful SQLite
summaries retain them; failed errors are not a new persistent attempt ledger.
The error wording now names visibility/presence/bounds instead of claiming only
visible framing and asking for an immediate retake. UI production code is unchanged.

## Verification and next device gate

[Native tests](../frontend/modules/gaitsense-pose/android/src/test/java/expo/modules/gaitsensepose/RequiredJointQualityGateTest.kt)
use synthetic points and the actual MediaPipe landmark container/Optional adapter,
without video, model inference or JNI. The 88/131 and 39/123 counter examples
deliberately choose fake failure reasons; they do not label the user's recordings.
[Capture/lifecycle tests](../frontend/tests/recording-analysis-setup.test.mjs)
exercise actual handlers under controlled hooks, both anatomical sides across
all direction/upright combinations, immutable binding, cleanup and full diagnostic
error display. Wiring inspection verifies rotation/setup cannot select side;
it does not test physical decoder orientation or pose anatomical correctness.

Verification completed:

- `node --experimental-strip-types --test tests/recording-analysis-setup.test.mjs
  tests/offline.test.mjs tests/recording-state.test.mjs`: **65 passed, 0 failed,
  0 skipped** (55 setup/capture, 8 offline, 2 recording-state).
- Gradle `:gaitsense-pose:testDebugUnitTest`: **42 passed, 0 failures/errors,
  0 skipped**: 25 new quality-gate tests, 4 existing pose diagnostics, 6 native
  recording-setup, 7 inference-metadata tests.
- `:gaitsense-pose:compileReleaseKotlin` and the debug Kotlin compilation required
  by unit tests: passed. No assemble/package/install task was invoked.
- `npm run typecheck`: passed; no TypeScript production source was changed.
- `git diff --check` and new-file whitespace checks: passed (new-file no-index
  checks return 1 for the added-file difference, with no whitespace errors).
  All **11** local document links resolve.

These tests do not run a physical camera, decode a real video or execute pose
inference. Build output included SDK-XML-version and Gradle-deprecation warnings;
compilation/tests succeeded. Counts are local verification, not device acceptance.

Task changes are limited to this document, the native module and diagnostic-point
adapter, the new quality-gate helper and native tests, and the setup/capture test
file. Comparison against the 331-file starting SHA-256 snapshot confirms exactly
three existing task files changed and three task files were added. All unrelated
tracked/untracked/protected files match, including `docs/CURRENT_STATE.md`,
`ShortIntervalComponentTest.kt`, `output/task8-apk/verify-current-bundle.cjs`,
the research reconciliation and the existing APK. The index is empty and HEAD
remains the audited baseline; no commit/push occurred. No research scripts were executed.

A future diagnostic APK build/install is required to use this local change on a
phone; **no APK is built in this task**. The existing release artifact remains
`frontend/android/app/build/outputs/apk/release/app-release.apk`,
SHA-256 `ea14cded9e2cb6490f878f9cb7f4b857b649899e2bb2e495d0bcc0498b729519`,
package `com.gaitsense.research`. A further physical engineering attempt is needed
eventually for joint-level attribution, after review/build/install of the diagnostic
change. No new recording is requested during this diagnosis. No speculative
framing/side/direction change is prescribed. The meaningful difference in that
future check is the instrumented build and complete diagnostic text, including
the request-side and joint counters. Any subsequent capture adjustment should
follow that evidence. No research dataset is needed.

Both tracks remain mandatory: app reliability/physical acceptance and scientifically
defensible ML evaluation. No training, new data, V1/V2 research-manifest changes,
APK build, ADB, staging, commit or push belongs to this local diagnosis.
