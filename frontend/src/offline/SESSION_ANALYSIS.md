# Session analysis result wrapper

`analyzeSavedSession(request)` composes the existing knee, motion and interval exports.
Contract version: session-analysis-3. Pure TypeScript, no IO, native/UI/database changes
or external precomputed-result merging. Scientific status is always NOT_EVALUATED.

Sprint 5's structured persistence and geometry precedence are specified in
`ANALYSIS_METADATA.md`. New summary metadata can supply native inference geometry;
the saved-payload adapter is now `saved-payload-analysis-3`. Version-2 operator setup,
distinct direction/upright conflicts and source limitations are specified in
`RECORDING_ANALYSIS_SETUP.md`. Conflicts leave knee independent; persisted operator
direction is not relabeled to satisfy the frozen interval contract. The Sprint 4 sections
below describe the historical caller-only path, which remains supported for old
sessions. The saved adapter never parses diagnostic strings as geometry.

## Request and identity

Supply one saved Session, its ordered frames, processing status/reason, and explicit
context: sessionId, nullable participantId/attemptId, view, side, nullable direction,
upright assertion and detector-segments/unknown continuity choice. Session metadata is
validated by the existing parser. Context session/view/side must match it. Ownership
is supplied by the caller; timestamps never establish identity. The wrapper cannot
verify that a caller attached the correct raw frames to a Session without image evidence.

Processing failed requires a nonempty reason and returns failed with unavailable
components. Completed requires reason=null; it does not promise successful measurements.
Malformed request/session/context yields incompatible. Sparse frame arrays reject before
engine invocation. Dense structural/quality failures remain in each engine's own result.
The saved-session contract requires positive poseFrames, so a completed request with an
empty frame list is unavailable/no_observations, never fabricated successful measurements.
A valid flat-motion input, in contrast, can produce a successfully computed empty candidate
set with insufficient_evidence and a valid knee result.

Only fresh outputs from the imported versioned engines are combined. No caller-provided
component version, provenance or output is trusted or merged. Component algorithm and
configuration versions remain in their complete results; interval compatibility checks
reject unsupported motion versions/provenance. The current wrapper is paired with
projected-knee-1, ankle-motion-extrema-1 and candidate-motion-interval-1. Source extractor
version and model hash remain session provenance, not proof of source-image identity.

## Components and partial results

`components.knee`, `.motion`, `.intervals` each contain status, reasons and result.
Full component results preserve observations, masks, gaps, segments, exclusions, time
ranges, candidate support/confidence, algorithms and summaries where the engine supplies
them. A blocked component has result=null. Source unavailable output is otherwise retained,
including its reasons; numerical nulls are never replaced with zero.

Missing direction/upright assertions disable motion and dependent intervals, leaving
knee analysis intact. Missing knee geometry disables knee but does not disable motion.
Unknown continuity disables intervals despite detected candidates. Interval envelope
status is unavailable when no eligible interval exists; its full result preserves the
original per-polarity insufficient_evidence/unavailable distinction. Overall status is
available only when all components are available, unavailable when all are unavailable,
and partial otherwise. Global incompatible/processing-failed statuses are separate.

The wrapper verifies detector segment membership, candidate observation links, valid
signal observations and consecutive observation indices/times within the configured gap.
It copies actual detector gaps and segment indices. Missing requested continuity produces
unknown continuity. This is internal consistency of a freshly computed result, not proof
that every physical cycle was observed. Detailed detector exclusions remain in motion.result.

The detector provides no persistent candidate IDs. `candidate-N` labels are explicitly
analysis-local indices into motion.result.candidates, usable only within this result and
not stable across changed frames or algorithms. No persistent identity is invented.
Ownership fields are copied unchanged. Existing Session IDs may contain characters the
interval engine disallows: only intervals become unavailable with
interval_session_id_incompatible; IDs are never silently renamed to make them pass.

## Provenance and scientific boundary

Requested-time origin remains requested-100ms-nearest-decoded-frame. Actual PTS, exact
images and frame hashes are absent from these inputs, explicitly not available/established.
The model hash identifies model metadata, not video or image evidence. No source-image
correspondence, authenticity or acquisition equivalence is inferred. Projected knee values
are not validated anatomical 3D angles; extrema are not contacts; intervals are not step
or stride times. Physical-cycle completeness remains unknown.

## Verification and next task

From frontend:

```text
node --experimental-strip-types --test tests/session-analysis.test.mjs tests/session-analysis-saved.test.mjs
npm run typecheck
```

Synthetic composition checks a straight-knee observation of 0 degrees and 24 candidate
extrema over 100 requested samples, yielding 11 maximum intervals of 800 ms. Mean checks
allow 1e-12 ms floating arithmetic error; no underlying engine mathematics is changed.
Tests cover independent failures, unknown continuity, ownership/view/direction, exclusions,
empty sets, processing failure, versions, determinism and scientific boundaries.

Task 2 independently enumerates maxima at 400+800k and minima at 800+800k, k=0..11,
with 200 ms support on both sides in the 0..9900 ms fixture. Eleven consecutive maximum
pairs each differ by 800 ms. At sample 2 the hip, knee and ankle are vertically collinear
with the knee between the other points, hence projected flexion is 180-180=0 degrees.
The saved-session suite adds 24 tests to the 16 wrapper tests. It checks JSON round trips,
explicit failure reasons, exact candidate timestamps and interval endpoints, incompatible
IDs, absent metadata, preserved quality gaps, provenance and repeat execution.

## Saved-session compatibility audit (Sprint 4 Task 2)

Read-only sources: `contract.ts`, `OfflineCapture.tsx`, and
`frontend/modules/gaitsense-pose/android/src/main/java/expo/modules/gaitsensepose/GaitSensePoseModule.kt`
(repository-relative native path). No native persistence or loading code was changed.

| Information | Persisted/loaded representation | Analysis boundary |
| --- | --- | --- |
| Session ownership | Native UUID session ID; JSON summary returned by listSessions | TypeScript parser accepts any nonempty string; see ID decision below |
| Summary | id, createdAt, durationMs, sampledFrames, poseFrames, usableFrameRatio, landmarkCount, view, rawVideoRetained, modelSha256, extractorVersion, timestampMethod, consentVersion | Successful summary has positive poseFrames; provenance is metadata, not image proof |
| Frames | readFrames(sessionId), ordered timestampMs and 33 indexed x/y/z/visibility/presence landmarks | Returned frame objects have no sessionId; caller must bind the read to its selected session |
| Clock | Requested 100 ms sampling instants, timestampMethod=requested-100ms-nearest-decoded-frame | Native OPTION_CLOSEST retrieval supplies no actual decoded-frame PTS |
| Geometry | diagnostics string: encoded dimensions, rotation, last decoded dimensions and processing/quality counters | Not structured per-frame geometry; knee uses known-version decoded dimensions and native resize, assumes dimensions constant, never rotates them again using encoded rotation |
| Missing observations | Aggregate counts/diagnostics; missing poses/decodes are omitted from stored frames | Timestamp gaps and count differences remain visible; individual missing-frame causes cannot be reconstructed reliably |
| Processing outcome | Only successful processing writes the summary/frames transaction; API/UI communicates failure | No persisted failed-attempt ledger or processing status; wrapper processing envelope is caller-supplied |
| Direction/upright/segments | No stored travel direction, upright assertion or motion segment IDs | Require explicit setup; segments are freshly detector-derived and checked, or unknown |
| Research ownership/evidence | No participant/attempt identity, actual PTS, image hashes or retained source images | Keep ownership nullable and evidence unavailable; timestamps never identify images |

Ordinary native processing deletes the temporary source before the successful database
transaction, with cleanup also in finally. This audit does not alter deletion. Previously
deleted source images/videos cannot be recovered from stored landmarks or diagnostics.
History currently parses listSessions summaries and parseFrames(readFrames(selectedId));
it does not invoke this wrapper. An empty read is structurally accepted by parseFrames,
including for an absent/deleted session, but cannot satisfy the positive stored pose count.
It must not become a successful zero-observation recording. A valid flat signal with no
detected extrema is different from a read/processing failure or missing observations.

## Session ID decision: deliberately unresolved for arbitrary IDs

Root cause: parseSession accepts unrestricted nonempty strings, whereas interval ownership
requires `[A-Za-z0-9][A-Za-z0-9_.:-]{0,127}`. Actual native UUIDs fit this rule. The wrapper
retains original IDs and blocks only intervals for incompatible IDs; it does not combine
sessions, alter ownership semantics or silently replace IDs. Spaces, Unicode and overlong
IDs are regression-tested. No existing native UUID compatibility defect was found.

Possible future policies, requiring an explicit engineering decision:

- Continue fail-closed for arbitrary imported IDs (current behavior).
- Define a versioned, domain-separated cryptographic digest mapping, preserving the exact
  original ID beside it. Specify string encoding, namespace/collision handling and a
  compatible synchronous or asynchronous hashing API before changing ownership semantics.
- Define an explicit per-analysis registry with retained original-to-local mapping and
  scope identity. Local counters alone are not safe identifiers across separate results.

Sanitizing/truncating strings or assigning a shared constant would collide. Unbounded
strings cannot be reversibly encoded into the interval contract's bounded identifier.
No mapping convention was selected in this task; only this portion remains pending.

## Smallest next adapter task

Build a pure TypeScript saved-payload adapter with synthetic tests, without IO, UI or schema
changes. Accept a selected Session and a success/failure frame-read envelope explicitly
bound by the caller to that session ID; verify the binding and pose count and reject stale,
malformed or failed reads. Require direction/upright setup explicitly (or preserve component
unavailability), retain nullable research ownership, and choose checked detector segments
or unknown continuity without defaults that invent evidence. Distinguish load failure from
processing failure and successful zero-candidate computation. No same-shaped frame payload
can authenticate its ownership; the adapter can check caller binding only. Keep the current
ID restriction until an explicit mapping policy is selected. The entire Sprint 4 batch
remains local pending its separately authorized checkpoint.

## Saved-payload adapter (Sprint 4 Task 3)

`analyzeSavedPayload` in `saved-payload-analysis.ts` is the pure, bounded entry point
for native saved JSON. `SavedPayloadRequest` describes the caller envelope; runtime
input is unknown and validated. It accepts a selected session ID, a `sessionRead`
and `framesRead`, each carrying that ID and either `{status: 'loaded', payload}`
or `{status: 'failed', reason}`. The session payload is one selected summary from
listSessions, serialized as JSON, not the entire summary list. The frames payload
is the unmodified string returned by readFrames(selectedSessionId).

The future loader must capture the ID at read dispatch, bind both read envelopes
to it, and discard stale completions when selection changes. Matching IDs verify
caller binding only: native frame objects carry no ownership identity, so replacing
a payload with another same-shaped recording cannot be detected or authenticated.
No loader or UI connection is implemented in this task.

Validation rejects malformed JSON/envelopes, identity mismatches, missing/extra
loaded observations relative to poseFrames, invalid native sample counts, noninteger,
negative or out-of-duration timestamps, duplicates and decreasing timestamps, and
malformed 33-index landmark arrays. All coordinate/quality fields must be finite
numbers; visibility and presence must be in [0,1]. JSON texts are limited to 16,384
session and 2,097,152 frame UTF-16 code units, with at most 160 frames. These are
adapter resource bounds, not storage schema changes. Validation stops at the first
failure. No sorting, resampling, interpolation or count repair occurs.

Read failures return `load-failed`, their reason/detail and `analysis: null`;
invalid payloads return `incompatible` and `analysis: null`. They never become
processing-failed records or successful empty recordings. Successful validated
reads invoke the existing wrapper with processing completed, consistent with native
persistence of successful extractions only. `sampledFrames - poseFrames` remains
an extraction omission count, separate from an incomplete load. No individual
omission cause is reconstructed. Low but valid confidence and out-of-frame
coordinates pass through to component quality masks, null values, gaps and exclusions.

Optional `setup` supplies analysis metadata, separately from storage:

- `geometry`: positive integer inferenceWidth/inferenceHeight, with
  source=`caller-asserted-inference-dimensions` and
  assumption=`constant-inference-dimensions-within-session`. These must describe the
  actual inference coordinate system across this recording, established independently
  of diagnostic text. This is a caller assertion, not verified image correspondence.
- `direction`: +1 increasing image x or -1 decreasing image x; absent/null blocks motion.
- `upright`: only explicit true confirms the required orientation; absent/false blocks motion.
- `participantId` / `attemptId`: explicitly supplied IDs or null; omitted stays null.
- `continuity`: explicit detector-segments requests freshly checked detector continuity;
  omitted/unknown leaves dependent intervals unavailable. It never proves physical-cycle completeness.

The knee engine and wrapper now accept an optional explicit geometry argument.
The adapter ALWAYS passes an explicit value or null, disabling diagnostic fallback.
Missing/invalid geometry leaves knee unavailable with missing_geometry while supported
motion/intervals remain usable. Legacy direct callers that omit the new argument
retain their existing behavior and regression tests; the adapter never invokes that
legacy geometry path. The numerical formula and existing algorithm/configuration
versions are unchanged; the additive geometry result is discriminated by source.

The full wrapper result is retained under `analysis`, including provenance, component
statuses, versions, masks, exclusions and null measurements. The adapter adds its own
version, count audit, caller-binding limitation and setup provenance. Missing assertions
never become scientific evidence. Actual decoded PTS and exact-image identity remain
unavailable. Arbitrary incompatible IDs are preserved and block only intervals, with
no mapping policy introduced. Scientific status remains NOT_EVALUATED; motion extrema
are candidates and intervals are not validated step/stride times.

Recommended next task: implement a small saved-session loading coordinator with a mocked
native API and stale-selection/race tests. It should create these bound envelopes and
carry explicit setup, before any UI integration. Existing historical sessions without
independently established inference geometry/direction/upright remain limited; diagnostics
cannot repair these missing facts. No native/schema/APK/ADB/database work is needed for
that coordinator.

Task 3 verification (local synthetic data only): 56 adapter tests plus the existing
40 session-wrapper tests passed within a 242/242 focused analytical regression run;
0 failures, skips or cancellations. TypeScript (`npm run typecheck`) passed.
The focused command, from frontend, was:

```text
node --experimental-strip-types --test tests/saved-payload-analysis.test.mjs tests/session-analysis.test.mjs tests/session-analysis-saved.test.mjs tests/knee-flexion.test.mjs tests/knee-comparison.test.mjs tests/motion-candidates.test.mjs tests/motion-intervals.test.mjs tests/motion-interval-integration.test.mjs tests/motion-integration.test.mjs
npm run typecheck
```

Node emitted the existing MODULE_TYPELESS_PACKAGE_JSON warning; no package/module
configuration was changed. No commit or push was performed.

### Fresh verification after interrupted-task recovery

The recovered implementation required no source corrections. Fresh per-file runs
using `node --experimental-strip-types --test --test-reporter=tap tests/<name>.test.mjs`
passed on the final source:

| Test file | Passed |
| --- | ---: |
| saved-payload-analysis.test.mjs | 56 |
| session-analysis.test.mjs | 16 |
| session-analysis-saved.test.mjs | 24 |
| knee-flexion.test.mjs | 16 |
| knee-comparison.test.mjs | 18 |
| motion-candidates.test.mjs | 37 |
| motion-integration.test.mjs | 29 |
| motion-intervals.test.mjs | 29 |
| motion-interval-integration.test.mjs | 17 |
| motion-interval-sensitivity.test.mjs | 16 |
| motion-matching.test.mjs | 42 |
| motion-cohort.test.mjs | 32 |
| Total | 332 |

All runs exited 0, with no failures, skips, cancellations or todos.
`npm run typecheck` passed. `git diff --check` found no whitespace errors.
HEAD remained fe650bc8fbca9d618c1434c1a6735ec4f4c05d6f. Unrelated local work was
preserved; nothing was staged, committed or pushed.
