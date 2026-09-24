# GaitSense MongoDB

This folder is the reproducible MongoDB foundation for GaitSense. Schema v2 creates 20
validated collections, 42 named application indexes, a least-privilege application
user, three placeholder ML model-version records, and four safety-oriented
recommendation templates.

**For the shared Atlas backend, start with [../backend/README.md](../backend/README.md).**
The backend now owns accounts, consent, uploads, jobs, reports and cleanup. Its
`app.cli migrate` command backs up existing data before migration and `app.cli check`
is read-only. Atlas `gaitsense` was backed up, migrated and verified on 21 September
2026 (20 collections, 42 application indexes). The original local database was unchanged.

`mongo/bootstrap.js` is the canonical schema for new databases; `schema-v2.json` is its
generated backend manifest. Regenerate with `node scripts/export-schema.mjs`, or verify
with `node scripts/export-schema.mjs --check`. Legacy mongosh `verify.js` performs
temporary synthetic writes; use the Python read-only checker on a shared database.

The local Docker instructions below are optional development tooling, not Atlas setup.

## Quick start

Prerequisites:

- Docker Desktop with Docker Compose v2
- Node.js 18 or newer (only for the convenience commands)
- VS Code is optional; recommended extensions and tasks are already included

From this `database` directory:

```powershell
Copy-Item .env.example .env
node scripts/db-cli.mjs up
node scripts/db-cli.mjs verify
```

On macOS/Linux, use `cp .env.example .env` for the first line. The `.env` copy is
optional for a quick local run because Compose has matching development defaults, but
creating it makes credentials explicit and easy to change.

The application connection string using the default local credentials is:

```text
mongodb://gaitsense_app:local_app_password_change_me@localhost:27017/gaitsense?authSource=gaitsense
```

Never use those default credentials outside local development. Do not use the root
account from the mobile app or API.

## Commands

| Command | Result |
|---|---|
| `node scripts/db-cli.mjs up` | Start MongoDB and wait for health |
| `node scripts/db-cli.mjs status` | Show container status |
| `node scripts/db-cli.mjs logs` | Follow the last 100 MongoDB log lines |
| `node scripts/db-cli.mjs migrate` | Reapply schema, indexes, app user, and seeds |
| `node scripts/db-cli.mjs verify` | Verify collections, storage, validators, indexes, and seeds |
| `node scripts/db-cli.mjs down` | Stop containers but preserve data |
| `node scripts/static-check.mjs` | Check required files and JavaScript syntax without Docker |

Equivalent `npm run ...` aliases are in `package.json`. If Windows PowerShell blocks
the `npm.ps1` shim, use the direct Node commands above or `npm.cmd run db:verify`.

### Destructive local reset

Reset is deliberately guarded because it permanently removes the local database volume:

```powershell
$env:CONFIRM_DATABASE_RESET = "yes"
node scripts/db-cli.mjs reset
Remove-Item Env:CONFIRM_DATABASE_RESET
```

Then run `node scripts/db-cli.mjs up` to create a fresh database.

## VS Code

Open the repository root in VS Code. Use **Terminal > Run Task** and choose one of the
`GaitSense DB` tasks. Install the recommended MongoDB extension, choose **Add
Connection**, and paste the application connection string above.

The extension is for inspection only; the checked-in bootstrap remains the source of
truth so every teammate gets the same schema.

## Repository layout

```text
database/
├── docker-compose.yml       # Local MongoDB 8.0 service and persistent volume
├── .env.example             # Safe-to-commit configuration template
├── mongo/
│   ├── bootstrap.js         # Idempotent schema migration, indexes, app user, seeds
│   └── verify.js            # Live database verification
├── scripts/
│   ├── db-cli.mjs           # Cross-platform Docker command wrapper
│   └── static-check.mjs     # Checks that run even without MongoDB
└── docs/
    ├── collections.md       # Relationships and collection responsibilities
    ├── data-lifecycle.md    # Privacy, retention, deletion, and production controls
    └── query-examples.md    # Common application query patterns
```

## How initialization and migration work

For a brand-new Docker volume, the official MongoDB image runs `bootstrap.js`
automatically. Existing volumes intentionally do not rerun Docker initialization;
after pulling schema changes, run:

```powershell
node scripts/db-cli.mjs migrate
node scripts/db-cli.mjs verify
```

The bootstrap is idempotent: it creates missing collections, updates validators with
`collMod`, ensures named indexes, upserts catalog seed records, and records migration
version 1. It does not insert fake users or patient gait data.

## Design decisions

- Raw video is stored in object storage, not MongoDB. `media_assets` stores its metadata.
- Pose frames are capped at 120 per `pose_chunks` document to bound document growth.
- Reports reference exact feature/model versions for reproducibility.
- Recommendations are snapshotted into each assessment assignment so old reports do
  not silently change when the catalog is edited.
- Expired media metadata, refresh tokens, and audit data support TTL indexes.
- Development uses a standalone MongoDB container. Production transactions, high
  availability, backups, and encryption require an Atlas cluster or replica set.

See [docs/collections.md](docs/collections.md) for the complete model and
[docs/data-lifecycle.md](docs/data-lifecycle.md) before using real participant data.

To host the database online and share controlled access with teammates, follow
[docs/atlas-sharing.md](docs/atlas-sharing.md). A local Compass connection is not
internet-accessible.

After configuring Atlas network access and a temporary Atlas-admin database user,
deploy the complete schema without placing credentials on the command line:

```powershell
Copy-Item .env.atlas.example .env.atlas
# Edit .env.atlas with the real Atlas database-user credentials.
npm.cmd run atlas:setup
```

The `.env.atlas` file is ignored by Git and must never be shared.

## Integrating the future FastAPI backend

Set the backend's `MONGODB_URI` to the application connection string and obtain the
database name from `MONGO_DATABASE`. Keep MongoDB `ObjectId` values as BSON internally;
serialize them to strings only at the API boundary. Each request must enforce that the
authenticated `userId` owns every session and derived record it accesses.

For writes spanning several collections, use an idempotency key and compensating
cleanup during local standalone development. Move production to a replica set/Atlas
before relying on multi-document transactions.

## Health-product boundary

The current seeded models are marked `development` and inactive. They must not produce
real health claims. A model should only become `approved` and active after dataset
license review, subgroup performance evaluation, clinical validation, calibration,
and versioned approval evidence.
