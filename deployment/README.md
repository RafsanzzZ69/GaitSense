# Deployment boundaries

Public showcase: https://gaitsense-research-workspace.cse400projecthfn.chatgpt.site

The isolated checkout is `showcase/`, not the main project repository. Its
`.openai/hosting.json` preserves the existing Site ID. Reuse it for future updates.

Run `node frontend/scripts/build-showcase.mjs` from the project root to prepare
allowlisted source and static output. Publish through the Sites hosting workflow.
The bundled helper was absent during this run; `publish-static-fallback.mjs`
provided a restricted Git/validated-tar fallback, receiving the short-lived
credential only over hidden stdin. Never put that credential in a file or command
argument. Native save/deploy/status calls complete publication.

Do not publish backend configuration, Atlas credentials, private storage or
participant recordings. This public version has no live accounts or upload API.

Real public processing requires a Python API runtime, a MediaPipe worker, shared
private storage, pose model, secrets, CORS configuration, HTTPS, retention jobs
and monitoring. See the backend README for existing Docker/storage configuration.
No paid account, billing agreement or public tunnel to this PC was created.
