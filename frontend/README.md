# GaitSense web frontend

The web app is connected to FastAPI. It includes login/registration, recording
upload and processing status, history, comparison, measurement reports, pose
replay, profile editing, consent controls, export and deletion requests.
Web routes use `src/app/*.web.tsx` and `src/web`. The older native screens are a
separate prototype and are **not yet connected**; mobile implementation is next.

## Two versions

- Local connected app: `http://localhost:8081`; API: `http://127.0.0.1:8000`.
  The API uses Atlas; private videos are stored by the backend on this PC.
- [Public showcase](https://gaitsense-research-workspace.cse400projecthfn.chatgpt.site):
  synthetic data only; no signup, uploads, participant data or live backend.

The public showcase stays online without leaving this PC running. The local
connected version requires the API, worker and frontend processes.

## Run on Windows

In VS Code use **Terminal → Run Task → GaitSense Web: Start full local app**.
For a fresh checkout, first complete `backend/README.md`, configure your private
backend environment and run `npm ci` in this folder. Expo 57 requires Node 22.13+;
this project was tested with Node 24.11.1 and Python 3.12.

Alternatively, start the API and worker from the backend README, then:

```powershell
cd frontend
npm ci
npm run web -- --port 8081
```

The API URL defaults to the local API; `.env.example` documents overrides. Use
`localhost:8081` because it is in the backend CORS allowlist. Never put an Atlas
URI or secret in `EXPO_PUBLIC_*`. Tokens live in tab memory; reload requires login.

## Checks and builds

```powershell
npm run typecheck
npm test
npm run build:web
node scripts/build-showcase.mjs
```

`build:web` exports the connected app to `dist`. The showcase script instead sets
sample-only mode, ignores dotenv files, clears bundler cache, scans output and
prepares `../deployment/showcase/dist`. Known sample routes support direct reload.

`scripts/check-live-api.mjs` uses only the temporary fixture account created by
`backend/scripts/web_fixture.py`. Run it with the local API/worker and then run
fixture cleanup; it is deliberately separate from `npm test`.

## Offline Android prototype

Android now enters a local capture/MediaPipe/SQLite prototype. See
[build status and physical-device acceptance](../docs/OFFLINE_ANDROID.md).
It requires a custom native release build, not Expo Go. Kotlin/APK verification
is blocked until JDK/Android SDK are available; JavaScript tests are not proof
of on-device inference. The web routes and public demo remain separate.

## Remaining release work

Hosted API/worker/private storage; password reset/email verification; persistent
session design; accessibility and multi-browser audit; browser-camera recording;
native integration; and broader research validation. No validated health score,
disease classification, fall-risk prediction or treatment recommendation is enabled.
