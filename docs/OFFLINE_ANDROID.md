# Offline Android landmark prototype

24 September 2026. SOURCE AND APK BUILD VERIFIED; RUNTIME ACCEPTANCE PENDING.

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
  model digest and bundled native libraries passed. Installation, camera,
  inference and restart persistence remain unverified. See CURRENT_STATE.md.

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

## Physical device acceptance (all PENDING)

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
