# Saved-session loading coordinator

`createSavedSessionLoader(reads)` in `saved-session-loader.ts` accepts the actual
bridge subset `Pick<OfflinePoseNative, 'listSessions' | 'readFrames'>`. Its bridge
import is type-only; tests and other TypeScript callers do not load Expo or Android.
There are no timers, automatic retries, workers, caches, storage writes or UI changes.

## Native contract and binding

The native list operation returns JSON text containing at most 100 summaries, ordered
by creation time. There is no single-session summary endpoint. The coordinator checks
the list envelope and selects exactly one row with the requested ID. Zero matches
means `session_not_in_loaded_list`, not proof that the session was deleted (it might
be outside the native list limit). Duplicate matches fail with
`ambiguous_session_summary`. List JSON is bounded to 100 rows and 1,638,502 UTF-16
code units before parsing. Detailed selected-summary validation stays in the adapter.

After resolving metadata, it calls `readFrames(selectedSessionId)`, which returns
JSON text ordered by timestamp. Both native operations can reject; the coordinator
also handles synchronous throws from injected reads. Summary/frame failures become
adapter failed-read envelopes, preserving load-failed status and error detail.
Malformed list envelopes fail at the coordinator; malformed selected summaries,
frames and count discrepancies remain adapter decisions. Declared poseFrames must
match loaded frame count; sampledFrames may exceed poseFrames due to extraction
omissions. A returned empty array is not a successful zero-observation session.

Native frame records lack session IDs. The coordinator binds responses to the ID
captured at dispatch; this is NOT authentication of their contents. The two native
reads are not one transactional snapshot. Deletion between reads can produce a count
mismatch; same-shaped content substitution cannot be detected. Requested sample times
remain requested times, never actual decoded PTS. No exact-image evidence is created.

## Lifecycle and state

- `getState()` exposes the current state. Treat the returned state/result as read-only.
- `select(id, setup?)` synchronously replaces prior state with loading, then resolves
  `Promise<void>` after its read sequence settles. Read current state after awaiting;
  completion of a superseded request does not publish its old result.
- `clear()` removes selection/result and publishes unavailable/no_selection.
- `invalidate()` removes selection/result and publishes unavailable/invalidated;
  a subsequent selection is permitted.
- `dispose()` permanently invalidates pending work and publishes unavailable/disposed.
  Repeated disposal and later select/clear/invalidate calls do nothing.

Each state has status, selectedSessionId, generation, reasons and nullable result.
Initial state is unavailable/no_selection. Loading has no old result. Ready means
an adapter result with supported analysis, including partial or insufficient-evidence
component outcomes; it is not a scientific-validity claim. Unavailable can represent
no selection, missing summary, invalidation/disposal, or a completed adapter result
with no available analysis. Failed represents read failure, malformed payload or
incompatible input. Preserve `result` when present to inspect component reasons,
exclusions and provenance; top-level reasons need not repeat component reasons.

Every selection creates a fresh identity token and increments a diagnostic generation,
including same-ID reselection. Clear/invalidate/dispose also replace the token.
Checks after the summary await and before analysis/publication suppress obsolete work.
The unique token controls validity, not the session ID or numerical generation.
Obsolete summary completions do not dispatch frame reads. Already-dispatched native
reads cannot be cancelled; their completions/rejections are consumed and ignored.
There is no timeout: a pending native read remains loading until it settles or the
caller clears, invalidates, disposes or selects again. No queue of historical results
is retained by the coordinator.

## Explicit setup and science boundary

The caller supplies `SavedAnalysisSetup`. The coordinator snapshots the setup and its
nested geometry before awaiting IO and forwards it to the existing adapter unchanged.
It does not reconstruct geometry from diagnostics, infer direction from camera side,
confirm upright orientation, assign research ownership, or invent continuity.
Missing geometry disables knee while supported motion/interval analysis stays available.
Missing setup retains unavailable analysis and null ownership. Detector exclusions,
quality masks and requested-clock provenance are preserved in the complete adapter
result. Scientific status remains NOT_EVALUATED.

## Synthetic verification

The controlled-read tests assert current published state and session identity, including
A-to-B transitions, reverse completions, same-ID reselection, rapid A/B/C selection,
obsolete rejection, clear/invalidate/dispose during both read phases, setup snapshots,
load failures, malformed payloads/counts, partial availability and evidence limitations.

From frontend:

```text
node --experimental-strip-types --test tests/saved-session-loader.test.mjs tests/saved-payload-analysis.test.mjs tests/session-analysis.test.mjs tests/session-analysis-saved.test.mjs
npm run typecheck
```

No component mathematics or production native/UI modules were changed. Next bounded
task: review a read-only saved-session analysis presentation contract (loading/failure,
partial component results and explicit setup requirements), with synthetic presenter
tests, before connecting it to the existing Android screen. Sessions without legitimately
established setup must retain the current unavailable components.

Final local verification: coordinator 34/34, saved-payload adapter 56/56, session
wrapper 16/16, saved-session wrapper 24/24: total 130/130, no failures, skips or
cancellations. TypeScript passed. The coordinator also catches selected-summary
serialization failure (for example, excessive nesting), publishing
failed/invalid_session_summary instead of leaving loading pending. Node emitted
its existing MODULE_TYPELESS_PACKAGE_JSON warning. No component suites were rerun
because no existing production component changed. Nothing was staged, committed or pushed.
