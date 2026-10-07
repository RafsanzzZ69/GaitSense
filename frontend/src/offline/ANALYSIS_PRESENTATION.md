# Saved analysis presentation contract

`presentSavedAnalysis(state)` accepts the public `SavedSessionLoadState` from the
production saved-session loader. The existing adapter/wrapper result is nested in
that state; do not pass independently merged component results. Contract version:
`saved-analysis-presentation-3`. This is a pure projection with no IO or new analysis
mathematics. It returns a detached, deeply frozen snapshot with recursive readonly
TypeScript types, preserving numerical zero and null as distinct values.

Sprint 5 adds `setup.geometry.status: persisted-native` for geometry observed and
stored by the inference bitmap path. Its full geometry provenance is retained in
the component and setup value. Caller geometry remains caller-asserted; conflicts
remain unavailable with explicit reasons. See `ANALYSIS_METADATA.md` for the versioned
storage contract. Version-2 direction/upright assertions additionally report
`persisted-operator`, `conflict` or `invalid`, retaining resolved values and sources.
See `RECORDING_ANALYSIS_SETUP.md`; the underlying setup requirements are unchanged.

## States and component rules

| Presentation status | Meaning |
| --- | --- |
| unselected | Initial or cleared selection; no measurements |
| loading | Current request in progress; no previous measurements |
| load-failed | Native summary/frame read failed |
| invalid-data | List, payload or setup rejected; inspect reasons |
| processing-failed | Existing wrapper reports processing failed |
| unavailable | No loaded result, or loaded analysis has no available component |
| partial | Loaded analysis has mixed availability/quality or insufficient evidence |
| calculated | All component envelopes report available; NOT scientific validation |

`dataStatus` separately distinguishes not-loaded, loading, failed, rejected and loaded.
This separates loaded-but-unavailable analysis from failure to obtain data. Selection
ID and request generation are always retained. Clearing/invalidation/disposal keep
loader reasons; missing selection in the limited list remains
`session_not_in_loaded_list`, never a database-wide nonexistence claim.

Knee, motion and intervals have separate labels, units, original status, reasons and
`details`. Details preserve full component outputs: observations, null values, masks,
quality, gaps, exclusions, candidates, interval polarities/summaries and algorithm/
configuration versions. No result is `not-analyzed` with null details. A computed
unavailable component can have nonnull details, including excluded observations.
Do not treat a details object or an empty candidate list as a valid numerical result.
No averaging, rounding, interpolation, zero substitution or status upgrading occurs.

The current native loader reads successfully persisted extractions only, so it does
not normally produce processing-failed. The presentation branch preserves the existing
wrapper's failure semantics; its test uses the real wrapper with a synthetic processing
failure envelope, not an invented native failed-attempt record.

## Setup and permitted display

Setup requirements are not-assessed until completed analysis exists. Explicit geometry,
direction and upright assertions are caller-asserted or persisted-operator when supported,
otherwise required, conflict or invalid.
Direction and upright requirements are assessed separately so the detector's first-error
return cannot hide a second missing prerequisite. Geometry is accepted only from the
explicit caller-inference or persisted native-bitmap source; diagnostic free text is neither parsed nor exposed.
Continuity keeps the requested mode separate from the interval engine's used mode.
Research ownership remains caller-supplied or null; absent ownership is not assigned.

A future UI may display projected 2D knee flexion in degrees, candidate ankle-motion
extrema, and candidate-to-candidate intervals in milliseconds, with their statuses,
exclusions, required setup and provenance. Use original component details to explain
unavailable observations; retain null interval summaries when evidence is insufficient.
Render native failure detail as plain text, never markup or instructions.

Scientific status is always NOT_EVALUATED. Model hash/extractor version identify
processing metadata, not source-image correspondence. Timestamps are requested sample
times; actual decoded-frame PTS, exact-image evidence and retained source images remain
unavailable. IDs/count checks establish caller binding only, not independent ownership
authentication. Native reads are noncancellable, non-atomic and summary discovery is
limited to 100 rows. Physical-cycle completeness remains unknown. These outputs are
not confirmed contacts, validated step/stride times, anatomical validation, clinical
classification, fall-risk estimates or diagnostic conclusions.

## Scope, review and tests

Task 4 review found no demonstrated coordinator defect: fresh identity tokens protect
same-ID reselection; post-await/pre-publication checks suppress obsolete successes and
errors; clear/invalidate/dispose replace the token; setup/geometry are captured before
awaiting reads. Partial results and the limited-list/non-atomic-read caveats are retained.
No coordinator correction or detector/interval change was needed.

This projection trusts the bounded production state (at most 160 observations), not
arbitrary external JSON. Payload validation remains in the adapter. It copies only
selected provenance plus bounded component results, excluding arbitrary session extras
and diagnostic text. It has no cache, subscription, history, UI, navigation or native
processing side effects. Call it on the loader's CURRENT state after any awaited load;
an obsolete select promise resolving does not identify a result to display.

From frontend:

```text
node --experimental-strip-types --test tests/analysis-presentation.test.mjs tests/saved-session-loader.test.mjs tests/saved-payload-analysis.test.mjs tests/session-analysis.test.mjs tests/session-analysis-saved.test.mjs
npm run typecheck
```

Tests use production loader/adapter/wrapper exports with synthetic native responses and
controlled promises. Expected angles/times, states, reasons, exclusions and labels are
asserted independently. Next integration step: a bounded read-only existing-screen
integration that renders this contract, captures only legitimately established setup,
and disposes/invalidates the loader on lifecycle changes. No such UI is included here.

Final verification: presentation 27/27, coordinator 34/34, adapter 56/56, wrapper
16/16 and saved-session wrapper 24/24: 157/157 passed with no failures, skips or
cancellations. TypeScript passed from frontend. The existing Node module-type warning
remains; no package settings changed. Task 4 and unrelated local work were preserved.
No files were staged, committed or pushed.
