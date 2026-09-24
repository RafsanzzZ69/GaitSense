# GaitSense backend

FastAPI API + MongoDB v2 + a separate video-processing worker. This is the working
research backend, **not a clinically validated health-assessment product**.

## Current status

- 20 validated collections and 42 named application indexes (plus MongoDB `_id` indexes).
- Register/login, Argon2 password hashing, expiring JWTs, rotating/revocable refresh
  tokens, ownership checks and database-backed login throttling.
- Profiles, versioned consent, capture protocols, idempotent walking sessions,
  bounded private uploads, media downloads, processing/retries/cancellation, reports,
  paginated history, basic comparable-session progress, export and deletion.
- MediaPipe worker saves 33-landmark pose chunks and view-appropriate experimental
  measurements. Reports explicitly list unavailable measurements; no invented scores.
- Local private-file storage works; an S3-compatible adapter is provided. API and
  worker must share the same storage root/bucket. Changing providers requires migration.
- Versioned migrations, pre-migration backup, empty-target restore, read-only checks,
  isolated integration tests, exact dependency constraints, VS Code tasks and CI.

**Atlas was reconnected and migrated on 21 September 2026.** The working Compass
credentials were verified and synced privately to `backend/.env` and `database/.env.atlas`.
A new API signing secret was generated. The `gaitsense` database on
`gaitsense-dev.u2sidlf.mongodb.net` now passes the v2 schema/index checks; its original
three model seeds and four recommendation seeds were preserved. No participant data
was added to Atlas during verification, and the old local database was not changed.

Pre-migration backup: `database/backups/20260921T082612668955` (gitignored). Automated
test writes were in disposable databases and were removed afterward. The API and worker
were started on this machine; use the VS Code tasks to restart them after shutdown.
Connecting Compass alone does not start the API or worker.

## Run on this Windows machine

The Python environment is already installed at `backend/.venv`. In VS Code use
**Terminal > Run Task**:

1. **GaitSense Backend: Test (isolated MongoDB)** works now without Atlas. It starts
   its own loopback-only MongoDB process and removes its temporary data afterward.
2. On a new deployment or future schema update, stop any API and worker, then run
   **Backup and migrate configured database**. Confirm the
   configured name is `gaitsense` before using that task. Today's migration is already
   complete. For another database use
   the CLI's explicit `--confirm-database` option.
3. Run **Check configured database**; it must report version 2, 20 collections, 42 indexes.
4. Run **API** and **Worker** in two separate task terminals.
5. Open `http://127.0.0.1:8000/docs` for interactive API documentation.

Only the API's database connection matters; Compass and the VS Code MongoDB extension
are independent inspection tools. There is no automatic local fallback for Atlas.

### Keep the connection saved

The backend reads its persistent private `.env` on each start. Compass already has a
saved Atlas entry. In VS Code, **GaitSense Atlas: Save connection in VS Code** verifies
the current connection and opens MongoDB's connection flow using discovered replica-set
hosts (a workaround for the extension's SRV lookup failure). Approve Open/Connect once
and choose Global if prompted. Credentials are then managed by the extension's encrypted
secret storage, not copied into checked-in settings. A saved connection survives restarts,
but cannot prevent disconnections, changed passwords, cluster changes or IP restrictions.

## Teammate setup

Prerequisites: Python **3.12** (the tested version), Node.js 18+ for schema checks,
and access to the shared Atlas database. MongoDB Server is needed only for disposable
local tests; alternatively supply an isolated `GAITSENSE_TEST_MONGODB_URI`.

From `backend` on Windows:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File scripts/run.ps1 -Action Setup
```

On macOS/Linux:

```sh
python3.12 -m venv .venv
. .venv/bin/activate
python -m pip install -c constraints.txt -e '.[dev,vision]'
```

Each teammate creates a private `backend/.env` based on `.env.example`; never commit
the URI password or signing secret. The setup script does not provision Atlas accounts,
change IP access lists or overwrite private configuration. `scripts/configure.py` can
generate a new `.env` from the existing `database/.env.atlas`, but refuses to overwrite.
After generation, `backend/.env` is authoritative for this backend.

Commands below run from `backend` with the virtual environment's Python:

```sh
python -m app.cli migrate --confirm-database gaitsense
python -m app.cli check
python -m uvicorn app.main:create_app --factory --host 127.0.0.1 --port 8000
python -m app.worker
python scripts/test.py -q
```

Linux/macOS and Docker definitions are supplied but were not executed on this Windows
host. The CI workflow will test the Linux installation when pushed to GitHub. No
"runs everywhere without errors" claim is made without that verification.

## API workflow / frontend contract

The complete machine-readable contract is [docs/openapi.json](docs/openapi.json).

1. `POST /api/v1/auth/register` or `/auth/login`; use the returned access token as
   `Authorization: Bearer ...`. Never connect a mobile app directly to MongoDB.
2. Read `/consent-documents` and `/capture-protocols`. Record each required consent
   through `POST /me/consents`; research sharing is disabled.
3. `POST /sessions` with `angle` (`front`, `side_left`, `side_right`) and an
   `Idempotency-Key` header unique to that recording request.
4. `POST /sessions/{id}/video`, multipart field `file`. Supports decodable MP4/MOV/WebM,
   2–60 seconds, 5–240 FPS, bounded resolution and configured upload size. Actual
   metadata is decoded server-side; filenames are not used as storage paths.
5. `POST /sessions/{id}/process` returns a job ID. Poll `/jobs/{id}` or `/sessions/{id}`.
   A separate worker must be running. Repeated processing calls do not create duplicate jobs.
6. On completion, the session includes `assessmentId`. Fetch `/assessments/{id}`;
   replay landmarks with `/sessions/{id}/pose?chunk=0`, then subsequent chunks.
7. `/sessions`, `/assessments`, `/progress` supply history/comparisons. Pagination uses
   `limit` and the returned `nextCursor` as `before`.

Other routes: `/me/profile`, `/me/export`, `/auth/refresh`, `/auth/logout`,
`/auth/logout-all`, session `/cancel`, `DELETE /sessions/{id}`, `DELETE /me`.
Deleting an account revokes access immediately; the worker completes physical deletion.
Exports are NDJSON metadata/measurements. Original videos and pose chunks are retrieved
through the separate authorized media/replay routes; this is not a ZIP archive.

The connected web frontend in `frontend/src/web` uses this API contract. The public
showcase deliberately remains sample-only. Android now has a separate offline
capture/landmark prototype backed by local SQLite, not direct MongoDB access;
see `docs/OFFLINE_ANDROID.md` for its current native verification status.

## Processing and scientific boundaries

- Downsample inference to at most 15 FPS, preserving decoded frame order and nominal
  video timestamps; account for image aspect ratio in 2D joint angles.
- Reject insufficient visible body landmarks and multi-person recordings; flag poor
  brightness/sharpness. Thresholds are engineering heuristics, not clinical criteria.
- Front view: projected shoulder/hip height differences. Side view: projected knee
  flexion and arm-angle range; cadence only when sufficient alternating ankle events
  occur in a continuous visible segment.
- Keep definitions, units, missing-feature reasons, quality warnings, model SHA-256,
  pipeline version and capture protocol with outputs. No old PoC pickle is loaded.
- No calibrated speed/stride distance, reliable contact timing, disease classifier,
  fall-risk classifier, exercise prescription or overall health score is enabled.
- No automatic entry/exit/turn segmentation; cadence events and quality gates need
  manual validation. Variable-frame-rate recordings also need further timing validation.
- Progress deltas are descriptive, not an improvement/decline diagnosis.
- Video overlays, trained regressor serving, PDF reports and on-device/offline inference
  are separate next milestones. Pose data is available for a frontend skeleton replay.

## Database lifecycle

The canonical schemas/indexes/seeds are in `database/mongo/bootstrap.js`; generate the
portable manifest with `node database/scripts/export-schema.mjs` from the project root.
`--check` verifies it has not drifted. The backend consumes `database/schema-v2.json`.

For existing databases, use the Python migration command, **with all writers stopped**.
It makes a logical backup first, refuses conflicting existing documents, uses an exclusive
migration marker, creates/updates validators and indexes, preserves existing seed edits,
and records a checksum. It never drops a collection. DDL is not transactional; fix a
reported issue and rerun. A crashed migration can leave version `2147483647`
(`migration_lock`): an operator must verify no migration is still running before removing
only that marker. Do not run the legacy mongosh bootstrap concurrently with the migrator.

The media TTL index is replaced by a cleanup index; files are deleted before metadata.
The previous pose uniqueness index is replaced with `(sessionId, runId, chunkIndex)`.
Those are the only intentionally removed indexes; no documents are removed by migration.

```sh
python -m app.cli backup --path ../database/backups/manual-backup
# Configure a DIFFERENT EMPTY database before restore:
python -m app.cli restore --path ../database/backups/manual-backup --confirm-database gaitsense_restore
```

These are small-development-database logical backups, **not** live point-in-time backups;
they do not include video files. Back up the storage bucket/root separately. Use Atlas
backup policies for deployment. Keep all backup files private.

Worker leases expire after 120 seconds and heartbeat during processing. Attempts use
separate immutable output IDs; only a completed session's assessment pointer is public.
Retries back off, terminal failures enter `dead_letter`, and explicit retries reuse
the job. Deletion waits for active upload/processing leases; interrupted operations are
reconciled by maintenance. Keep the worker running for retention/deletion to complete.

## Tests and deployment

Latest evidence: [backend and Atlas verification](../docs/BACKEND_VERIFICATION_2026-09-21.md)
records 23 passing automated tests and 53 live HTTP checks, including real worker
processing and cleanup. `scripts/demo.py` produces a private local skeleton/results
replay using `scripts/demo.html`; it is an engineering demo, not the finished frontend.

`scripts/test.py` never reads the production URI. It starts an installed `mongod` on a
random loopback port with a temporary data directory, then runs tests against random
`gaitsense_test_*` databases. Cleanup is restricted to those databases and that process.
`GAITSENSE_TEST_VIDEO` optionally runs a consented private walking video end-to-end;
ordinary CI skips this test because private recordings are not committed.

The checked-in constraints record the tested environment; upgrade only with a test run.
`scripts/openapi.py` regenerates the frontend API contract without connecting to a database.

Optional containers: `docker compose -f backend/compose.yaml up --build` from the root,
after configuring and migrating Atlas. The API and worker share a private volume; no
local database container is added. S3-compatible deployments set `STORAGE_PROVIDER=s3`,
`S3_BUCKET`, optional `S3_ENDPOINT_URL`, and standard AWS SDK credentials/IAM.
The S3 adapter has not been tested against a live cloud bucket.

Before public deployment: verify HTTPS/reverse-proxy upload limits, database/service
roles, storage encryption and lifecycle rules, monitoring, restore drills, consent text
review, email verification/password recovery and browser/mobile token storage. The current
registration flow is for a supervised research prototype; it does not verify email.
One-machine local storage is not suitable for API/worker instances on different hosts.
No real participant collection or clinical claims without appropriate review/approval.
