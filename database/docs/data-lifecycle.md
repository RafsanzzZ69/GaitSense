# Privacy, security, and data lifecycle

Gait video, pose landmarks, health context, and assessment outputs are sensitive health
data. Treat the development defaults as local-only and complete a legal/security review
before collecting real participants.

## Storage boundaries

- Store video in encrypted object storage. `media_assets` stores only its key, checksum,
  size, encryption reference, and expiry.
- Store only password and refresh-token hashes; never plaintext credentials or tokens.
- Keep account identity (`users`) separate from health context (`participant_profiles`)
  so exports and research datasets can be de-identified.
- Do not put presigned URLs in MongoDB; generate short-lived URLs when authorized.

## Suggested retention stages

1. Source video: shortest useful period (for example, 7–30 days), represented by
   `media_assets.expiresAt` and an object-storage lifecycle rule.
2. Pose chunks: retain only when the user has consented to processing/research; otherwise
   remove after feature extraction and quality review.
3. Features and assessments: retain for progress tracking while the account is active.
4. Refresh tokens: `expiresAt` TTL index automatically removes expired records.
5. Audit events: set `expiresAt` according to the approved audit-retention policy.

MongoDB TTL deletion is asynchronous, so it must not be the only mechanism for a strict
deletion deadline. A cleanup worker should also remove object-storage content and record
the outcome in `audit_events`.

## Account deletion order

The API should first disable the account and revoke tokens, then run an idempotent purge
job scoped to the exact user ID:

1. Delete external media objects and mark/delete `media_assets`.
2. Delete processing jobs, pose chunks, features, recommendations, progress, assessments,
   sessions, profile, consent records as permitted by policy, and refresh tokens.
3. Anonymize or delete audit events according to legal obligations.
4. Delete the user identity last and retain a non-identifying purge receipt outside the
   application database if required.

## Production controls still required

The v2 backend implements owner checks, rotating/revocable tokens, rate-limit counters,
private uploads and a retryable worker-managed purge. Its default video retention is
30 days. Pose and measurement records remain until session/account deletion. The
worker must run for expiry and physical deletion to finish; API downloads deny access
to expired media even before cleanup runs. Deletion waits for active work leases.

`media_assets` no longer has an expiry TTL: deleting the metadata first could orphan
the video. The worker deletes the blob before its record. Auth sessions, refresh tokens,
rate counters and configured audit events still use TTL. Development backups are not
live snapshots and do not include video storage. See `backend/README.md` for backup,
restore, recovery and cloud deployment boundaries.

- TLS in transit, encryption at rest, secret management, backups, restore testing.
- Least-privilege roles; the application user must never use the root credential.
- Rate limits, tenant/owner checks, audit logging, and security monitoring.
- Dataset licenses, institutional/ethics approval, informed consent, and an explicit
  emergency/medical disclaimer.
- Clinical validation across age, sex, clothing, skin tone, mobility aid, camera, and
  Bangladeshi population subgroups before making health claims.
