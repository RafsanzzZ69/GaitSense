# Explicit recording analysis setup — Sprint 5 Task 4

## Meaning and acquisition

Direction +1 means increasing image x (image right); -1 means decreasing image x
(image left). It asserts one straight travel direction for this recording, with a
steady camera and no turns. Visible anatomical side is an independent selection.
Upright true asserts **upright image orientation** for this recording, not merely
an upright device. The operator checks the image; software does not establish these
properties from landmarks, decoder rotation, camera facing, side or diagnostics.
Unspecified setup remains allowed and limits analysis. These are operator assertions,
not authentication, anatomical validation or a verified correspondence to each image.

## Snapshot and reset

`createRecordingSetupBinding` owns one immutable snapshot. `OfflineCapture` captures
side, direction and upright before the three-second countdown. The locked controls
and snapshot remain attached to that attempt through capture, preview and processing.
Native processing uses the captured side and JSON, never later UI values. Starting
another snapshot while one is active is rejected.

Direction/upright reset to unassessed after successful processing, successful discard,
cancelled countdown, failed capture, or failed processing followed by cleanup. Side
selection retains its existing behavior. If cleanup fails and a video remains, the
same original snapshot stays attached; a new attempt cannot begin until discard.
Unmount clears the binding; late capture completion discards its video. Background
interruption cancels existing capture/processing behavior. A preview retains its
own snapshot until discarded or processed. Camera-preview restart alone does not
change setup; recording cancellation and process restart never import prior assertions.

## Native bridge and persistence

New `processVideoWithSetup(uri, view, consent, setupJson)` passes a bounded JSON input:

```json
{"contractVersion":"recording-analysis-setup-1","direction":1,"upright":true}
```

Direction is exactly 1, -1 or null. Upright is exactly true or null; unchecked means
unassessed, not an assessed false assertion. Native parsing rejects missing fields,
unknown input versions and malformed values before queuing processing. It copies
values into an immutable per-request object. Extra fields cannot supply geometry.
The old three-argument `processVideo` remains supported and emits version 1.

The existing inference collector writes `saved-analysis-metadata-2` for setup-aware
requests. Geometry is captured by the unchanged native bitmap path. Each assertion is:

```json
{"status":"asserted","value":1,"source":"operator-recording-setup"}
```

Upright uses value true. Unassessed fields in both versions use precisely
`{"status":"unassessed","value":null,"source":null}`. Version 1 continues to
reject assessed payloads. Version 2 accepts only the defined operator discriminator
and values. Metadata remains additive inside `sessions.summary`; no schema migration,
historical rewrite or deletion change occurs. Fixtures for both versions independently
describe the expected wire format and are checked by the native serializer and TS reader.

## Resolution and presentation

Absent/unassessed persisted assertions retain caller-only behavior. Assessed persisted
assertions supply missing setup; matching caller assertions retain operator provenance.
Caller direction null means absent. Caller upright false is an explicit disagreement
with persisted true. Disagreements create `direction_conflict` / `upright_conflict`,
null motion component output, and dependent `motion_setup_unavailable` interval output.
They never disable otherwise supported native-geometry knee analysis. Neither source
silently overrides the other. Malformed version-2 metadata blocks motion with
`invalid_persisted_setup` even if caller setup exists; the existing metadata validator
also rejects its geometry. Version-1 malformed/unknown-version behavior is unchanged.

Presentation distinguishes `persisted-operator`, `caller-asserted`, `required`,
`conflict`, `invalid` and `not-assessed`, retaining source, resolved value and component
reasons. The panel explains the operator assertion and image direction. Geometry
retains `persisted-native`. Wrapper/adapter/presentation contracts are now version 3.
No detector thresholds, projection mathematics or interval mathematics changed.

## Remaining interval boundaries

Sprint 5 Task 6 explicitly extends `candidate-motion-interval-input-1` to accept
`operator-recording-setup` as well as `caller-asserted`, preserving the original source.
The previous `unsupported_direction_source` guard for operator setup is removed;
unknown sources still fail closed. Every other interval eligibility gate remains.
Motion may run
when setup and real landmark/signal requirements permit; it may still be unavailable,
partial or insufficient evidence. Sprint 5 Task 8's History binding requests freshly
checked detector segments; see `SAVED_CONTINUITY.md`. It supplies no participant/attempt
ownership. Requested sampling times remain requested times;
actual decoded-frame PTS and exact-image evidence remain unavailable.

Scientific status remains NOT_EVALUATED. No contact, step/stride, cadence, clinical
or diagnostic validity is established.

## Local verification limits and next step

JVM tests exercise production input parsing and metadata serialization. Node tests
exercise the production parser, adapter, loader, presenter and capture handlers with
controlled hooks/mocked native reads; React DOM/RN Web checks actual control markup.
These do not validate native UI layout, TalkBack, decoder orientation, real capture
or Android SQLite runtime. No APK, phone, ADB, video or dataset is used for this task.

Final focused checks: 334 frontend tests plus 17 native JVM tests, all passing with
zero failures/skips. TypeScript and native debug compilation passed. Frontend suites:
metadata 47, recording setup 37, saved adapter 56, session wrapper 16, saved-session
wrapper 24, motion candidates 37, motion integration 29, presentation 27, saved-analysis
integration 15, UI 22, offline 8 and knee 16. Native suites: setup 6, geometry metadata
7 and diagnostics 4. Whitespace checks include new files. Controlled-hook harness
failures during test development were corrected in the harness; final runs pass.

This cross-cutting native/UI contract change warrants an independent review and
selective checkpoint before a separately authorized release build. Then test explicit
setup on a phone with one new engineering smoke-test recording, including offline
reload, unassessed reset, historical History and setup-aware candidate motion. A
research dataset is not required. Interval continuity and timestamp evidence remain limited.
