# Offline Android landmark prototype

Latest diagnostic build: **user-reported Sprint 5 physical acceptance PASS** on
8 October 2026 for the tested Android device/session/build. Scientific status:
**NOT_EVALUATED**. The earlier build/test sections below retain historical
results, artifact hashes and then-pending checks; they are not current status.

## Current authentication-capable build policy — Phase 2C

The Firebase App/Auth native-base checkpoint permits INTERNET for account
authentication. Android grants this permission to the whole process, not only
one library. No gait networking/upload code is added: capture, bundled MediaPipe,
SQLite History and saved analysis remain local/offline. Microphone, broad
storage/media and overlay permissions remain excluded; backup stays disabled.
Earlier physically accepted binaries and the frozen pre-auth Home candidate
had no INTERNET permission; that evidence remains historical. This checkpoint
does not implement login/session UI or establish physical authentication or
Phase 1 Home acceptance. See the [Firebase readiness record](planning/FIREBASE_AUTH_IMPLEMENTATION_READINESS.md).

## Diagnostic-build physical acceptance — 8 October 2026

Recorded on 9 October 2026 from the owner's supplied acceptance account, including
a separate screen-recording demonstration of offline restart. This checkpoint
documents that report; it did not independently inspect private media, execute
a device test or rebuild the APK. The current account does not restate the phone
model/OS; earlier Samsung device details are not automatically assigned to it.

### Build identity and scope

| Property | Accepted diagnostic build |
| --- | --- |
| Source commit | `7d41b5987d204a173c5dca5f91a73d2a50781f22` |
| APK | `frontend/android/app/build/outputs/apk/release/app-release.apk` |
| Size | 117,288,199 bytes |
| APK SHA-256 | `f0fe6c22950ecba42a92e3e2cfa2ba9800d9bb14631802f3549a3711c5c3bfa8` |
| Package | `com.gaitsense.research` |
| versionCode / versionName | `1` / `0.1.0` |
| Minimum / target API | `26` / `36` |
| Signing | APK Signature Scheme v2 verified during the preceding static build check |
| Certificate SHA-256 | `fac61745dc0903786fb9ede62a962b399f7348f0bb6f899b8332667591033b9c` — matched the previous release |

Scope: installed/updated diagnostic release, one fresh engineering side-view
walking recording, saved-session analysis and offline close/reopen persistence.
This is application engineering acceptance, **not research dataset collection**.
Static build/package verification and the owner's physical observations are
separate evidence sources. This does not establish compatibility with all Android
devices or completion of the entire application.

### Earlier rejections and unchanged gate

Earlier engineering attempts included 123/123 pose frames with only 39 usable,
and 131/131 pose frames with 88 usable (67.18%, four short of the required 92).
They preceded detailed joint-level instrumentation. Their exact rejection causes
remain unknown; no side-binding or Sprint 5 regression was demonstrated.
The diagnosis was **CURRENT DIAGNOSTICS HAD BEEN INSUFFICIENT TO DISTINGUISH
IMPLEMENTATION ERROR FROM LEGITIMATE POSE-QUALITY REJECTIONS**. The later success
does not retrospectively explain those failures. See the
[required-joint diagnosis](REQUIRED_JOINT_QUALITY_GATE_DIAGNOSIS.md).

The gate was not tuned using these recordings. A usable sample still requires
exactly one 33-landmark pose with all four selected anatomical joints passing
simultaneously:

| Selected side | Shoulder | Hip | Knee | Ankle |
| --- | ---: | ---: | ---: | ---: |
| side_left | 11 | 23 | 25 | 27 |
| side_right | 12 | 24 | 26 | 28 |

Each selected joint requires visibility >=0.6, presence >=0.6 and normalized x/y
within inclusive [0,1]. Session acceptance remains `usable / sampled >= 0.70`.
No threshold relaxation or automatic side switching occurred. Anatomical side
remains independent of image-x travel direction.

### Successful engineering recording and saved analysis

The owner explicitly selected anatomical side_right, travel toward image right
and upright-image confirmation before recording on the installed diagnostic build.

| Reported diagnostic | Value |
| --- | --- |
| samples / poseFrames / usable | 115 / 115 / 115 |
| Usable rate | 100% |
| view / required indices | side_right / 12,24,26,28 |
| visibilityMin / presenceMin / usableMin | 0.6 / 0.6 / 0.7 |
| noPose / multi / rejected / jointRejected / missingRequiredLandmark | 0 / 0 / 0 / 0 / 0 |
| Exclusive first-failure | none |
| Required shoulder / hip / knee / ankle rejection counts | 0 / 0 / 0 / 0 |

The successful session saved and loaded from History. Projected **2D knee
flexion**, **candidate ankle-motion extrema**, and **candidate-to-candidate
temporal intervals** were available. Native inference geometry loaded from
metadata; image-right travel direction and upright image orientation persisted
with operator-recording-setup provenance.

This supplies real-device engineering evidence for recording setup -> immutable
snapshot -> MediaPipe -> unchanged quality gate -> metadata-v2/SQLite save ->
History reload -> projected knee and candidate motion -> checked continuity ->
candidate intervals. It demonstrates that the unchanged gate can pass a real
recording on this build, without proving why earlier recordings failed.

### Offline restart acceptance

The owner then placed the device in Airplane mode with Wi-Fi unavailable, fully
closed GaitSense and reopened it. History and the new session remained present;
saved data, native inference geometry, operator direction, upright assertion,
projected knee, candidate extrema and candidate intervals loaded again.

**Newest Sprint 5 physical acceptance: PASS for this tested device/session/build**,
including reported offline restart/persistence and saved-analysis reload.
The current report does not establish that this new recording's entire capture
and processing ran offline from the start, specify Android force-stop/process-kill
semantics, directly inspect SQLite/cache files, or report a new deletion test.
The older offline-from-start/deletion reports below remain distinct historical runs.

### Scientific boundaries and remaining work

Scientific status remains **NOT_EVALUATED**. This engineering pass does not
establish scientific/clinical validity, diagnostic accuracy, walking-speed
accuracy, actual decoded-frame PTS, exact-image correspondence or independently
authenticated frame ownership. It does not validate heel strikes, toe-offs,
physical gait events, step/stride times, cadence or 3D knee angles. Knee geometry
remains projected 2D; extrema remain candidates; intervals remain
candidate-to-candidate intervals; timestamps remain requested sampling timestamps.

Both app reliability and defensible ML/thesis evaluation remain required. App work
still includes broader multi-device acceptance; failure-state/preview/restart
robustness; UX/accessibility polish; regression coverage; future selected-ML-model
integration and Python/mobile prediction parity; runtime/thermal/memory testing;
and final release/demo readiness. None is replaced by this single-session pass.
Research protocol, independent references, governance and participant-separated
evaluation remain separate gates before scientific collection/evaluation.

## Implemented scope

- Android entry/legacy routes lead to the offline prototype, not mocked scores.
- Local-processing notice, camera-only permission, three-second countdown,
  actual muted 720p recording up to 15 seconds, stop, preview, discard/retake.
- Local Expo module calls MediaPipe Tasks Vision 0.10.32 on a background executor.
  Model is bundled, SHA-256 verified; no runtime model download.
- Approximately 10 Hz nearest-decoded-frame sampling; 33 x/y/z/confidence points.
  At least 70% usable side-view frames and single-person gate; no gait score.
- Transactional SQLite session/frame storage, reload, coordinate inspection,
  per-session/all-session deletion and failed-attempt rollback.
- Temporary source deleted before successful result commit; failure/cancellation
  cleaned by UI. Explicit cleanup control for recordings left by force-close.
- App backup disabled in main manifest; release-only overlay removes
  SYSTEM_ALERT_WINDOW. Auth-capable builds permit INTERNET; historical pre-auth
  binaries removed it. Debug builds keep Metro connectivity.

Implementation alone is not evidence of native execution; the latest user-reported
physical evidence is scoped above. This is
single-profile prototype storage, not complete FR-01/FR-09 functionality. No ML
gait classifier, clinical score, calibrated measurement or dataset approval.

## Historical automated verification

- 24 frontend tests passed (8 new offline tests, 16 existing tests).
- TypeScript checks passed.
- Expo local-module autolinking discovers GaitSensePoseModule.
- Model copied from existing local official artifact; expected digest:
  `5134a3aad27a58b93da0088d431f366da362b44e3ccfbe3462b3827a839011b1`.
- Expo Android prebuild succeeded; generated configuration inspected.
- Resumed verification: `npm run check:android:inputs` checks the generated
  release privacy overlay, main backup/audio configuration, minimum SDK property,
  model digest and all legacy Android route redirects. Passed locally.
- JS Android export and web regression export checked separately; neither is an APK.
- Gradle release assembly passed on 23 September; static APK verification passed
  on 24 September. Kotlin/Java and JavaScript compilation, manifest permissions,
  model digest and bundled native libraries passed. Full-duration emulator
  offline inference, SQLite restart inspection and deletion subsequently passed
  on 25 September; genuine camera/physical-device acceptance remains pending.
  See CURRENT_STATE.md for current results and fixture-injection limitations.

Tests exercise contract/state eligibility, frame validation, SQLite table SQL
in Node's SQLite runtime (not Android SQLiteOpenHelper), rollback/cascade, model
checksum and permission configuration. They do NOT replace phone tests.

## Build and device test

Requires JDK and Android SDK compatible with the generated Expo 57 project,
Android SDK platform/build tools and an authorized USB-debugging Android device.
The verified APK targets minimum SDK 26; device compatibility remains to be tested.
No paid hosting or Expo account is required for a local build.

From frontend:

```powershell
npm ci
node scripts/prepare-pose-model.mjs --download
npx expo prebuild --platform android --no-install
npm run check:android:inputs
npm run build:android:local
```

Model script reuses existing verified model; downloads only when absent and
--download is explicit. Offline use applies to installed RELEASE app, not initial
dependency/model/build-tool downloads or a debug app relying on Metro.
Builds use the generated development signing configuration unless a release
keystore is separately configured; not an app-store production release.

## Private native test fixtures

Run the existing project script from the repository root:

```powershell
./frontend/scripts/android-build.ps1 -Action test -Architectures x86_64
```

The ignored `frontend/modules/gaitsense-pose/android/src/androidTest/assets/`
directory requires `walking.MOV` (historical short-interval/negative fixture),
`short.MOV` (duration rejection) and `full-duration.MOV` (positive full-video
fixture). On the verified workstation, full-duration.MOV is an unchanged private
copy of authorized IMG_7570.MOV, selected as side_right. Its SHA-256 is
1F8081468C91503938D7B97A5B72D07F59EB409C9980DA5B6EAB55C24976616D.
Do not replace walking.MOV: the historical interval test depends on it.
Fixture/view runner overrides are supported through `-TestRunnerArguments`.
Test assets and test APKs contain private footage; do not commit or distribute
them. The release APK contains no participant videos and need not be rebuilt
when only instrumentation fixtures/tests change.

## Verified Samsung update artifact

Interrupted build completed: BUILD SUCCESSFUL in 3m 11s. No rebuild on resume.
Prior focused checks: 10 frontend tests and 4 native JVM tests passed; TypeScript
passed. Static APK verification and signature comparison passed on resume.
The packaged JS matches generated output; new UI markers and native diagnostic
DEX markers distinguish it from the rollback. No physical retest performed.

APK: C:/Users/user/Downloads/CSE400Project/frontend/android/app/build/outputs/apk/release/app-release.apk
Size: 117230407 bytes.
SHA-256: 18E69CF9F6A8BB54CF496D0A47131D6728475460E93872374A82B5EC9808D577.
Application ID: com.gaitsense.research. VersionCode remains 1, versionName 0.1.0.
Signing certificate matches original (SHA-256
fac61745dc0903786fb9ede62a962b399f7348f0bb6f899b8332667591033b9c), with valid v2
signatures. No downgrade; install as an update without uninstalling/clearing data.
The owner subsequently reports successful testing of this updated APK; see latest report below.

Rollback: C:/Users/user/Downloads/CSE400Project/output/samsung-camera-update/GaitSense-rollback-F8689C5A.apk
SHA-256: F8689C5AE992A1159369745D9261CD0425C609FE27270E4676E325EE29744640.
Rollback bytes preserved and reverified. Evidence: output/samsung-camera-update/.
The >5% multi-pose gate and 70% usable gate are unchanged; failed-video cleanup
still runs. Overlap metrics are diagnostic only and never exempt a detection.

## Earlier Samsung acceptance report — user-reported

The owner reports successful testing of the updated APK on Samsung Galaxy A25
5G (SM-A256E, Android 16): genuine side_right recording, duration 11.533 s;
processing 39.437 s; 116 saved pose frames, 111 usable (approximately 96%);
zero multiple-person detections. Landmark inspection worked. The app reported
raw video deleted; direct filesystem cleanup was not independently verified.

Subsequent acceptance checks PASS by owner report: airplane mode enabled with
Wi-Fi OFF; force-stop and reopen; the 116-frame session persisted; saved landmark
navigation worked; manual session deletion; another force-stop and reopen;
history correctly showed zero sessions. This establishes reported offline
reopening/inspection and deletion persistence through the UI. It does NOT
establish that a complete new capture and processing run occurred entirely
offline, nor directly verify SQLite rows or validate scientific gait accuracy.
No ADB, new test execution, APK rebuild or source changes accompanied this
documentation update. No private screen-recording/video bytes were inspected.

These results supersede the earlier pending Samsung restart-persistence status.
Zero multiple detections in this recording does not prove all false-positive
cases are resolved; black-preview resolution was not separately confirmed.
The then-pending offline-from-start milestone is now completed by the separate
user-reported run below. Broader device/edge-case acceptance and scientific
validation remain separate unfinished work.

## Full offline Samsung acceptance — user-reported, 26 September 2026

Core capture -> processing -> history -> restart -> deletion workflow: manually
PASSED on Samsung Galaxy A25 5G (SM-A256E, Android 16), using the currently
installed updated release APK. The owner enabled airplane mode and turned Wi-Fi
OFF before opening GaitSense and kept both settings unchanged throughout.

The owner recorded a NEW genuine walking video with the phone camera, processed
it and extracted pose data entirely offline, and confirmed the session in local
History. After closing and reopening GaitSense, the session remained available.
The owner deleted it through the app, then closed and reopened the app again;
History contained no previous session data. All these manual checks PASSED.
Closing/reopening is reported here; force-stop was not specified for this run.

This recording is distinct from the earlier 116-frame recording, whose offline
checks covered already-saved session persistence, landmark inspection and
persisted deletion. No frame counts, durations, view or other metrics were
supplied for this NEW recording; earlier metrics must not be attributed to it.
A screen recording was shared in ChatGPT according to the owner; it was not
assumed available locally or inspected for this documentation checkpoint.

This completes the previously pending full offline physical-device workflow
milestone by user report. It does not establish direct SQLite inspection,
scientific gait-measurement accuracy, clinical validation, broad device
compatibility or formal privacy certification. Earlier automated/build results
remain historical; no tests, rebuild, source changes or ADB operations were
performed for this documentation update.

Next pending milestone: targeted physical-device robustness checks, including
repeated camera-preview/restart behavior and edge cases; broader device coverage
and scientific gait-feature validation remain separate unfinished work.

## Physical device acceptance (historical checklist and reports)

Owner subsequently installed the original APK manually via Google Drive and
reported genuine Samsung camera processing: 144 saved frames, 99% usable,
side_left, with landmark inspection. Owner deliberately deleted that session.
Restart persistence and physical cleanup verification remain pending. The
historical ADB installation failure below does not negate the manual install.

Samsung diagnostic update: live camera uses explicit 16:9 FIT_CENTER with a
portrait 9:16 layout; viewport points differ from the 720p capture request.
Black preview is not yet reproduced. Check the actual phone screen, not only a
screen recording; use Restart camera preview once if needed and report any
mount error. Portrait orientation remains required.

The multi-pose/70% gates remain unchanged. Error text and new saved summaries
show aggregate diagnostics (duration, pre-save processing time, encoded/decoded
dimensions, rotation, sample/usable/multi counts and overlap indicators). These
indicators never suppress detections. Failed-attempt diagnostics are transient;
copy text before closing/restarting. No raw footage is retained for diagnosis.

Next manual test: install the verified update OVER the existing app (do not
uninstall or clear data). Enable airplane mode and turn Wi-Fi off. Hold upright,
check the live image and full-body head/foot margins, choose the visible side,
record one consenting subject walking continuously for 10–15 seconds without a
turnaround, then process. Copy diagnostic text, including any rejection. If
successful, force-stop through Android App info, reopen, inspect saved landmarks,
then delete through GaitSense and repeat the restart to check empty history.
Do not infer database-row deletion or cache-file removal solely from UI labels.

26 September Samsung SM-A256E/API36 attempt: initial authorization and light
shell queries passed; checksum-verified existing APK non-streaming installation
timed out at 120 seconds without installer output. A concurrent lightweight
shell check timed out at 10 seconds. Installation/startup not confirmed; no
camera or processing acceptance performed. Stabilize sustained USB/ADB transport
before resuming. See CURRENT_STATE.md and ignored physical-device-verification logs.

| Test | Expected |
| --- | --- |
| Install release, disable internet, stop Metro/backend | App opens and all following core steps still work |
| Deny camera / do not accept notice | Clear permission/notice state; no recording |
| Record own consenting adult clip for 10-15s | Countdown, muted capture, playable preview; no photo-library copy |
| Discard then retry | Temporary source removed; new recording works |
| Process full-body, single-person side clip | Responsive progress, 33 landmarks/frame; local summary saved |
| Reopen/force-stop after completed save | Same history/landmark points read from SQLite |
| Cancel/background during capture or inference | No partial result; cleanup or explicit leftover cleanup available |
| Too-short/no-person/multi-person/occluded recording | Retake message, no scored or fake result |
| Delete one/all | Session and all frame rows removed after restart |
| Clear leftovers after interrupted recording | Only this app's Camera-cache videos removed |
| Inspect final merged release manifest and network behavior | Auth-capable INTERNET permitted; no gait uploads; earlier no-INTERNET binaries remain historical evidence |
| Two physical phone tiers, orientation/decoder checks | Log CPU/OS, latency, rotation, memory, heat and failures |

Known limitations: fixed portrait UI and 720p prototype differ from the draft
landscape/1080p collection protocol. Do not collect dataset v1 with this build
until protocol/settings align and device acceptance passes. Sampling timestamps
are requested nearest-frame timestamps, not decoder presentation timestamps;
rotation, VFR and duplicate-nearest-frame behavior need physical-video validation.
Landmark inspection dots are a normalized plot, not calibrated biomechanics.
Disk-full, process death, OEM backup behavior and native cancellation need tests.

Npm audit reports dependency vulnerabilities (including high severity); do not
call this production-ready or silently force-upgrade the Expo dependency tree.

Implementation references: Expo module guide https://docs.expo.dev/modules/get-started/
and Google Pose Landmarker Android guide
https://developers.google.com/edge/mediapipe/solutions/vision/pose_landmarker/android.
