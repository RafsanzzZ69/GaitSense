# Collection design

The schema is organized around one immutable walking event. A `walk_sessions`
document owns the processing lifecycle; derived records point back to that session.
MongoDB does not enforce foreign keys, so the API/service layer must verify ownership
on writes and perform coordinated cleanup.

```text
users 1---1 participant_profiles
  | 1---* consents
  | 1---* walk_sessions
             | 1---* media_assets
             | 1---* pose_chunks
             | 1---* processing_jobs
             | 1---* gait_features
             | 1---* assessments ---* model_versions
                              | 1---* assessment_recommendations
                              |             *---1 recommendation_catalog
                              | 1---* progress_snapshots (as current/baseline)
  | 1---* refresh_tokens
  | 1---* audit_events
```

## Collections

| Collection | Purpose | Retention / ownership rule |
|---|---|---|
| `users` | Authentication identity and account state | Soft-delete first; purge by policy |
| `participant_profiles` | Minimal demographic and health context | One per user; sensitive |
| `consents` | Versioned legal and research consent evidence | Never overwrite historical versions |
| `walk_sessions` | Capture metadata, quality result, pipeline status | Main aggregate root |
| `media_assets` | Object-storage pointers, hashes, encryption and expiry | Video bytes do not belong in MongoDB |
| `pose_chunks` | Pose frames in bounded chunks (maximum 120 frames) | Delete or de-identify with session policy |
| `gait_features` | Versioned computed feature vector | Unique per session/extractor version |
| `model_versions` | Reproducible ML artifact metadata | Never mutate a released version |
| `assessments` | Scores, categories, flags, model references | Screening result; not a diagnosis |
| `recommendation_catalog` | Clinically reviewed recommendation templates | Version and deactivate; do not hard-delete |
| `assessment_recommendations` | Historical recommendation snapshot and user status | Snapshot prevents catalog edits changing old reports |
| `processing_jobs` | Retryable pipeline work queue | Archive/expire completed jobs later |
| `refresh_tokens` | Hashed login refresh tokens | TTL deletes expired tokens |
| `progress_snapshots` | Cached comparison against a prior assessment | Recomputable derived data |
| `audit_events` | Security and sensitive-data access trail | Optional `expiresAt` drives TTL policy |
| `schema_migrations` | Applied database schema versions | Operational metadata |
| `auth_sessions` | Revocable login sessions shared by access/refresh tokens | TTL after session expiry |
| `consent_documents` | Versioned text presented before acceptance | Immutable document version |
| `capture_protocols` | Recording instructions and comparison protocol | Versioned configuration |
| `rate_limits` | Hashed time-bucket counters for API throttling | Short TTL |

## Why pose data is chunked

A 10–15 second recording can contain hundreds of frames, each with 33 landmarks.
Keeping all frames inside `walk_sessions` would make routine session reads expensive
and risks approaching MongoDB's BSON document limit as the pipeline grows. Chunks are
bounded to 120 frames, have a unique `(sessionId, runId, chunkIndex)` key, and can be streamed
in order.

## Source of truth versus derived data

- Source records: users, profiles, consent, session capture metadata, media metadata.
- Versioned derivations: pose chunks, gait features, assessments.
- Recomputable caches: progress snapshots.
- Catalog/configuration: model versions and recommendations.

Every derived document stores its algorithm or schema version. This is essential for
medical validation because two reports can only be compared meaningfully when their
feature extraction and model lineage are known.

## Application invariants

MongoDB validators enforce shape and ranges, while the application must enforce:

1. Every referenced document exists and belongs to the same `userId`.
2. A session only advances through valid status transitions.
3. A completed assessment refers to immutable feature/model versions.
4. Only approved models can be activated in production.
5. No unvalidated clinical model or health score is served by the current backend.

## Version 2 publication and measurement rules

Draft sessions require only angle/device, not fabricated capture duration/FPS. The API
decodes capture metadata from the actual video. One video belongs to one session;
recording a replacement creates a new session. `(userId, idempotencyKey)` prevents
duplicate creates, and `(sessionId, pipelineVersion)` identifies a pipeline job.

Processing attempts receive a fresh `runId`. A completed session's `assessmentId` is
the publication pointer; abandoned attempts must not appear in history. Features store
`definitions` (including units), `unavailable` reasons, quality and pipeline version.
An empty or partial metrics object is valid; unknown is not zero. Measurement reports
may have no clinical model references, score, dimensions or classifications.

The recommendation catalog and three development model records are placeholders, not
evidence of clinical review or trained models. The API does not prescribe these exercises.
Existing legacy score-bearing documents remain structurally compatible; they are not
automatically promoted to current published reports.
