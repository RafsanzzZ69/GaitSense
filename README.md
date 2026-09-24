# GaitSense

Offline-first smartphone gait-analysis research, with an Android landmark-capture prototype and a connected web research workspace.

Clinical gait assessment often requires specialist equipment and clinic access. GaitSense explores accessible video-derived measurements and progress tracking. **This is a non-diagnostic prototype—not a validated medical device, health score, fall-risk predictor or treatment system.**

## Current status

[Current state and handoff](docs/CURRENT_STATE.md) is authoritative; historical progress reports are dated snapshots.

| Component | Implemented | Remaining |
| --- | --- | --- |
| Offline Android | Muted camera capture, bundled MediaPipe, landmark processing, local SQLite history/deletion | Installation, native instrumentation, offline inference and persistence runtime verification |
| Android APK | Native/JavaScript compilation and static APK verification passed | Device acceptance and production signing |
| Web workspace | Authentication, upload/status, history, experimental reports, replay, profile/consent, export/deletion | Hosted API/storage, browser capture, accessibility and release hardening |
| Backend/database | FastAPI, worker, storage adapters; MongoDB v2: 20 collections, 42 application indexes | Deployment and broader operational validation |
| Research | Exploratory feature/model scripts, requirements and study drafts | Approvals, larger independently labelled data, participant-separated validation and model integration |

The [public showcase](https://gaitsense-research-workspace.cse400projecthfn.chatgpt.site) uses synthetic data only. It is separate from the connected local app; public logins/uploads are not deployed.

## Architecture and stack

```text
Primary Android deliverable
Camera → bundled MediaPipe → 33-landmark frames → private local SQLite

Separate connected research workspace
Expo web → FastAPI → MongoDB Atlas (metadata)
                   → private video storage → Python MediaPipe worker
```

React Native/Expo 57, TypeScript, Kotlin, MediaPipe Tasks Vision, SQLite, Python/FastAPI/PyMongo, MongoDB, NumPy and exploratory scikit-learn models. Android's offline prototype does not require Atlas or the backend. Initial build-time downloads still require internet.

## Repository structure

```text
frontend/           Expo web/Android, native module, tests and build scripts
backend/            API, worker, migrations, storage adapters and tests
database/           Canonical MongoDB schema, exported v2 manifest and utilities
research/           PoC scripts and study checks (no participant data)
docs/               Current state, requirements, architecture and roadmap
deployment/         Hosting guidance and showcase tooling
.github/workflows/  Backend and study CI definitions
```

## Prerequisites and installation

Authorized collaborators clone using their own GitHub authentication:

```powershell
git clone https://github.com/RafsanzzZ69/GaitSense.git
cd GaitSense
```

Use Git, Node.js 22.13+ (tested 24.11.1), npm and Python 3.12. Android additionally needs JDK 21 and Android SDK platform/build-tools 36, NDK 27.1.12297006 and CMake 3.22.1, with JAVA_HOME and ANDROID_HOME configured. Windows is the verified build host; other platforms are not yet verified here.

Sanitized environment templates are included. Each teammate supplies private credentials. **Source access does not grant Atlas access:** an administrator must separately authorize the database user and network/IP.

### Android development and APK

From the repository root:

```powershell
cd frontend
npm ci
node scripts/prepare-pose-model.mjs --download
npx expo prebuild --platform android --no-install
.\scripts\android-build.ps1 -Action assemble
.\scripts\verify-android-apk.ps1
```

The downloader retrieves the official MediaPipe asset and checks its SHA-256. Generated native files and binary models are ignored; a clean clone must prepare them. Expo Go cannot run this custom native module. Output: `frontend/android/app/build/outputs/apk/release/app-release.apk`.

The release variant currently uses development signing, not production store credentials. SQLite stores sessions and landmark frames locally. Temporary video cleanup, reload and deletion are implemented; native runtime acceptance is still pending. See [Android details](docs/OFFLINE_ANDROID.md).

Authorized collaborators can download the existing [compile-verified prototype APK](https://github.com/RafsanzzZ69/GaitSense/releases/tag/v0.1.0-prototype). It has not yet passed installation/device acceptance; it is not a production release.

### Backend and MongoDB Atlas

From the root:

```powershell
cd backend
powershell -NoProfile -ExecutionPolicy Bypass -File scripts/run.ps1 -Action Setup
Copy-Item .env.example .env
```

Copy only on a fresh setup; never overwrite a working environment file. Configure your private MongoDB URI/database and a strong random JWT secret. Prepare the pose model using the frontend command above; the backend template points to that asset. Dependencies use pyproject.toml and constraints.txt.

For the application database, use the **backend v2 migration** backed by the exported schema manifest. Before migrating an existing database, stop API/worker, confirm the target and retain a backup.

```powershell
.\.venv\Scripts\python.exe -m app.cli migrate --confirm-database gaitsense
.\.venv\Scripts\python.exe -m app.cli check
.\.venv\Scripts\python.exe -m uvicorn app.main:create_app --factory --host 127.0.0.1 --port 8000
```

In another backend terminal run `.\.venv\Scripts\python.exe -m app.worker`. API and worker must share storage configuration. API docs: http://127.0.0.1:8000/docs. Compass is an inspection client, not the API/worker launcher. See [backend setup, backup and restore](backend/README.md).

### Connected web frontend

With API and worker running, from frontend:

```powershell
npm ci
npm run web -- --port 8081
```

Open http://localhost:8081. The frontend template documents API URL overrides; never put database secrets in EXPO_PUBLIC_* variables. See [frontend guide](frontend/README.md) and [deployment guidance](deployment/README.md). Production hosting/API/worker/private storage remain future work.

## Research PoC and limitations

The [curated PoC](research/gaitsense_poc/README.md) includes extraction, smoothing, gait events, features and exploratory regression. Historical evidence covers eight recordings from four participants; five passed the pose-quality filter. Walking-speed labels were visually estimated from frame boundaries, not independent clinical ground truth. A one-recording holdout cannot support reliable model comparison.

Private inputs, participant tables, derived landmarks/reports and trained pickles are intentionally absent. Obtain consented data through an approved private process. Historical research dependencies are not fully pinned, and source alone cannot reproduce the old experiment. The pretrained pose detector is **not** a validated gait-health model.

## Testing and verification

- From frontend: `npm test`, `npm run typecheck`, `npm run build:web`.
- From backend: `.\.venv\Scripts\python.exe scripts/test.py -q`, using disposable local MongoDB—not the shared research database.
- From root: `python research/study/check.py --check`.

Recorded local evidence: 24 frontend tests, TypeScript/web export, 23 backend tests and 15 study tests passed on 23 September 2026; Atlas v2 checks passed. APK compilation passed on 23 September; static APK verification passed on 24 September. These dated observations do not establish native runtime behavior or scientific validity. Remote CI status must be checked separately.

## Roadmap and known limitations

Next: **Android emulator installation → native instrumentation testing → offline MediaPipe processing → SQLite persistence verification**. Then physical-device acceptance, recording/protocol alignment, approvals, independent labels, larger datasets, participant-separated evaluation and justified model integration.

See [requirements checklist](docs/planning/README.md), [study protocol](docs/planning/STUDY_PROTOCOL.md), [architecture](docs/planning/ARCHITECTURE.md) and [roadmap](docs/PROJECT_ROADMAP.md). Approvals remain pending. Prototype portrait/720p capture differs from draft collection settings. Dependency advisories, production authentication/deployment, signing, accessibility and privacy review remain release work.

## Privacy, contributions and licensing

Keep participant recordings, aliases, derived research data, credentials and generated artifacts out of Git, including in this private repository. See [data policy](docs/REPOSITORY_DATA_POLICY.md) and [contribution guidance](CONTRIBUTING.md). Use synthetic fixtures; never include participant information in issue screenshots or logs.

No project-wide license has been selected. The existing Expo scaffold notice in frontend/LICENSE is retained; it does not establish a license for all GaitSense code or research data.
