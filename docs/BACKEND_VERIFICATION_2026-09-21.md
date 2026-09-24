# Backend and Atlas verification — 21 September 2026

## Result

- **23 automated tests passed** in 30.76 seconds, including the real walking-video
  integration test. Tests used disposable loopback-only MongoDB databases, not Atlas.
- **53 live HTTP assertions passed** against the running API on port 8000 and its
  separate worker, backed by the configured Atlas `gaitsense` database.
- Ruff, dependency consistency, static database scripts and generated-schema drift
  checks passed. Two test-library deprecation warnings remain (Starlette/httpx and
  AnyIO); they did not fail tests.

## Live workflow demonstrated

Registration, login, refresh rotation, profile write/read, required consent,
idempotent session creation, invalid-file rejection, video upload, authenticated
download (SHA-256 checked), asynchronous processing, job status, measurement report,
pose retrieval, paginated session history, report history, comparison, NDJSON export,
cancellation, session deletion, logout-all, access revocation and account deletion.

The existing front-view `IMG_6836.MOV` was processed twice through the real worker,
without mocked inference. Each run produced 62 pose frames with 33 landmarks/frame
from a 4.118-second recording. Both produced the same experimental shoulder/hip
height-difference measurements. Identical footage was deliberately repeated to test
comparison plumbing; it does not show longitudinal improvement or clinical validity.

Expected 401, 409 and 422 responses passed their rejection checks; they are not
unexpected backend errors. The default Swagger example credentials are placeholders,
not an existing account, so logging in with them correctly returns 401.

## Database audit

Atlas already matched schema version 2; no new migration or destructive schema change
was necessary. Verified all 20 collection validators, 42 application indexes and their
options, migration checksum, absence of the migration lock and retired indexes, and
zero existing documents violating the current validators.

Seed counts: 3 model records, 4 recommendation templates, 5 consent documents and
1 capture protocol. Model/recommendation seeds are development placeholders, not
clinically approved models or prescriptions.

Current storage covers accounts/authentication, consent, capture/session metadata,
private media references, pose chunks, versioned features/reports, durable jobs,
model/recommendation catalogs, progress infrastructure, audit, throttling and migrations.
It supports the implemented research workflow, not every future project feature.
Dataset/label management, validated clinical model outputs, future feature definitions
and deployment-specific requirements may need additional versioned migrations.
Video bytes are private local files; Atlas contains their metadata and derived records.

## Cleanup and demo

The worker removed the temporary demo account, owned Atlas records and uploaded
video copies. The original research recording was not modified. Only expiring hashed
rate-limit counters may remain until their normal TTL expiry.

A private, gitignored snapshot is at
`tmp/backend-demo/20260921-200952/`. It contains sanitized HTTP check results,
experimental metrics and pose replay data, but no passwords or bearer tokens.
Treat pose data as private: do not publish this snapshot or expose its server publicly.

The local replay is served at `http://127.0.0.1:8766/` while its process runs.
It is a replay of real API results, not the finished frontend or a live status monitor.
Its Play control was exercised in the browser and advanced through all 62 frames.
The API remains at `http://127.0.0.1:8000/docs`.

Reusable verification runner (from the project root, with API and worker running):

```powershell
.\backend\.venv\Scripts\python.exe backend/scripts/demo.py --video research/gaitsense_poc/videos/IMG_6836.MOV --confirm-database gaitsense
```

This explicitly creates temporary test records in the configured database, uploads
the chosen recording through the local API, stores derived data in Atlas, and requests
worker cleanup afterward. Only use a recording authorized for that environment.
The required database-name confirmation guards against accidental targeting.

## Limits of this verification

Not proof of zero bugs, production readiness or clinical validity. This run did not
exercise every device, a deployed cloud storage bucket, Linux/Docker deployment,
load testing, every side-view recording, email recovery, the mobile camera or frontend
integration. Automated tests cover additional ownership, retry, concurrency, retention,
restore and failure cases. The next delivery milestone is connecting the web/mobile
frontend to the verified API, followed by broader recording and deployment validation.
