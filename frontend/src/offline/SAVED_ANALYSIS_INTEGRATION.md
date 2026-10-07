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

The production button calls `select(id)` without caller setup. Sprint 5 persists
native inference geometry and explicit operator recording-time direction/upright
assertions for new sessions; see `RECORDING_ANALYSIS_SETUP.md`. Camera-side selection,
phone-orientation instructions and preview layout points never supply those assertions.
Historical sessions retain their original missing setup. Supported components may run
independently, while absent/conflicting setup stays explicit. No fixture data enters production.

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

## Sprint 4 Task 7: local component review

The existing Node test runner now server-renders production `SavedAnalysisPanel.tsx`
through the installed React DOM and React Native Web packages, with TypeScript
transpilation in memory. No new dependency or app test route was added. A seeded,
server-rendered OfflineCapture History checks the real analysis action and its disabled
state. Synthetic setup/data remain confined to tests.

The review found expansion controls with text-only touch areas and indistinguishable
accessible names. They now have a minimum 48-point height and component-specific
show/hide labels. The close control also has an explicit minimum height. Status and
group titles have heading roles; expanded state remains exposed. History analysis
buttons identify their session to accessibility services. Scientific status retains
`NOT_EVALUATED` visibly, with a plain-language explanation and spoken label. Displayed
reason codes replace underscores with spaces; the underlying codes and analysis
contract are unchanged. Status/reasons remain textual, not color-only information.

The panel stays a vertical part of the existing ScrollView. Neither its text nor groups
have fixed heights, line caps or ellipsis. Collapsed groups retain their reasons; setup
and evidence limitations remain visible. Tests retain long IDs/reasons and rows from
bounded observation/candidate/interval fixtures, distinguish null from numerical zero, and exercise
partial, unavailable, read-failed and rejected-data output. No new numerical defaults,
geometry extraction or scientific inference were introduced.

Lifecycle tests render publications from the real binding with controlled native reads.
They check switching, same-ID reselection, close/reopen, background invalidation and
disposal. Source assertions check focus cleanup, AppState wiring, hiding a cleared
selection and generation-keyed groups. The coordinator remains the sole owner of
request-generation race protection; no lifecycle algorithm was changed.

### What these checks do not establish

Server rendering does not mount Expo Router or React Native, run layout, or execute
React effects. Expansion tests call the production event handler with a controlled
hook value, then render both branches; they do not test the mounted React scheduler.
The History test seeds local state and stubs native modules. A 320-point viewport
input is not evidence of correct small-screen wrapping. No screenshot, actual touch
hit test, accessibility-tree inspection or screen-reader session was performed.

Actual Android rendering, layout and accessibility have NOT yet been tested. Device
acceptance must check long unbroken IDs, largest font scaling, scrolling with expanded
results, TalkBack reading/focus order and expansion announcements, discoverability of
the panel above History after pressing a lower row, route blur/refocus, background and
foreground transitions, and unmount with pending reads. Native reads remain
noncancellable/non-atomic and ownership is not independently authenticated.

Local verification: 20 UI tests, 15 saved-analysis integration tests, 8 offline tests,
2 recording-state tests and 2 camera-framing tests (47/47 PASS; no failures or skips).
TypeScript and `git diff --check` passed, as did the whitespace check of the new
untracked test file. No analytical production module changed, so
engine suites are outside this task's rerun scope.

The next bounded step is a separately authorized APK/device acceptance build and the
checks above, using permitted existing data. Current saved metadata still cannot
support numerical results without an independently established setup policy. This
review does not authorize or claim scientific evaluation.
