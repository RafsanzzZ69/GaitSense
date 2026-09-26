# GaitSense current state

Updated 26 September 2026. Repository: https://github.com/RafsanzzZ69/GaitSense
Visibility: private. Primary branch: main. Use git log -1 for the latest commit.

## Publication verification

- Initial source commit: b6f51fda3eb9dfb30b3759fb9735cf0b6b3bbe60.
- 201 reviewed files pushed; authenticated clean clone succeeded and the
  42-requirement structure check passed from that clone.
- Secret/data audit found only reviewed example/local-development credentials,
  not Atlas passwords or API tokens. Participant records and build outputs are
  excluded. No nested deployment repository was added.
- Private prerelease: https://github.com/RafsanzzZ69/GaitSense/releases/tag/v0.1.0-prototype
- Asset GaitSense-prototype.apk uploaded successfully; GitHub-reported size and
  SHA-256 match the verified local APK. No rebuild was performed.
- Study preparation GitHub Actions passed. Backend CI was still running at
  publication verification; check GitHub Actions for its final result.
- Clone was verified with the owner's existing credentials. Another teammate
  must first receive repository access; no teammate account was impersonated.

## Completed and evidence

- Offline Android source: muted recording, bundled MediaPipe processing, frame validation, SQLite session/frame history and deletion, cleanup/cancellation and privacy configuration.
- Actual release APK compiled on 23 September: BUILD SUCCESSFUL in 15m43s, 544 tasks. Kotlin/Java/native compilation and JavaScript bundling passed.
- Static APK verification passed on 24 September. Package com.gaitsense.research, minimum API 26, camera permission, no INTERNET/audio/storage permissions, backup disabled, bundled JS/model and arm64-v8a/x86_64 MediaPipe libraries; no participant videos.
- APK path on original workstation: C:/Users/user/Downloads/CSE400Project/frontend/android/app/build/outputs/apk/release/app-release.apk
- SHA-256: F8689C5AE992A1159369745D9261CD0425C609FE27270E4676E325EE29744640
- APK size: 117229107 bytes. Development-signed release variant, not production/store signing. Source publication does not rebuild it.
- Web: connected research UI; public showcase remains synthetic-only. Backend: API, worker, experimental measurements, consent/profile/history/export/deletion and private storage.
- MongoDB v2: 20 collections and 42 application indexes; local Atlas check passed 23 September. Source access does not share database credentials.
- Recorded 23 September checks: 24 frontend tests, TypeScript/web export, 23 backend tests, 15 study tests and 42-requirement structural checklist passed. These suites were not rerun for publication.
- Source, setup documentation and sanitized templates prepared for private GitHub publication. Private participant data, credentials, local settings, binary models and build outputs remain excluded.

## Important distinctions

Full-duration emulator processing now PASS with the new authorized IMG_7570 fixture: the unchanged release APK saved 101 real MediaPipe frames with 33 landmarks each, reopened identical data after process restart, displayed saved landmarks and deleted the session/frames. The complete native suite passed 6/6. This supersedes the historical fixture blockers below. These are emulator fixture-injection results, not physical-camera/device acceptance. Scientific validation is NOT established: the exploratory PoC has four participants, limited quality-passing clips and frame-estimated rather than independent clinical walking-speed labels. The three new engineering fixtures have not been assigned invented participant identities or incorporated into the historical research cohort.

## Android emulator verification — 24 September 2026

- Workspace recovered clean on main at b3de31c. Existing release APK reused;
  final SHA-256 still F8689C5AE992A1159369745D9261CD0425C609FE27270E4676E325EE29744640.
  No release rebuild, dependency reinstall, cache clearing or Git push.
- GaitSense_API35, Android 15/API 35, x86_64: installation, bundled-JS startup
  and force-stop/cold relaunch PASS with airplane mode on, Wi-Fi/mobile data
  disabled and no network route. APK has no INTERNET permission. Metro/FastAPI
  were not listening on their usual ports. Tested inference/rejection/cleanup
  paths need neither FastAPI nor MongoDB Atlas; this does not establish the
  still-blocked successful save workflow.
- Emulator graphics errors caused exits, including during the original native
  run. Software rendering alone did not fully resolve this. Resumed with the
  same AVD using -no-window -no-snapshot -gpu swiftshader; focused native run
  and subsequent release UI checks completed without another emulator exit.
- Synthetic-camera countdown/15-second capture reached preview. This is not
  genuine walking-camera or physical-device verification. For release UI
  inference checks, authorized real-video copies replaced synthetic recordings
  in this fresh emulator app's Camera cache through root adb. Originals and
  the APK were unchanged; this is fixture injection, not an app import feature.

### Native instrumentation: 4 passed, 1 failed

The original project script (android-build.ps1 -Action test -Architectures x86_64)
compiled the test APK. Its report confirms passes for shortClipSavesNothing,
consentAndPathBoundaries, transactionRollbackAndForeignKeys and
cancellationSavesNothing. The fifth test lost the emulator during execution.
On resume no Gradle process remained. Only that unresolved test was rerun via
adb am instrument using the already installed test APK and a class#method filter.
realVideoInferencePersistsReopensAndDeletes completed in 48.268 seconds and failed
with the actual error: "Required joints visible in fewer than 70% of sampled
frames; please retake". Successful tests were not rerun. The positive test remains
failing; it has not been weakened or relabeled as successful.

### Fixture diagnosis and offline results

- walking.MOV is an exact SHA-256 match for the existing IMG_6843.MOV side-view
  recording (9.955 seconds). Both the test and release UI selected side_left.
  It contains an empty lead-in and insufficient usable full-body samples.
- The native gate counts ALL requested 100 ms samples in its denominator;
  a usable sample requires exactly one 33-point pose and selected-side shoulder,
  hip, knee and ankle with visibility/presence >= 0.6 and x/y inside the image.
  At least 70% must qualify. No threshold or duration checks were changed.
- A diagnostic desktop run with the same model/settings and 768-pixel limit
  found 100 samples: 37 without a pose, 60 usable on the left, 44 on the right.
  Thus switching sides is not a remedy. These counts are diagnostic, NOT Android
  measurements: desktop MediaPipe 0.10.35/OpenCV decoding differs from Android
  MediaPipe 0.10.32/MediaMetadataRetriever.
- The other duration-eligible existing side clip, IMG_6840.MOV (9.538 seconds),
  yielded 64/96 left-side usable samples (66.7%) and 25 without a pose in the
  desktop diagnostic. The unchanged release APK also rejected it at the 70%
  gate. Remaining existing recordings are below the native 9.5-second minimum;
  front-view recordings are also unsuitable for this side-view acceptance test.
- Offline MediaPipe execution and correct rejection: PASS. Successful validated
  processing: BLOCKED. Neither candidate produced a saved result. No fabricated
  measurements, padded/looped video or validation bypass was used.
- Both release rejection attempts removed their temporary video and left zero
  session/frame rows. Mid-processing UI cancellation (progress was observed at
  20% before cancellation) displayed "Processing cancelled; no result saved",
  removed the temporary copy and left zero rows: PASS.
- The UI leftover-cleanup control deleted an injected leftover MOV while keeping
  a non-video sentinel in Camera cache; the test sentinel was then removed.
  Final force-stop/relaunch and direct SQLite read still showed zero sessions
  and zero frames. Temporary-file cleanup: PASS.
- Native transaction rollback and foreign-key enforcement: PASS. Persistence,
  reopening/inspection of actual saved landmarks and per-session/all-session
  cascade deletion: BLOCKED, since no available tested fixture passed quality.
  Empty history after restart is not evidence of saved-record persistence.

### Evidence and next acceptance step

Detailed private/local evidence is retained under output/emulator-verification/
(Git-ignored), especially native-tests.log, original-native-results.xml,
native-focused-original.log, fixture-diagnostics.log, candidate-result.xml,
cancel-result.xml, cancel-counts.log, leftover-cleanup.log, final-counts.log,
final-relaunch.log and final-apk-sha256.log. UI snapshots and diagnostic frames
remain private local artifacts. Do not publish them or package test fixtures.

At that checkpoint only this state document changed in tracked source. No confirmed application
defect justified a code change or release rebuild. The emulator milestone is
partially verified and blocked, not accepted as a complete workflow. Next obtain
an authorized unmodified 10-15 second single-person side-view fixture meeting
the existing quality gate, then finish positive extraction, persistence,
restart inspection and deletion on the emulator. Physical-device acceptance
(genuine recording, rotation/decoder behavior, interruption/process death,
latency/heat and multiple phone tiers) remains entirely pending. No physical
testing or research/ML work was started.

## Follow-up: reuse all eight existing recordings — 24 September 2026

### Mapping and metric reconciliation

The private research VIDEO_AUDIT.md confirms the requested four side/four front
mapping and participant IDs. data/metadata.csv confirms all participant IDs but
still has view=unknown; it does not independently encode the camera views. No
research metadata was modified. The old quality_summary.csv counts required
landmark availability/non-null x, not the new 0.6 confidence, image-boundary,
selected-side and single-person requirements. Its percentages are not native
acceptance results.

All eight originals were evaluated using the bundled model and native-style
100 ms sampling/768-pixel limit on desktop (MediaPipe 0.10.35/OpenCV). Left/right
values below are actual diagnostic usable counts, not Android measurements.
Re-evaluating the two previously rejected clips was solely to retain per-sample
visibility and identify usable intervals; identical failing Android tests were
not rerun. Original video hashes were recorded before and after and all matched.

| Video | Participant/view | Duration s | Usable left | Usable right | Full-duration suitability |
| --- | --- | ---: | ---: | ---: | --- |
| IMG_6834.MOV | P_01 / side | 7.570 | 49/76 (64.5%) | 18/76 (23.7%) | Too short; whole-clip quality below 70% |
| IMG_6835.MOV | P_02 / side | 9.372 | 56/94 (59.6%) | 29/94 (30.9%) | Too short; whole-clip quality below 70% |
| IMG_6840.MOV | P_03 / side | 9.538 | 64/96 (66.7%) | 6/96 (6.3%) | Native release quality rejection already verified |
| IMG_6843.MOV | P_04 / side | 9.955 | 60/100 (60.0%) | 44/100 (44.0%) | Native release/test quality rejection already verified |
| IMG_6836.MOV | P_01 / front | 4.118 | 42/42 (100%) | 42/42 (100%) | Too short and wrong view |
| IMG_6839.MOV | P_02 / front | 5.787 | 56/58 (96.6%) | 56/58 (96.6%) | Too short and wrong view |
| IMG_6841.MOV | P_03 / front | 9.255 | 77/93 (82.8%) | 72/93 (77.4%) | Too short and wrong view |
| IMG_6845.MOV | P_04 / front | 7.787 | 72/78 (92.3%) | 72/78 (92.3%) | Too short and wrong view |

Continuous all-usable left-side diagnostic intervals were 1.7-6.6 s (6834),
3.0-8.6 s (6835), 6.5-8.8 s (6840) and 3.1-9.1 s (6843). These demonstrate
usable walking footage, but none meets the native 9.5-second minimum. Trimming
the poor lead-in does not create a valid full-duration clip. No looping,
padding, duplicated frames or synthetic pose data was used.

### Isolated native extraction and SQLite: PASS

- Added ShortIntervalComponentTest under androidTest only. It makes a private
  temporary copy of existing walking.MOV (unchanged IMG_6843), reads original
  timestamps 4000..7900 ms at 100 ms spacing, and uses Android MediaPipe 0.10.32
  plus the actual PoseStore. This is a four-second component experiment, not a
  call to the full-duration OfflinePoseProcessor or a release UI success.
- The component retains the >=70% visibility and <=5% multi-person gates.
  Android result: sampled=40, usable=40 (100%), multiple=0, poseFrames=40,
  33 landmarks per frame. Temporary video deletion passed before saving.
- The project script's focused run passed (1 test, 0 failures; 97/104 Gradle
  tasks up-to-date). Gradle uninstalled its test host afterward, so the same
  compiled test APK was installed directly for the cross-process check.
- Direct phase=save passed in 18.910 seconds, storing one session and 40 frames.
  After force-stop, phase=inspect-delete passed in 0.484 seconds in a different
  process (save PID 7647, inspection PID 7971). It compared persisted summary
  and landmark SHA-256, inspected every timestamp/index and finite x/y/z/
  visibility/presence value, deleted the session, reopened SQLite, and verified
  zero sessions and zero frames. Cache cleanup also passed.
- The test database belongs to expo.modules.gaitsensepose.test, not the release
  app. Successful release history/inspection UI and full-duration processing
  remain unverified. No synthetic records were inserted into the release app.
- Native test inventory now has 5 passing tests (4 original plus the new
  isolated component test) and 1 existing full-duration positive-test failure.
  Save and inspection are phases of one additional test, not two new tests.
  Original five-test results remain 4 passed / 1 failed. Its failed positive
  test was neither weakened nor rerun without a new full-duration fixture.

### Changes, evidence and remaining boundary

Tracked changes: docs/CURRENT_STATE.md, the new ShortIntervalComponentTest.kt,
and frontend/scripts/android-build.ps1 (optional TestRunnerArguments hashtable
for focused class/phase execution). Production source, release APK and all
eight original videos remain unchanged. APK SHA-256 still matches the value
above. No dependencies/caches were reinstalled/cleared and nothing was pushed.

Private evidence is in output/emulator-verification/existing-footage/: metrics.json,
per-video *-samples.json, evaluation.md, original-hashes-before.json,
original-hashes-verified.log, native-short-save.log, native-short-save-results.xml,
native-save-for-restart.log, native-reopen-inspect-delete.log and
native-short-metrics.log. Fixture interval/provenance is recorded in fixture.json.
The emulator remained offline; no FastAPI, Atlas or Metro service was needed.

No existing original qualifies for full release acceptance. To close that
remaining boundary, a future authorized side-view recording must be 9.5-16.0 s
(UI target 10-15 s), with a single person and the selected shoulder/hip/knee/ankle
inside the image with visibility and presence >=0.6 in at least 70% of all
samples. Keep the body visible from the start, avoiding empty lead-in/exit time.
This is a precise future requirement, not a request to upload or record footage
during this milestone. Physical-device testing and ML training were not started.


## Full-duration emulator milestone completed — 25 September 2026

Only the three new authorized videos were evaluated; the eight historical videos
were not reanalysed. Existing short/negative fixtures were retained in the native
suite. Originals, private test assets and output evidence are Git-ignored.
Original SHA-256 checks before/after passed; no footage was modified or uploaded.

| Original | Android duration | View used | Android usable samples | Gate | Selection |
| --- | --- | --- | --- | --- | --- |
| IMG_0460.MOV | 11.471 s | side_left | 85/115 = 73.91% | PASS | Backup; empty entry/exit, shorter visible walk |
| IMG_7569.MOV | 12.523 s | side_right | 89/126 = 70.63% | PASS | Marginal backup; empty/partial entry and late framing limits |
| IMG_7570.MOV | 10.048 s | side_right | 101/101 = 100% | PASS | Selected, untrimmed full recording |

Percentages are the production Android usable-frame ratio (selected four joints,
visibility AND presence >=0.6, in-frame, single pose), not mean confidence. The
70% threshold and 9.5–16.0 s duration limits were unchanged. Android decoder
metadata differs slightly from MOV movie-header/video-stream durations; exact
values, resolution/FPS and visual review are in the private evaluation.md below.
IMG_7570 has a continuous left-to-right side-view walk, full-body framing, no
empty lead-in/out and no observed turnaround. No trimming, looping, duplicated
or fabricated frames were used. Review of sequentially decoded images resolved
an initial random-seek/camera-pan ambiguity; no clear turnaround was observed
in the other two visible walking intervals either. Their weaker framing makes
them less suitable than IMG_7570 despite passing the numeric gate.

- Existing GaitSense_API35 API35/x86_64 AVD started with headless SwiftShader.
  Airplane mode remained on, with no network route or Metro/FastAPI listeners.
- Focused full-duration positive test: PASS, 1/1. Complete project-script native
  instrumentation run afterward: PASS, 6 passed / 0 failed / 0 skipped.
  The two additional candidate probes each passed once; these are separate
  evaluations, not extra tests in the reported six-test suite.
- Test-only changes select private full-duration.MOV (byte-identical IMG_7570)
  and side_right by default, with optional fixture/view runner arguments.
  Assertions now inspect all stored 33-point frames, finite values, ordered
  timestamps and session/frame deletion. Build script checks the new asset.
  Only the test APK was incrementally compiled; production code/APK unchanged.
- Unchanged release APK: offline full-video inference PASS, 101 sampled/pose
  frames, 100% usable, 33 landmarks/frame. Authorized fixture copied into the
  synthetic-recording Camera-cache slot through root adb. This is fixture
  injection, not a public import feature or genuine camera recording test.
- Release SQLite save, app force-stop/cold relaunch, history reopening and
  landmark inspection PASS. All 101 ordered rows (3333 landmarks) were finite
  and byte-identical before/after process restart. UI Next frame advanced from
  0 to 100 ms. UI Delete this session followed by another cold launch left
  zero sessions and zero frames, with empty Camera cache. The immediate query
  sent just after the delete tap preceded asynchronous completion; the final
  post-relaunch database query and empty history confirm deletion completed.
- Successful core extraction/storage required neither FastAPI nor MongoDB Atlas.
  Native cancellation, short-video rejection, boundary checks and rollback/
  foreign-key tests also passed in the six-test suite. Earlier release rejection
  and mid-processing cancellation evidence remains historical, not rerun here.
- APK SHA-256 remains F8689C5AE992A1159369745D9261CD0425C609FE27270E4676E325EE29744640.
  No dependency reinstall, cache clearing, release rebuild, commit or push.

Evidence: output/emulator-verification/new-footage/evaluation.md,
focused-native.log, focused-results.xml, complete-native.log,
complete-results.xml, android-0460.log, android-7569.log, native-metrics.log,
release-summary.json, release-evidence-validation.json, release-*.xml,
release-deleted-final-counts.log, release-camera-cleanup.log,
originals-verified.log and apk-hash-after.log. Private landmark dumps and
sequential contact sheets remain ignored on disk.

This milestone changed this document, docs/OFFLINE_ANDROID.md,
OfflinePoseTest.kt and the required-fixture list in android-build.ps1, plus
ignored evidence/test copies. Earlier research cleanup, runner-argument support
and ShortIntervalComponentTest changes were preserved. No emulator fixture
blocker remains. Physical-device acceptance is the next separate milestone,
only when authorized; it was not started. Research collection, feature validation
and ML assessment remain incomplete and were not advanced by this verification.

## Samsung physical-device attempt — 26 September 2026

Physical-device acceptance remains BLOCKED at installation. Samsung Galaxy A25
5G SM-A256E, serial RRCX207054Y, was authorized (`device`) and responsive to
model/API/One UI/storage/package queries. API 36 (Android 16); One UI property
80500. Device reported approximately 54 GB available on /data. Package-path
query found no installed com.gaitsense.research package before the attempt.

The existing release APK SHA-256 matched the verified F8689C5A...744640 digest
above. One explicitly Samsung-targeted `adb install --no-streaming -r` attempt
timed out after 120 seconds with empty stdout/stderr. During that attempt a
lightweight shell echo also timed out after 10 seconds. No installer/security
error was available and installation success could not be established. No
retry, server restart, settings change, rebuild or data deletion followed.

Startup/UI, genuine camera capture, offline processing, physical SQLite
save/reopen/inspection/deletion and cleanup remain NOT TESTED. No physical
duration/quality/frame metrics exist. Earlier emulator results are unchanged.
The USB/ADB transport becoming unresponsive during transfer is the observed
blocker; cable/port/driver/handshake cause is not yet established and no APK
defect has been demonstrated. Next task: stabilize sustained USB/ADB transfer
with a known-good data cable/direct port and inspect targeted driver/ADB
diagnostics, then check package state before any separately resumed install.

Private local logs: output/physical-device-verification/connection-install.log
and install.log. Research cleanup and ShortIntervalComponentTest.kt preserved.
Only status documentation and ignored logs changed; nothing committed/pushed.

## Samsung manual-camera report and diagnostic update — 26 September 2026

The owner reports successful manual installation of the original release via
Google Drive, launch of the offline interface and a genuine Samsung SM-A256E
camera recording processed into 144 saved pose frames, 99% usable, side_left.
The owner saw frame inspection/pose visualization and the raw-video-deleted
history label. The owner explicitly deleted that session; subsequent empty
history is expected, NOT an unexplained persistence failure. These are user-
reported physical observations, not independently inspected video/log bytes.
No attempt was made to recover deleted recordings. Airplane-mode conditions,
exact duration/sample count, physical filesystem cleanup and restart persistence
are not established by that report. It supersedes the historical installation
blocker above, but complete physical acceptance remains pending.

The next recording reported multiple-person rejection despite one observed
subject; preview was black or cropped. Source inspection found a fixed 320-point
camera viewport without ratio selection, using CameraX default fill/crop behavior.
The update explicitly selects Expo 16:9 FIT_CENTER, fits a portrait 9:16 viewport
within half the window, removes camera corner clipping, disables ScrollView
clipped-child removal and adds readiness/mount-error feedback plus camera remount.
720p remains a capture request, NOT the viewport's pixel resolution. App portrait
orientation is unchanged. Black live preview itself is not reproduced or proven
fixed; distinguish actual screen appearance from a screen-recording surface issue.

Native multi-person rejection counts returned pose candidates (numPoses=2) in
more than 5% of ALL samples. Detection/presence/tracking thresholds stay 0.6;
required-joint visibility stays 70%, and multiple-pose samples remain unusable.
No deduplication or confidence-based exemption is introduced. New diagnostics
report sample/no-pose/multiple counts, first/last multiple timestamps, longest
run, second-pose confident-joint range and overlap-candidate count. Overlap means
at least four confident corresponding joints with mean normalized distance <=.05;
it is a heuristic for investigation, NOT proof of a duplicate and NEVER changes
acceptance. The exact cause of the reported rejection remains unconfirmed.

Aggregate diagnostics also report metadata dimensions/rotation, decoded bitmap
dimensions, duration and processing time through inference (before SQLite save).
Failed quality attempts show selectable text only, with no new persistent pose/
video record; normal finally cleanup remains. Success diagnostics accompany the
existing summary, without a database migration. No raw image, coordinate trace,
identity or external telemetry is added. Historical summaries remain readable.

No ADB, emulator run, participant-file analysis, research changes, commit or push
was used in this update. Previous APK preserved at
output/samsung-camera-update/GaitSense-rollback-F8689C5A.apk with original SHA-256.
Interrupted build recovery: the release build finished successfully in 3m 11s
(544 tasks: 64 executed, 480 up-to-date). No Gradle/Java build process remained.
No source corrections, rebuild, ADB action or repeat acceptance tests were needed
on resume. Existing evidence confirms 10/10 focused frontend tests, 4/4 native
JVM tests and TypeScript PASS; these checks were not unnecessarily rerun.

Static integration verified: cameraPreviewSize supplies both live CameraView
and video Preview; ratio=16:9 selects FIT_CENTER in the installed Expo module;
Restart camera preview increments the CameraView key and resets readiness.
Native diagnostics are included in rejection messages surfaced by reportError
as selectable text. Native finally removal and frontend discard remain intact.
This is source/build verification, not a Samsung rendering or false-positive fix
confirmation.

UPDATED APK: C:/Users/user/Downloads/CSE400Project/frontend/android/app/build/outputs/apk/release/app-release.apk
Size: 117230407 bytes.
SHA-256: 18E69CF9F6A8BB54CF496D0A47131D6728475460E93872374A82B5EC9808D577.
This replaces the default output path's old APK; historical F8689C5A references
above identify the rollback/original build, not this new output.

Existing verify-android-apk.ps1 PASS: application identity, API 26 minimum,
no INTERNET/audio/storage permissions, backup disabled, bundled JS/model,
ARM64/x86_64 inference libraries and no participant videos. Packaged Hermes
bundle equals the generated build bundle and differs from rollback; new preview
restart/diagnostic text is present. DEX includes PoseSampleDiagnostics, overlap
and second-pose metrics, updated rejection text and android-pose-0.1.1.

Both APK signatures verify (v2), with matching certificate SHA-256:
fac61745dc0903786fb9ede62a962b399f7348f0bb6f899b8332667591033b9c.
Both application IDs are com.gaitsense.research; versionCode 1 / versionName 0.1.0
unchanged, so no version downgrade. Static identity/signing checks support an
in-place manual update; Samsung installer behavior remains untested. Do not
uninstall or clear application data. Rollback remains unchanged at
C:/Users/user/Downloads/CSE400Project/output/samsung-camera-update/GaitSense-rollback-F8689C5A.apk
(117229107 bytes; F8689C5AE992A1159369745D9261CD0425C609FE27270E4676E325EE29744640).

Evidence under output/samsung-camera-update/: release-build.log,
frontend-tests.log, typecheck.log, native-unit-results.xml, apk-verification.log,
packaged-changes.json, update-compatibility.json and both signature/identity logs.
Source/test files changed for this update: frontend/src/offline/OfflineCapture.tsx,
framing.ts, contract.ts; frontend/tests/camera-framing.test.mjs;
frontend/modules/gaitsense-pose/android/build.gradle;
android/src/main/java/expo/modules/gaitsensepose/GaitSensePoseModule.kt and
PoseSampleDiagnostics.kt; android/src/test/java/expo/modules/gaitsensepose/
PoseSampleDiagnosticsTest.kt (last three paths relative to that module), plus
CURRENT_STATE.md and OFFLINE_ANDROID.md. On resume only documentation and ignored
verification evidence changed. Research cleanup and ShortIntervalComponentTest.kt
remain untouched. Nothing committed/pushed.

Next manual Samsung test: install this update over the existing app, enable
airplane mode with Wi-Fi off, inspect the actual live preview upright (not only
screen-recorded output), and record a single consenting subject walking from
one side with head/feet in-frame for 10–15 seconds. Use Restart camera preview
once if black; report whether it recovers and any mount error. Process and copy
all diagnostic text, even if rejected. On success force-stop/reopen and inspect
saved frames BEFORE deleting, then delete and restart again. Black preview,
possible false rejection and physical restart persistence remain unverified;
no complete physical acceptance is claimed.

## Remaining issues and decisions

- Study approvals A01–A05, consent/protocol decisions and independent prediction targets remain pending.
- Larger datasets, participant-separated validation and defensible model integration are unfinished.
- No validated disease/fall-risk/health score or treatment advice.
- Production API/worker/storage hosting, signing, authentication hardening, accessibility and dependency-advisory review remain.
- Historical research dependencies/inputs are not fully reproducible from this source checkout.
- No project-wide license selected; preserve existing Expo notice.
- GitHub collaborators and Atlas users must be separately authorized by the owner.

## Fresh-session handoff

Work in C:/Users/user/Downloads/CSE400Project; private repository above, main branch. Read this document, frontend/AGENTS.md and docs/OFFLINE_ANDROID.md. Use the verified Samsung diagnostic-update APK and preserved rollback described above. Full-duration emulator workflow is complete: 6/6 native tests plus release offline extraction, SQLite process-restart inspection and deletion PASS using IMG_7570. The historical unsuitable-fixture blocker is resolved. The owner manually installed the original APK and reported 144 frames/99% usable, then deliberately deleted that session. The new diagnostic APK is built/verified for manual update; do not depend on ADB. Next verify preview behavior, rejection diagnostics and restart persistence on Samsung. Preserve private files and avoid unrelated development.
