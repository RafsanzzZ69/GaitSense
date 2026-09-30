# Controlled saved-analysis integration (Sprint 4 Task 6)

## Actual application entry point

Android history and report routes redirect to `/offline`. That route exports
`OfflineCapture`, which contains the actual SQLite-backed History and saved landmark
inspection. The separate generic History/report mock screens are not Android results
screens. No route or navigation definitions were changed.

Each local History row now has `View saved analysis`, alongside existing inspection
and deletion actions. It passes that row's ID to a focus-scoped read-only binding,
which calls the existing coordinator with injected `Pose.listSessions` and
`Pose.readFrames`. Results appear in a separate, explicitly session-labelled panel
above History. `Close saved analysis` clears only the analysis selection.

The screen does not have legitimate analysis setup. Camera-side selection, the
instruction to hold upright, requested 720p capture and preview layout points do not
establish persisted inference geometry, travel direction or upright confirmation.
Therefore the production button calls `select(id)` without setup. Typical current
saved sessions load but remain analytically unavailable, with explicit prerequisites.
The integration supports future explicitly established setup through the binding;
only synthetic tests supply it today. No fixture data enters production.

## Lifecycle and display

`createSavedAnalysisBinding` bridges the real loader/presenter to the screen's state
setter. It emits loading immediately and emits only the loader's current state after
completion; reference comparison suppresses redundant notifications. There is no new
request-generation algorithm. All session-switch/same-ID race handling remains in
the coordinator. Setup is snapshotted there before IO.

Expo Router focus cleanup disposes the binding on route blur/unmount. Returning to
focus creates a fresh binding and clears displayed analysis. App backgrounding calls
leave/invalidate. Disposal prevents pending completions from invoking the screen state
setter, including rejected native reads. Existing confirmed delete actions clear the
analysis first so pending reads cannot republish a deleted selection; no new storage
mutation is introduced. Analysis callbacks never write History state or invoke delete,
processing, camera or backend APIs.

`SavedAnalysisPanel` consumes the tested `savedAnalysisPanel` text projection. It shows
separate loading, native failure, rejected-data, unavailable, partial and calculated
labels; selected ID; scientific status; component reasons; setup requirements; and
requested-clock/evidence limitations. Observation/exclusion rows can be expanded per
component. Null is rendered as `Unavailable`; legitimate numerical zero stays zero.
Candidate timestamps and intervals remain requested-clock computations, not validated
contacts or step/stride measurements. Unknown PTS, image correspondence and ownership
authentication remain explicit. Scientific status is NOT_EVALUATED.

Native reads remain noncancellable and non-atomic; listSessions returns only the latest
100 summaries. The analysis binding does not replace the existing standalone landmark
inspection read path. That legacy inspection has its own state and is not analysis
input; the new panel always labels its selected session independently.

## Verification scope

Node tests execute the actual binding, coordinator, adapter, presenter and panel text
formatter with controlled native-read mocks; source wiring assertions check the real
Android route, focus cleanup and React Native panel usage. TypeScript checks the TSX.
This does not claim a mounted React Native/device or visual layout test. No APK build,
ADB session, participant recording, private video or MongoDB connection was used.
Actual device rendering, layout and accessibility have NOT yet been tested.

Final focused results:

| Suite | Pass |
| --- | ---: |
| saved-analysis-integration | 15 |
| analysis-presentation | 27 |
| saved-session-loader | 34 |
| saved-payload-analysis | 56 |
| session-analysis | 16 |
| session-analysis-saved | 24 |
| offline | 8 |
| recording-state | 2 |
| camera-framing | 2 |
| Total | 184 |

No failures, skips or cancellations. `npm run typecheck` passed from frontend.
`git diff --check` passed. Existing Node module-type/experimental warnings remain.
No analysis algorithm, native processing, schema, navigation or research protocol changed.

Next bounded task: review the read-only panel's layout, accessibility and focus/background
behavior in a permitted UI test environment. Establish a separately reviewed, evidence-based
setup acquisition policy before enabling numerical outputs for real saved sessions; do
not fill the current metadata gaps with defaults.
