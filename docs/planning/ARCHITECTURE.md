# ADR-001: offline core, optional connected research tools

Status: technical baseline selected; supervisor acceptance pending (A-01).

## Decision

Make Android offline capture -> quality -> pose -> features -> inference ->
report -> local history the primary acceptance path. Existing Expo/React Native
code is retained for a native development-build feasibility spike. Do not
rewrite to Flutter just because the PDF recommends it; if the supervisor treats
Flutter as mandatory, obtain a recorded scope decision before implementation.

Spike gate: two physical Android device classes must record H.264 MP4, run a
bundled MediaPipe model and persist pseudonymous landmarks with internet off.
Verify current library minimum SDKs against the PDF's API 26 target before
promising Android 8 compatibility. Expo Go is not the acceptance environment.
Native Kotlin integration/bridge may be needed. Failure of the spike triggers a
documented comparison with native Android or Flutter, not a silent scope cut.

## Boundaries

| Layer | Primary offline target | Existing work retained |
| --- | --- | --- |
| Identity | Local profile, no server login required | Cloud auth for optional research web tools |
| Capture | Camera, countdown, preview, retry, app-private temporary file | Web file upload and native preview |
| Processing | Bundled MediaPipe and versioned feature code on phone | Python worker as reference implementation |
| ML | Exported classical model; export/runtime parity test | Laptop training scripts, not runtime training |
| Persistence | SQLite, app sandbox, versioned migrations | Atlas for explicit optional research use |
| Reports | Offline measures, score explanations, history, export | Web report components/design |
| Network | None required for core operation | Public site remains synthetic showcase |

Python and mobile pipelines must share a versioned feature contract and frozen
numeric fixtures. A model records feature order, units, preprocessing, training
dataset version, split version and model hash. Reject mismatched feature versions.
Do not assume the existing PoC features and backend metrics are interchangeable.

Phone-to-laptop local-network processing is an MVP fallback, NOT full on-device
completion. A fallback must run without Atlas/internet, use private local data
and avoid unprotected personal-data transport. Current localhost + Atlas setup
does not pass that fallback gate merely because the API is on a laptop.

## Explicit conflict resolutions

- Cloud vs offline: offline is required; Atlas/web are optional additional tools.
- Flutter vs Expo: functionality preserved; stack deviation requires review.
- Video retention: default delete after successful extraction; study retention
  is separately consented, time-bounded and reviewed. Current backend default
  of 30 days is NOT compliance with this target.
- Pose quality: propose >=70% usable frames, view-specific landmark checks and
  enough consecutive cycles; validate threshold during pilot. Current backend
  50% gate is not treated as equivalent. Do not change it without tests.
- Absolute speed: exploratory prediction requires independent marked-distance
  labels; not a claim of direct metric recovery from an uncalibrated image.
- Scoring: reference-group consistency, never general health/diagnosis.
- Cloud account recovery, paid hosting, social sharing are not critical path.

## No destructive migration now

Do not delete Atlas records, existing videos, models or native screens in this
preparation task. Do not recruit, upload participant data, train new models or
change production privacy behavior as a side effect of adopting this ADR.
