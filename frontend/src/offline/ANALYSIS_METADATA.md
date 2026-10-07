# Structured saved analysis metadata — Sprint 5 Task 1

Sprint 5 Task 4 adds `saved-analysis-metadata-2` through explicit recording setup.
See `RECORDING_ANALYSIS_SETUP.md` for its assertion and conflict contract. Geometry
and version-1 semantics below remain unchanged; setup-aware new recordings use v2,
while legacy processing calls still emit v1. Historical records are never upgraded.

Contract: `saved-analysis-metadata-1`, stored as the optional `analysisMetadata`
property of session summary JSON. The independent expected JSON is in
`tests/fixtures/analysis-metadata-v1.json`; native JVM tests compare the actual
serializer with it, and frontend tests read it through SQLite and the adapter.

## Storage and backward compatibility

`PoseStore` remains SQLiteOpenHelper version 1. Its existing `sessions.summary`
TEXT column stores the entire JSON summary in the same transaction as frame rows.
`listSessions()` returns that JSON unchanged, still limited to the latest 100.
No SQL columns, migration, historical row rewrite, delete behavior or native bridge
method signature changed. Session's optional metadata is typed as `unknown` at the
JSON boundary: History parsing remains compatible even when analysis cannot recognize
it. Exported structured types and the separate metadata reader live in
`analysis-metadata.ts`.

Only newly processed sessions receive metadata. Old sessions have no structured
geometry; the saved-payload adapter continues to require caller geometry for them.
Diagnostic strings, including encoded/decoded size and rotation, are never read by
this adapter to establish geometry. Legacy direct knee-engine callers that omit the
explicit argument retain their pre-existing API behavior; this is not the saved-payload
path, which always supplies either explicit evidence or an unavailable input.

## Exact version 1 fields

- `contractVersion`: `saved-analysis-metadata-1`.
- `geometry.status`: `available` or `unavailable`.
- Available geometry: `inferenceWidth`, `inferenceHeight`,
  `source: native-inference-bitmap`, `constantDimensions: true`,
  `observedInferenceCalls`, `scope: all-inference-calls`, and `transform` below.
- Unavailable geometry: `constantDimensions: false`, `observedInferenceCalls`,
  and `reason: no-inference-calls` or `varying-inference-dimensions`.
  No single inference width/height is offered for a varying session.
- `direction` and `upright`: each is exactly
  `{status: "unassessed", value: null, source: null}`.

The assertion slots distinguish availability, value and source for future explicit
inputs. Version 1 deliberately accepts only unassessed persisted assertions. A future
assessed contract must define legitimate acquisition and provenance before accepting
direction `1/-1` or an upright boolean; this task establishes neither an operator
identity nor a new approved assertion source. Existing explicit caller setup continues
to work, but no such setup is supplied by the current production History action.

`transform` records the existing application operations:

```json
{
  "resize": "fit-longest-edge-768-no-upscale",
  "pixelFormat": "ARGB_8888",
  "applicationRotationDegrees": 0,
  "applicationMirror": false,
  "decoderOrientation": "platform-output-not-upright-assertion"
}
```

The observed dimensions come from `bitmap.width/height` immediately before every
`detectForVideo()` invocation. This is the actual bitmap used to construct MPImage,
after optional resizing and ARGB conversion, not encoded-video dimensions. The app
does not additionally rotate or mirror it. Decoder output orientation remains platform
behavior; neither this label nor encoded rotation proves upright orientation.

Constancy is checked across ALL inference calls, including calls producing no saved
pose. Null decoded frames cause no inference and do not establish image dimensions.
A single observed call establishes consistency only over that one observed call;
successful session count/quality requirements still apply unchanged. Any dimension
change permanently marks the session geometry unavailable, even if dimensions later
return to the first size. This does not reject an otherwise saveable session.

Native/TypeScript dimensions are positive integers at most 768, matching this version's
actual resize path. TypeScript also checks safe integers. Call counts are integers
0–160, and the adapter requires saved pose count <= inference calls <= sampled count.
No threshold, projection formula or scientific algorithm version changed.

## Approved precedence and failure rules

Valid persisted geometry is used when caller geometry is omitted or null. Matching
valid caller dimensions are accepted with native provenance retained. A conflict or
invalid supplied caller geometry makes knee analysis unavailable with
`geometry_conflict`, null measurements and reasons on each affected observation.
Neither value is silently preferred. Supported motion/interval components remain
independent.

Malformed metadata produces `invalid_analysis_metadata`; unknown versions produce
`unsupported_analysis_metadata_version`. Both disable knee only, including when
caller geometry is supplied. Explicitly varying native dimensions cannot be overridden
by a caller constancy assertion. History remains readable. These are component evidence
failures rather than native-read failures, and do not trigger any storage repair.

The wrapper, adapter and presentation contracts are now respectively
`session-analysis-2`, `saved-payload-analysis-2` and `saved-analysis-presentation-2`.
Knee output retains native geometry evidence; the presenter exposes
`setup.geometry.status: persisted-native`, rather than mislabeling it caller-asserted.
All original component reasons, exclusions and null values remain present.

## Evidence and verification boundaries

Scientific status remains NOT_EVALUATED. Geometry is engineering provenance, not
anatomical validation. It does not establish actual decoded-frame PTS, exact images,
frame-ownership authentication, participant/attempt identity, direction, upright
orientation or physical continuity. Stored timestamps remain requested sample times.

JVM tests exercise the real native metadata collector/JSONObject serializer using a
test-only JSON implementation; they do not run a video decoder or MediaPipe. Node
SQLite tests use production schema SQL and summary/frame read shapes, not Android's
SQLite runtime. Source wiring checks tie collection to inference and summary saving.
No APK, ADB, phone, private video or research dataset is used during this task.

Final local regression results:

| Suite | Passed |
| --- | ---: |
| Structured metadata / SQLite roundtrip | 47 |
| Saved-payload adapter | 56 |
| Session wrapper | 16 |
| Saved-session wrapper | 24 |
| Knee flexion | 16 |
| Loading coordinator | 34 |
| Presentation | 27 |
| Saved-analysis integration | 15 |
| UI rendering | 21 |
| Offline | 8 |
| Camera framing | 2 |
| Frontend total | 266 |
| Native metadata JVM | 7 |
| Existing native diagnostics JVM | 4 |
| Combined total | 277 |

All passed with no failures/skips. TypeScript passed. Whitespace checks include the
new files. The initial JVM test used a JSON comparison method unavailable in the
Android compile API; it was replaced with a field-by-field comparison before the
successful run. Production native compilation passed without source corrections.

Next bounded task: after source review, separately authorize a device acceptance build
and one new engineering smoke-test recording. Confirm new metadata survives saving and
offline restart, projected knee output is present when quality permits, motion setup
remains missing, and historical sessions still load. This requires a physical phone;
it does not require a research dataset or establish scientific validity.
