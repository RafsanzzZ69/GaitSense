# Web milestone — 22 September 2026

## Delivered

Responsive landing page, login/registration, dashboard, guided file upload,
processing/retry/cancel states, paginated recording history, comparison, real
measurement reports, visibility-aware pose replay, original-video download,
print/save-PDF, profile editing, consent status/withdrawal, metadata export,
recording/account deletion requests, and explicit synthetic demonstration mode.
Small measurements are no longer rounded to zero. Quality warnings remain visible
on small screens. The local frontend calls FastAPI, never MongoDB directly.

## Verification

- Atlas check: schema version 2, 20 collections, 42 application indexes.
- Backend suite: 23 passed, including the available real-video test.
- Frontend suite: 16 passed (HTTP client, refresh races, expired logout, rejected retries, recording states, consent errors, multipart,
  public-mode request blocking, small-number formatting).
- TypeScript typecheck and production web export passed.
- Live frontend HTTP client: login, profile, consents, session creation, multipart
  upload, worker completion, report, pose, history, progress, private video
  download, export and logout passed. The real clip produced 62 pose frames.
- Browser: real sign-in, persisted profile, dashboard, real report and precision;
  small-screen report had no horizontal overflow and retained quality warnings.
- Public-build browser: landing, synthetic dashboard, direct report refresh,
  working replay (90 synthetic frames); no console warnings/errors in that check.
- Hosting service reported successful public deployment.

## Button and persistence follow-up

The user confirmed the inactive controls were on the public showcase and chose
to keep that version a demo. It now uses explicit account/upload previews instead
of disabled forms that resemble broken controls. Its sample report navigation,
replay, report JSON download and synthetic-example download are available.

The connected local version additionally fixes resumed empty-session uploads,
state-aware process buttons, manual status refresh, expired/missing-token logout,
actionable consent errors, active consent-document selection, and errors inside
deletion dialogs. Report JSON download is also available for real reports.

Direct Atlas verification (`backend/scripts/verify_web_persistence.py`) passed
eight checks using a disposable account: browser profile save; fresh API readback;
stored video metadata/job/features/report/pose; session creation; cancellation;
withdrawal plus processing block; worker deletion; and logout revocation. The
browser submitted display name, birth year and height before the script checked
the database. The verifier does not write those profile values itself.

| Local frontend action | Saved through backend to Atlas |
| --- | --- |
| Create account / Save profile | User and participant profile |
| Review/accept or withdraw processing consent | Versioned consent records |
| Upload recording | Session and media metadata; private video is in storage |
| Process recording | Job, pose chunks, feature measurements and report |
| Cancel / delete recording | State changes followed by worker cleanup |
| Sign out / delete account | Revocation; account deletion also queues cleanup |

Navigation, replay, downloads and printing do not need a database write. Public
demo actions intentionally never write to Atlas.

Tests do not prove absence of all defects. Backend tests reported two dependency
deprecation warnings; Node reported ES-module inference warnings. Neither caused
failures. No dependency major-version upgrade was attempted.

## Public versus connected local app

[Public showcase](https://gaitsense-research-workspace.cse400projecthfn.chatgpt.site)
is sample-only. It does not accept accounts, videos or personal health information.
Real workflow: `http://localhost:8081`, while the API and worker are running.
No private credentials or participant videos were included in the public build.

## Remaining before public real-user release

1. Host API and MediaPipe worker, shared private storage, deployment secrets,
   HTTPS, allowed frontend origin, backups and monitoring.
2. Email verification/password recovery and persistent-session design.
3. Accessibility audit, broader device/browser tests, recovery and load tests.
4. Native mobile integration and browser-camera recording if desired.
5. Larger participant dataset, independent ground truth and clinical validation.

Core research web workflows are implemented, not a finished clinical product or
fully cloud-hosted processing service. Atlas alone does not host API/video jobs.
