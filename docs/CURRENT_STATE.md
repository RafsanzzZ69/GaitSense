# GaitSense current state

Updated 24 September 2026. Repository: https://github.com/RafsanzzZ69/GaitSense
Visibility: private. Primary branch: main. Use git log -1 for the latest commit.

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

Source implementation and successful compilation are established. APK installation, startup, camera/MediaPipe execution, native instrumentation and SQLite restart persistence are NOT yet verified. Scientific validation is NOT established: the exploratory PoC has four participants, limited quality-passing clips and frame-estimated rather than independent clinical walking-speed labels.

## Exact next milestone — not started during publication

Android emulator installation → native instrumentation testing → offline MediaPipe processing → SQLite persistence verification.

Inspect existing frontend scripts and native tests before proceeding. Reuse the existing APK/build cache; do not rebuild unnecessarily. Instrumentation requires approved private fixtures; keep them out of Git and release APKs. Then test real phones and align prototype portrait/720p capture with the study protocol.

## Remaining issues and decisions

- Study approvals A01–A05, consent/protocol decisions and independent prediction targets remain pending.
- Larger datasets, participant-separated validation and defensible model integration are unfinished.
- No validated disease/fall-risk/health score or treatment advice.
- Production API/worker/storage hosting, signing, authentication hardening, accessibility and dependency-advisory review remain.
- Historical research dependencies/inputs are not fully reproducible from this source checkout.
- No project-wide license selected; preserve existing Expo notice.
- GitHub collaborators and Atlas users must be separately authorized by the owner.

## Fresh-session handoff

Work in C:/Users/user/Downloads/CSE400Project; private repository above, main branch. Read this document, frontend/AGENTS.md, docs/OFFLINE_ANDROID.md and the existing build/test scripts. The APK already compiled and passed static verification; no runtime success should be inferred. Continue only with the explicitly requested next milestone and approved fixtures. Preserve private files and avoid unrelated development.
