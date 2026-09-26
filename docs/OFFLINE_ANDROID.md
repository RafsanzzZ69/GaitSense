# Offline Android landmark prototype

26 September 2026. SAMSUNG DIAGNOSTIC UPDATE BUILT/VERIFIED; PHYSICAL RETEST PENDING.

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
- App backup disabled in main manifest; release-only overlay removes INTERNET
  and SYSTEM_ALERT_WINDOW. Debug builds keep Metro connectivity.

These are implemented source paths, not evidence of native execution. This is
single-profile prototype storage, not complete FR-01/FR-09 functionality. No ML
gait classifier, clinical score, calibrated measurement or dataset approval.

## Verification performed

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
Manual Samsung installation behavior is still pending.

Rollback: C:/Users/user/Downloads/CSE400Project/output/samsung-camera-update/GaitSense-rollback-F8689C5A.apk
SHA-256: F8689C5AE992A1159369745D9261CD0425C609FE27270E4676E325EE29744640.
Rollback bytes preserved and reverified. Evidence: output/samsung-camera-update/.
The >5% multi-pose gate and 70% usable gate are unchanged; failed-video cleanup
still runs. Overlap metrics are diagnostic only and never exempt a detection.

## Physical device acceptance (partial, user-reported)

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
| Inspect final merged release manifest and network behavior | No INTERNET permission; no uploads |
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
