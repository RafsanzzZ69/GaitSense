# GaitSense professional app UX, authentication and navigation plan

Date: 9 October 2026 (Asia/Dhaka). Status: reviewed architecture; Phase 1 source implementation implemented, physical acceptance pending. Later phases remain planned.

Repository: `RafsanzzZ69/GaitSense`; workspace: `C:\Users\user\Downloads\CSE400Project`; branch: `main`. Local HEAD and local `origin/main` both resolve to `968b2d686879978362fd1eab15d09a14fa2b4359`. No remote fetch was performed, so this is not a new assertion about the remote server's present HEAD.

Scientific status remains **NOT_EVALUATED**. This is productization of an existing Android application, not a replacement gait engine. The product owner's current real-authentication requirement supersedes earlier planning statements that accounts are outside the critical path. It does not supersede offline gait operation, scientific exclusions, or research approvals. Older planning documents are historical context, not evidence that this new architecture has been implemented.

The supplied primary-device acceptance baseline is 115 sampled frames, 115 pose frames, 115 usable frames (100%), saved knee/motion/interval outputs, and Airplane-mode close/reopen persistence. That is engineering acceptance, not scientific validation. This planning task did not repeat the device experiment.

## 1. Current frontend architecture

This section records the pre-Phase-1 source audit. Implemented routing differences and verification are recorded in the Phase 1 checkpoint in section 15; the gait/storage/analysis audit remains applicable.

### Entry points and actual Android routing

The [package manifest](../../frontend/package.json) uses `expo-router/entry`. Declared dependencies are Expo `~57.0.11`, Expo Router `~57.0.11`, React `19.2.3`, React Native `0.86.2`, Expo Camera/Video, safe-area context, screens, gesture handler, and vector icons. These are manifest versions, not a claim that every resolved package was rebuilt today. No Firebase, React Native Firebase, Google authentication, AsyncStorage, or separate application state-store dependency is declared. Expo Router is already the navigation framework; adding another root navigator would duplicate it.

The [native root layout](../../frontend/src/app/_layout.tsx) supplies SafeAreaProvider, StatusBar, and a Stack with hidden headers and fade transitions. The following Android routes all redirect to `/offline`: `index`, `dashboard`, `assess`, `history`, `login`, `register`, `profile`, and `report/[id]`. The [offline route](../../frontend/src/app/offline.tsx) exports [OfflineCapture](../../frontend/src/offline/OfflineCapture.tsx). Thus file-based routes exist, but Android does not yet have distinct functional Home, authentication, History, or Report screens.

The [web layout](../../frontend/src/app/_layout.web.tsx) uses WebProvider and Slot. Web routes use a separate WebApp/API/showcase path. [WebProvider](../../frontend/src/web/context.tsx) keeps backend tokens in memory; its own comment says reload needs login again. Generic native auth files are placeholders, and generic landing/dashboard components contain sample scores and claims outside the accepted Android scope. Neither the web demo nor [API services](../../frontend/src/services/api.ts) is a suitable Android authentication or results implementation. Preserve the web path; audit platform fallbacks/deep links so Android never exposes its mock reports or stronger claims.

### Capture, storage and analysis ownership

| Area | Actual owner and behavior |
| --- | --- |
| Recording UI/controller | OfflineCapture owns permission, camera readiness/restart key, notice checkbox, side, direction, upright, countdown, recording, preview URI, processing, error, History, frame inspection and selected saved analysis. CapturePhase is `ready/countdown/recording/preview/processing`. |
| Setup snapshot | [recording-analysis-setup.ts](../../frontend/src/offline/recording-analysis-setup.ts) freezes one attempt snapshot before countdown. Direction is `1/-1/null`; upright is `true/null`. The active snapshot survives preview and processing and is cleared after cleanup. Side currently defaults to `side_left`; direction/upright reset after attempts. |
| Camera/preview | Rear CameraView, muted video, requested 720p, 16:9 preview sizing, three-second countdown, maximum 15 seconds and 140 MB recording request; local preview uses Expo Video with contain fitting. Native processing accepts approximately 9.5–16 seconds and at most 150 MB. Preserve these distinct constraints. |
| Lifecycle | Component unmount stops recording, requests native cancellation, removes listeners, clears setup and attempts temporary-video cleanup. App background interrupts countdown/recording and requests cancellation. Saved-analysis focus cleanup disposes its binding; background invalidates selection. Camera teardown is not implemented by the saved-analysis focus hook: route blur alone must not be assumed to release the camera. |
| Native bridge | [module interface](../../frontend/modules/gaitsense-pose/index.ts) exposes processing, list/read, single/all deletion, temporary-video cleanup, cancellation and actual `onProgress` events. Optional native import produces unsupported UI on Expo Go/iOS/web, never simulated extraction. |
| SQLite | PoseStore in [GaitSensePoseModule.kt](../../frontend/modules/gaitsense-pose/android/src/main/java/expo/modules/gaitsensepose/GaitSensePoseModule.kt) owns `gaitsense-offline.db`, schema version 1: sessions with summary JSON and frames keyed by session/timestamp; foreign-key cascade deletion. No Firebase UID field exists. Native list returns latest 100 summaries; storage can contain more. |
| Save/privacy | Native processing deletes the temporary source before committing successful summary/frame inserts in one transaction. Failure/cancellation also attempts deletion. JS performs cleanup too; cleanup failure can retain URI/snapshot for explicit discard. Process death can leave cache videos; explicit leftover cleanup already exists. |
| Quality | [RequiredJointQualityGate](../../frontend/modules/gaitsense-pose/android/src/main/java/expo/modules/gaitsensepose/RequiredJointQualityGate.kt) checks selected shoulder/hip/knee/ankle: left indices 11/23/25/27, right 12/24/26/28. Required visibility and presence each >=0.6; normalized x/y each in 0..1; usable/all requested samples >=70%. Native also enforces the existing multiple-pose gate. Preserve all rules and denominators. |
| Saved analysis | [binding](../../frontend/src/offline/saved-analysis-binding.ts) -> [loader](../../frontend/src/offline/saved-session-loader.ts) -> [payload adapter](../../frontend/src/offline/saved-payload-analysis.ts) -> [session wrapper](../../frontend/src/offline/session-analysis.ts) -> knee/motion/interval modules -> [presentation](../../frontend/src/offline/analysis-presentation.ts) -> [panel](../../frontend/src/offline/SavedAnalysisPanel.tsx). This already provides separation worth retaining. |
| Provenance | Structured metadata-v2 supplies native inference geometry and operator direction/upright, with conflict handling. Checked detector segments are requested by the saved binding; this is not proof of decoded continuity or complete physical cycles. See [metadata](../../frontend/src/offline/ANALYSIS_METADATA.md), [setup contract](../../frontend/src/offline/RECORDING_ANALYSIS_SETUP.md), and [continuity audit](../../frontend/src/offline/SAVED_CONTINUITY.md). |
| Persistent vs transient | SQLite persists sessions/frames/summary provenance. Current component consent, setup draft, active snapshot, preview URI, phase, frame index and selection are transient. There is no authenticated session or durable onboarding/acknowledgement preference yet. Analysis outputs are derived from saved data; the new UI must not pretend a new cloud results store exists. |

Current successful processing reads the new session's frames and refreshes inline History, then returns to ready; it does not automatically navigate to a dedicated Result. The new architecture should route using the returned saved ID after persistence succeeds.

### Tests coupled to this structure

[offline.test.mjs](../../frontend/tests/offline.test.mjs) checks capture contracts, parsing, native schema/cascade/rollback via Node SQLite, permission configuration and bundled model hash when available. It does not execute Android SQLite or camera hardware.

[recording-analysis-setup.test.mjs](../../frontend/tests/recording-analysis-setup.test.mjs) transpiles the actual OfflineCapture with mocked hooks/native seams. It exercises snapshot locking, countdown cancellation, discard/retry, native failure, cleanup failure, deletion and late reads. [saved-analysis-ui.test.mjs](../../frontend/tests/saved-analysis-ui.test.mjs) transpiles capture/panel and has source assertions for focus/background/unmount wiring. [saved-analysis-integration.test.mjs](../../frontend/tests/saved-analysis-integration.test.mjs) explicitly asserts `history.android.tsx` redirects to `/offline`. These assertions must migrate when the real History route changes; preserve behavioral race/privacy checks rather than mechanically deleting failing tests.

Loader, adapter, presentation, knee, motion, interval, metadata, framing and session suites are already independent of routing. Native Kotlin tests cover quality/setup/diagnostics/metadata; Android instrumentation covers runtime seams. Unrelated uncommitted research work and a new native instrumentation file were present before this task and remain outside this plan's edits.

## 2. Current UX problems

| Class | Current issue | Product consequence |
| --- | --- | --- |
| Functional architecture | Many Android routes redirect to one component; workflow, History and inspection share lifecycle and state. | No clear entry hub, task boundaries or reliable screen identity; extraction can accidentally unmount the owner or create duplicate owners. |
| UX / information hierarchy | Notice, setup, camera, quality, raw frame plot, saved panel, cleanup and deletion occupy one long ScrollView. | Main action competes with maintenance; users scroll to understand completion and return to prior measurements. |
| Visual design | OfflineCapture hardcodes its own styles; [theme tokens](../../frontend/src/constants/theme.ts) and [shared UI](../../frontend/src/components/ui.tsx) belong partly to an older showcase. | Branding and reusable controls are inconsistent. Reusing mock score/exercise/report components would also misrepresent capability. |
| Technical/developer UI | Preview dimensions, native diagnostic strings, raw landmark browsing, session IDs and detailed exclusions dominate ordinary use. | Engineering evidence overwhelms the recording/result task. |
| Authentication | Android routes are redirects/placeholders; web tokens are memory-only and unrelated to Firebase. | No real Android identity, persistent login, reset, linking or account lifecycle. |
| Research/consent dependency | Existing notice correctly distinguishes study consent but is repeated inside capture and not versioned as app onboarding. | Need a durable app acknowledgement while keeping study-specific approved consent separate. |

The central problem is screen responsibility and lifecycle, not missing analysis algorithms. Do not make UI simplification a reason to suppress uncertainty or replace unavailable values with zero.

## 3. Target screen map

```text
Launch -> local Firebase auth restoration
  no restored user -> Welcome -> Google / Email Sign In / Create Account
                                -> Reset Password / verification guidance
  restored or newly signed-in user
    -> App Acknowledgement (only missing/current version not acknowledged)
    -> Onboarding (only not completed/skipped on this installation for this UID)
    -> Home

Main tabs: Home | History | Help | Settings
Home -> Measurement stack: Setup -> Camera -> Local Preview -> Processing -> Result
History -> Saved Result
Help -> How to Measure / Replay Onboarding
Settings -> Profile / Account actions / Local Data / About & Limitations
```

Preview is retained as part of Camera's review state or a child route; do not remove today's ability to inspect/discard before extraction. About and privacy information should also be reachable from Welcome without an account. Measurement screens sit above main tabs; hide tabs during capture/processing. Newly captured Result and Saved Result share a result content component and the same saved loader; they differ in entry context/actions, not calculations.

## 4. Real Firebase authentication architecture

### Recommended integration

Use native Firebase Authentication behind a small Android AuthAdapter. Prefer `@react-native-firebase/app` and `@react-native-firebase/auth`, subject to a later Expo 57 / RN 0.86 compatibility/build check. This app already requires a custom native Android build for MediaPipe; Expo Go compatibility is not a reason to choose a weaker identity path. Expo documents both SDK options and the native-build requirement: [Expo Firebase guide](https://docs.expo.dev/guides/using-firebase/). Read the repository's [frontend instructions](../../frontend/AGENTS.md) and [versioned Expo 57 reference](https://docs.expo.dev/versions/v57.0.0/) before later implementation. Do not choose library versions or regenerate native directories blindly.

Google: Android Credential Manager obtains a Google ID credential; Firebase exchanges it through GoogleAuthProvider into a Firebase session. Use the official Web/server OAuth client ID for the credential audience, not the Android client ID. Prefer a maintained RN wrapper demonstrably using current Credential Manager; if none meets compatibility/acceptance, use a small dedicated Expo authentication module. Keep this bridge separate from `gaitsense-pose`. Cancellation/no available authorized account needs an explicit fallback account picker, not an error loop. [Firebase Android Google integration](https://firebase.google.com/docs/auth/android/google-signin).

Email/password creation, login, reset, verification, sign-out, deletion and linking use the Firebase SDK. No anonymous/demo substitute, custom auth server, custom password database, or phone/SMS provider. Password fields exist only transiently, are obscured with optional visibility toggle, allow password managers/paste, and are cleared after operations/navigation. Never persist or log passwords or credential objects.

Proposed modules: `src/auth/AuthAdapter`, `AuthProvider`, typed auth operation/error mapping, and an optional native Google credential bridge. AuthProvider owns SDK subscription and a small identity snapshot. Screens initiate operations; routes never implement token management. Keep provider credentials SDK-owned. RN Firebase documents native persistence and auth-state observation: [Auth usage](https://rnfirebase.io/auth/usage).

### States and transitions

Model session state independently of operation state and connectivity:

| State | Meaning / route behavior |
| --- | --- |
| AUTH_LOADING / RESTORING | Initial native SDK state unresolved. Brief local restoring screen; no network probe or token refresh as a gate. |
| SIGNED_OUT | SDK restoration completed with no user. Welcome/auth, with online requirement for establishing identity. |
| REGISTERING / SIGNING_IN | One operation pending; disable duplicate submission; preserve entered email; cancellation/error stays in its flow. |
| SIGNED_IN | SDK user restored/established; route through local first-use gates to Home. |
| EMAIL_VERIFICATION_REQUIRED | Action-needed substate for unverified password email, not absence of identity. Send verification and provide Later/Continue locally. Verification refresh requires network only when requested. |
| OFFLINE_WITH_RESTORED_SESSION | SIGNED_IN plus offline/unreachable services. Local routes remain available. |
| AUTH_ERROR | Operation-scoped recoverable error; existing authenticated user remains available for local work on network failure. An actual SDK initialization failure gets Retry/help, not fabricated signed-in state. |
| REAUTHENTICATING / DELETING_ACCOUNT | Sensitive account operation with its own network/progress/error state. Do not delete local sessions as an error-recovery action. |

Verification policy: require verification before any future feature needing verified email ownership; initial local gait features remain usable after real account creation. New email accounts get verification guidance, resend throttling and a manual online “I have verified” refresh. A cached unverified flag never becomes a global offline lock. No new remote permission is granted on the basis of a local acknowledgement or cached profile.

### Linking and account lifecycle

Link Google/password credentials only after authenticating the existing account and proving control of the new provider, using Firebase's linking operation so UID stays unchanged. Matching email text alone is not proof of ownership. For provider collision, guide the user through the existing provider and an explicit linking step; avoid email-enumeration/provider-discovery assumptions. If the credential is already attached to another UID, show a safe conflict and retain the current account. Do not automatically merge/delete accounts or local datasets. Abort unfinished linking on app exit and discard transient credentials. [Firebase provider linking](https://firebase.google.com/docs/auth/android/account-linking).

Sign out must work locally via the SDK, clear UI identity/result caches, and clear Credential Manager credential state as supported so the next deliberate Google login can choose an account. Ordinary sign-out is not Google account deletion or access revocation. Do not immediately auto-sign-in after sign-out. Keep local measurements unless the user separately requests deletion, with clear shared-device information.

Delete account is online and may need recent provider reauthentication. Confirm the exact account and show that Firebase identity deletion and on-device measurement deletion are distinct actions. On success, clear local profile/preferences for that UID and return to Welcome; retained device measurements remain on the phone. Offer a separate explicit “also delete measurements on this phone” choice; it must warn that the current database is device-wide. Never wipe sessions before Firebase deletion succeeds. If remote deletion succeeds but optional local cleanup fails, report both outcomes accurately and keep a local-data maintenance path accessible from Welcome; do not claim complete erasure. Offline deletion is “connect to delete account,” never fake success or a silently queued destructive job. [Firebase user management / recent login](https://firebase.google.com/docs/auth/android/manage-users).

### Separate later Firebase implementation task

Phase 2A compatibility, signing, permission and implementation prerequisites are recorded in [Firebase Auth implementation readiness](FIREBASE_AUTH_IMPLEMENTATION_READINESS.md). Its native-library recommendations are conditional build candidates. The pre-auth checkpoint has now corrected the stale native-input Home assertion and verified the current release build; Phase 1 physical acceptance remains pending. No Firebase implementation is included in Phase 2A or the pre-auth checkpoint.

Phase 2 must deliver actual SDK configuration, current Google credential flow, email create/login/reset/verification, local restoration, basic sign-out/delete/linking controls, operation error handling and the controlled internet-permission change. Phase 8 later improves account/settings presentation rather than postponing working account lifecycle.

| Acceptance case | Required result |
| --- | --- |
| Google success/cancel/no accounts | Real Firebase UID on success; cancel/no credentials is recoverable; no synthetic identity. |
| Email create/login | Validation consistent with configured password policy; registration establishes identity; passwords never persist. |
| Incorrect password / unknown account | Safe generic sign-in failure; no promise that errors distinguish account existence. |
| Duplicate email / provider collision | Bounded recovery to sign-in/reset/existing-provider flow; no new UID assumption or email-based silent merge. |
| Link Google to password / password to Google | Prove both identities; same UID after success; collision/failure leaves existing session and data intact. |
| Forgot password / email verification | Real provider email operation, generic reset confirmation, throttling/error handling and explicit online refresh. |
| Sign out | Offline-capable local session removal; back cannot reopen protected routes; measurements preserved. |
| Delete / recent-login-required | Provider-specific reauth and actual remote success; cancellation/offline/failure leaves local sessions intact. |
| Internet lost during first login | No false success; inspect SDK completion before allowing a retry if server outcome was ambiguous. |
| Offline restored launch/relaunch/reboot | Same restored UID; Home and all local measurement/data actions usable. |
| Internet lost mid-measurement | No pipeline cancellation or data change solely due to connectivity. |
| Expired token / known disabled-deleted account | Transient refresh failure is not sign-out; definitive invalidity is handled explicitly after safe workflow settlement. |

Use adapter/unit tests for state transitions, Firebase Auth emulator for supported email/link operations, and real Android/provider tests for Google, email delivery and native persistence. Emulator or mocked identity cannot establish production Google acceptance.

## 5. Persistent-login / offline behavior

### Launch contract

1. Initialize native Auth once and subscribe to its initial local state; do not interpret an early pre-initialization null as intentional sign-out.
2. If the SDK restores a Firebase user, accept that local session for the local app. Load local acknowledgement/onboarding preferences, then Home when satisfied.
3. Do not await `reload`, forced token refresh, Firestore, profile-photo download, backend health or a connectivity probe before Home.
4. If resolved state has no user, show Welcome. Previously cached display name/UID/preferences alone cannot authorize entry.
5. Genuine local initialization failures get a bounded error/Retry screen. Validate cold offline restoration on the chosen build; if an integration waits for a server, repair it before acceptance rather than replacing authentication with a local “loggedIn” boolean.

Normal close/reopen, process restart, reboot and long ordinary use preserve login when native SDK state remains available. No invented periodic session expiry or daily login requirement. This is an intended app contract that still requires device proof, not evidence that Firebase has been installed. SDK documentation describes native persistence; Firebase notes that locally returned users can outlive server token validity: [native Auth persistence](https://rnfirebase.io/auth/usage), [current-user caveats](https://firebase.google.com/docs/auth/android/manage-users).

### Day 1 / Day 30 contract

Day 1: online Google or email authentication -> successful Firebase session -> app acknowledgement -> onboarding -> Home.

Day 30: launch fully offline -> SDK locally restores user -> Home, provided local first-use gates were completed. Camera, MediaPipe, required-joint checks, local save, History, fresh/saved results, single/all local deletion and cleanup work without any server. Missing local onboarding/acknowledgement can also be completed offline using bundled content.

Connectivity is an informational status, not route authorization. Prefer “Processed and stored on this phone”; do not claim a live connection state without evidence. Network failures affect only login, reset/resend, verification refresh, linking, remote profile edits and account deletion. Show inline operation-specific reconnect/retry guidance; local measurement remains available. Missing remote avatar uses initials. Avoid perpetual retry spinners, login flashes and global “internet required” screens for restored users.

### Exceptions and security limit

Reauthentication/new login may be needed after deliberate sign-out, successful account deletion, cleared app data, reinstall without restorable credentials, actual invalid/revoked/disabled credentials, or a genuine sensitive-operation provider requirement. Password reset or major account changes can invalidate refresh credentials. A short-lived ID token expiring is not itself a reason to block local analysis; SDK refresh is a separate remote concern. [Firebase session lifecycle](https://firebase.google.com/docs/auth/admin/manage-sessions).

Server revocation/deletion cannot necessarily be learned while fully offline. A restored user may continue using local features until connectivity and an authenticated operation reveal invalidity. Do not present this as fresh server verification. Once definitively known, prevent new protected work, settle/cancel the active attempt safely and return to reauthentication. Network timeout alone is not definitive invalidity. SDK sign-out/account-switch events invalidate sensitive UI selections; controller cleanup must not corrupt or roll back already committed SQLite sessions.

## 6. User / profile storage decisions

### Minimum data placement

| Value | Authoritative location | Local policy |
| --- | --- | --- |
| UID, email, display name, photo URL, provider IDs, emailVerified | Firebase Auth user | Read SDK's available local snapshot; no duplicate credential store. Name is optional, not medical identity. |
| Account creation / last sign-in metadata | Firebase Auth metadata when available | Display only if known; never invent creation/update times. |
| Acknowledgement version + acceptedAt, onboarding version + completed/skipped state | Separate local preferences, namespaced by installation and UID | Bundle content; persist atomically. Device timestamps are local UX records, not authenticated research-consent evidence. |
| App settings, onboarding replay progress, optional technical-detail preference | Local preferences | A supported AsyncStorage dependency is a reasonable later addition; no secrets. Do not repurpose gait schema for preferences. |
| Optional local preference updatedAt | Local preferences | Clearly local, not a server audit timestamp. |
| Participant identifiers / study consent / reference labels | Separate future approved research workflow | Never map Firebase UID automatically to a participant or the person in the video. |

Never manually store passwords, OAuth/Google access credentials, refresh tokens or administrative private keys. Application JS should not serialize the entire SDK user object into preferences. Firebase and credential-provider SDKs own credentials.

### Firestore comparison and decision

| Criterion | A: Auth + local preferences (recommended) | B: Auth + minimal Firestore profile |
| --- | --- | --- |
| Offline | Local first-use gates work immediately; no profile request. | Cached profile can help, but first fetch/reinstall may have no cache; local availability must not wait for it. |
| Complexity | Auth adapter and local versioned preferences only. | Schema, rules, cache/conflict policy, writes, remote deletion/recovery and rule tests. |
| Security | No profile database/rules surface; SDK identity still required. | Every read/create/update/delete must check authenticated UID ownership and permitted fields. |
| Privacy | No extra personal cloud copy beyond Auth. | Additional remote metadata, retention and disclosure requirements. |
| Thesis value | Demonstrates real identity plus resilient offline app; no scientific validity implied. | Helpful only if a defined cross-device profile requirement is studied. Database count alone adds no thesis value. |
| Scale | Adequate for initial small app; preferences remain per device. | Useful later for multi-device preferences; operational cost and security work grow. |

Choose A. Reinstall may replay acknowledgement/onboarding; cross-device preference synchronization is not currently needed. Do not enable Firestore by default.

If B is later approved, use one `/users/{uid}` profile document with an explicit field allowlist/types/version policy. All operations, including create, require `request.auth != null && request.auth.uid == uid`; deny collection listing and all other paths/subcollections by default. A UID field, if present, must equal the path and remain immutable. No client-editable privileged role, clinical or participant field. Test unauthenticated access, A->B reads/writes, extra fields and deletes in the rules emulator. Acknowledge that client-written timestamps/version fields are UX records, not trusted consent evidence. Remote profile reads/writes must never gate local gait work. Profile cleanup across Auth deletion is not atomic; define retry/recovery before adopting B. [Firestore ownership conditions](https://firebase.google.com/docs/firestore/security/rules-conditions).

## 7. Firebase vs local-data boundary

```text
Account screens -> AuthAdapter -> Firebase Authentication (network as needed)
Root routes <- native SDK session + local first-use preferences

Measurement screens -> one measurement controller -> existing native pose module
                                                     -> local SQLite
Result / Saved Result -> existing saved binding / analysis / presentation
History / local deletion -> existing native SQLite methods
```

There is no Firebase path from gait controller/storage/analysis. No video, landmarks, session payloads, knee outputs, candidates, intervals, reference labels or participant records upload. Do not add Firebase Storage, Firestore gait collections, automatic exports, Analytics or Crashlytics as an auth dependency. Current research/backend/showcase assets remain separate.

**Current local-data boundary — ACCOUNT-SCOPED HISTORY / LOCAL OWNERSHIP: DEFERRED PENDING SUPERVISOR DECISION.** Preserve today's device-local database. It is not UID-scoped; signing into another account on the same installation will see the same device History. Authentication identifies the operator/account, not ownership of every saved recording. Clearly say “Measurements on this phone”; disclose retained History when signing out/switching accounts, and offer explicit local deletion. Do not silently assign historical records to the first Firebase account, migrate schema, erase data on logout, or claim account isolation. Protect local routes while signed out; public privacy/local cleanup can be available without exposing result contents.

This is suitable for the present device-managed research app with explicit shared-device handling, not a promise of private multi-user vaults. If product review requires isolation between accounts, schedule a separate local access/ownership migration with preservation of legacy sessions before shared-device release. It still need not involve cloud sync. Firebase authentication does not independently authenticate frame ownership or establish participant identity.

## 8. Acknowledgement vs research-consent distinction

App acknowledgement covers non-diagnostic purpose, local processing/retention/deletion, the new remote identity service, offline behavior, scientific limitations and ordinary privacy information. Persist its version and local acceptedAt separately from onboarding. Users may decline and leave/sign out; do not interpret Skip onboarding as agreement. Keep content bundled and available offline; a substantive bundled version update may require acknowledgement again without requesting internet.

The existing per-recording local-processing checkbox and native consent boolean remain intact during migration. Do not silently change `local-prototype-notice-v1`: parseSession currently requires it and native summaries write it. Future version handling needs explicit compatibility tests and an additive policy preserving old records. Durable app acknowledgement does not automatically replace the per-recording informed-person requirement or authorize recording other people.

Formal university research consent needs supervisor/institution-approved study information, investigator/contact details, withdrawal, retention, eligibility and approved consent evidence. This plan supplies no final consent wording. A later optional research module may track study ID, approved document version and consent reference through an approved process; keep it distinct from UID, app acknowledgement and measurement setup. Existing [study protocol](STUDY_PROTOCOL.md), [consent draft](CONSENT_DRAFT.md) and [approval register](approvals.json) are review inputs, not permission to recruit or collect.

Supervisor-dependent: formal study/consent text and ethics determination, participant information/retention/withdrawal policy, research identifiers and recording permissions, validation/reference protocols, approved scientific claims, and any research dataset acquisition. Ordinary shell work, real account configuration and non-diagnostic app navigation do not require participant recordings.

## 9. Onboarding / manual

Use five concise bundled pages; final copy and illustrations come later:

1. Purpose: local gait-analysis research tool, **NOT_EVALUATED**, non-diagnostic; what results can and cannot show.
2. Space/framing: steady camera, clear level path, even light, one person's entire body including head/feet visible from the side; normal comfortable walking and stop if uncomfortable.
3. Setup concepts: person's anatomical left/right, image-left/image-right travel, and head-top/feet-bottom confirmation are separate operator assertions.
4. Capture/review: countdown, 10–15-second goal, keep framing throughout, local preview, discard/retake; no automatic direction/upright inference.
5. Processing/results/privacy: local extraction, quality rejection/retry, local History, temporary-video deletion with interruption caveat, projected/candidate output limitations and technical-details access.

Back/Next/Done; allow Skip educational walkthrough with durable skipped state, never Skip acknowledgement. Done/Skip -> Home. Do not request camera permission in Welcome/onboarding; ask at the camera boundary with explanation. Help can replay all pages without resetting acknowledgement or forcing the launch flow again. Operator guidance must not prescribe gait changes, exercises or treatment. Formal study instructions can later extend the manual only after approval.

## 10. Navigation architecture

Reuse Expo Router with nested stacks and four stable main tabs. Start Phase 1 with just Home and existing capture in a simple stack; add tabs when genuine destination screens exist, not placeholder navigation. Keep `.web` platform behavior separate and prevent generic mock components falling into Android. Root, auth/first-use, main and measurement layouts should have explicit responsibilities.

Final route groups are conceptual, not a mass file-move instruction: `(auth)` for Welcome/login/register/reset; `(first-use)` for acknowledgement/onboarding; `(main)` for tabs; a sibling `measurement` stack; `saved-result/[id]` and About/privacy child screens. Each real screen exists once; group names do not confer security. Guard native routes using SDK-restored session and local first-use state. Prefer supported Expo Router protected stacks; do not use newer SDK-only properties blindly (current protected-route docs mark `redirectTo` as SDK 58+; this repo uses 57). Deep links and old aliases must resolve through the same guards. These are client UI protections, not database encryption or cloud authorization. [Expo protected routes](https://docs.expo.dev/router/advanced/protected/).

Back rules:

- Auth forms -> Welcome; successful login replaces auth history so Back cannot return to a populated password form.
- Setup -> Home with draft discarded or intentionally retained only within the same attempt.
- Countdown -> cancel countdown and settle; no camera request/session. Recording -> confirm stop/discard before leaving. Preview -> confirm discard if leaving without extraction.
- Processing -> request existing native cancellation, await settlement/cleanup before route teardown; do not label navigation away as successful processing. Allow leaving once cleanup settles; failure preserves explicit recovery guidance.
- Result -> Home using replace/reset behavior so Back cannot resurrect recording/processing. Saved Result -> its History origin; deletion returns after selection invalidation and successful native delete.
- Hide main tabs during active measurement. Profile sign-out/delete/account switching is unavailable during an active attempt until it is settled. Rapid pushes and deep links cannot mount a second controller.

Use a single measurement-layout controller lifetime across Setup/Camera/Processing. Camera mounts only in its appropriate focused states; transitioning Camera->Processing must not invoke parent unmount cancellation. Retain AppState interruption behavior; background is not an automatic resumable job. The current native cancel is cooperative and reads are not cancellable; navigation must invalidate late reads and respect native settlement.

On process death/reboot: restore SDK user/preferences and SQLite History, then Home; do not persist active video URI/snapshot/processing route as a resumable job. Warn about and offer existing leftover-video cleanup. If native save committed before termination, it appears in History on refresh. If no transaction committed, no Result is invented. A dead/deleted/out-of-latest-100 result deep link shows unavailable; do not assume this proves absence from the whole database.

## 11. State ownership

| State | Owner / lifetime | Persistence and boundary |
| --- | --- | --- |
| Auth session | One AuthProvider/adapter, app lifetime | Native SDK only; no persisted boolean substitute. Connectivity/operation errors are separate. |
| User profile | Derived SDK user snapshot | Optional nonsecret display fallback only; never sufficient for route authorization. |
| Onboarding complete/skipped/version | Local preference service, per installation + UID | Independent of gait database; reload on UID changes. |
| Acknowledgement version/time | Same local preference service | Versioned, offline; distinct from per-recording notice and study consent. |
| Setup draft | Measurement controller, one flow | Transient side/direction/upright/notice; retain current semantics. |
| Active snapshot | Existing recording setup binding inside controller | Frozen at countdown; later UI edits cannot change it. Clear only with attempt cleanup. |
| Camera/URI/timer | Camera child + controller refs | Camera handle is not global; URI remains local/transient and follows current discard contract. |
| Processing / busy lock / cancellation | One controller/native operation | Single native operation; subscribed real progress; no duplicate screen-owned processors. |
| Current saved session ID | Controller after verified save, then route param | ID only in navigation, never full landmark arrays/passwords. Re-read through existing loader. |
| History | History screen/repository adapter | Native SQLite is authoritative; refresh on focus/save/delete; invalidate caches on sign-out. Latest 100 is explicit. |
| Saved/current Result | One screen-lifetime saved binding per result view | Generation/token cancellation of obsolete publication; dispose on blur/unmount, invalidate on background/deletion/identity changes. |
| Technical-detail expansion | Result/detail screen-local UI | Presentation only, not scientific context or persisted geometry inference. |

Use focused context/hooks/services, not one giant global store. The later measurement controller extracts orchestration, not algorithms. Keep raw diagnostics out of analysis setup; no guessing geometry/direction/upright from text, side or device orientation. Result state labels must map faithfully: loader `ready` can still yield presentation `partial`; presentation `calculated` is not clinically validated. Retain loading, ready/calculated, partial, unavailable and failed distinctions and original reason codes.

## 12. Screen-by-screen responsibilities

| Screen | Responsibility and main content | Actions / exclusions |
| --- | --- | --- |
| Welcome | GaitSense name, short non-diagnostic purpose, identity-service/privacy access | Continue with Google, Sign in with email, Create account. Returning restored user skips it. No scores, clinical claims or gait diagnostics. |
| Email sign-in | Email/password, accessible labels, progress and safe errors | Sign in, forgot password, Google option; password manager support. |
| Create account | Email/password, password policy, confirmation, optional name later | Create, sign-in alternative; no DOB, diagnoses or study identifiers. |
| Reset / verification | Real email request and status, verification check online | Resend with throttling, retry, continue local use where applicable. |
| App acknowledgement | Bundled versioned privacy/non-diagnostic/local-data information | Acknowledge or decline; distinct from university consent. |
| Onboarding | Five short educational pages | Back, Next, Skip, Done; replay through Help. |
| Home | Start Gait Measurement primary; History, How to Measure, Settings entry | Optional latest saved date/usable rate after local read; no unsupported score. Local read failure must not disable Start. No camera/results dump. |
| Measurement Setup | Framing checklist, per-recording notice, side/direction/upright controls | Continue/back. Side stores `side_left/side_right`; rightward image travel `+1`, leftward `-1`; direction unspecified remains allowed and upright unchecked remains unknown, with analysis limitation notice. Preserve current defaults; do not silently make missing assertions mandatory or auto-inferred. |
| Camera / review | Primary camera image, countdown, readiness, recording timer, preview/retry | Record/stop/cancel/discard/extract; permission denial and restart guidance. No History/debug block. Show early-stop duration guidance without changing native acceptance rules. |
| Processing | Truthful current activity and cooperative cancellation | Existing extraction events can show extraction percent capped below completion, not whole-job accuracy. Use indeterminate preparing/quality/save/result stages unless actually observable; no fake granular timings. |
| Quality rejection | Understandable required-joint/framing retry message | Retake/new setup, Help, Technical Details; no accepted saved result. Do not blame one joint solely from overlapping counters. |
| Processing failure | Bounded failure and cleanup outcome | Safe retry/explicit discard if retained; existing History intact. No session fabricated. |
| Result | Saved session summary -> recording quality -> projected 2D knee flexion -> candidate ankle-motion extrema -> candidate-to-candidate temporal intervals -> limitations -> Technical Details | Done, New Measurement, View History, confirmed Delete. “100% usable” describes capture gate, not medical accuracy. Preserve unavailable/null versus numeric zero. |
| History | Date/time, anatomical side, usable rate, honest analysis/load status when known | Tap Saved Result, confirmed deletion, empty/error/loading states. Do not derive scientific status from diagnostics or claim all-time completeness for latest 100. No persisted rejected-session status exists today. |
| Saved Result | Shared result renderer + existing saved binding | Loading/ready/partial/unavailable/failed, back/delete. No separate UI-side formulas or repair of missing historical assertions. |
| Help | How to Measure, replay walkthrough, quality/recovery explanations | Bundled/offline; no internet required to read. |
| Profile / Settings | Account name/email/provider(s); App, Data/Privacy, Scientific Information | Sign out, delete account, explicit linking; local one/all-session management and leftover cleanup; app version, Help/About. Network-scoped account actions. |
| About / limitations | Research purpose, NOT_EVALUATED, 2D/candidate/requested-clock limitations, version and privacy | No diagnosis, treatment guidance, fall-risk assessment, clinical accuracy or validated gait score. |

Processing observability is limited: today's native events report sample-loop progress and the promise resolves after save; quality/save have no separate stage events. In early extraction use “Extracting pose landmarks” then “Preparing saved results” after promise resolution. Any richer stage event contract is a separate additive native/UI change with tests. Rejection classification must preserve raw failure detail; do not parse diagnostic counters into scientific evidence or invent structured error codes the bridge does not emit.

Dates use device locale/timezone and show local recording time; tests should avoid fixed timezone assumptions. Result limitations must retain requested sampling timestamps, unavailable actual decoded-frame PTS, unestablished exact-image correspondence/frame ownership, and unknown physical-cycle completeness. Firebase identity does not repair these limits.

## 13. Diagnostics visibility

| Tier | Content | Location/policy |
| --- | --- | --- |
| Normal user | Recording readiness/timer, quality acceptance/retry, usable rate, selected side, calculation availability, key scientific limitations and local storage status | Main flow, concise. Keep material limitations beside outputs, not solely buried in About. |
| Advanced technical detail | Sample/pose/usable counts, persisted setup provenance/conflicts, inference geometry, timestamp method, model/extractor versions, continuity gaps and exclusions | Result/Saved Result collapsible Technical Details, available offline. |
| Developer/research debug | Raw native diagnostics, per-joint confidence/presence/bounds counters, exclusive vs overlapping rejection counters, decoder dimensions/rotation, raw frame plot/browser and detailed observation rows | Explicit Research/Developer detail view or debug build option; retain local capability. No routine auto-export/telemetry. |

Preserve full native errors for investigation while presenting a readable summary. Explain first-failure counters are not sole causes and overlapping counts are not additive rejected frames. Do not lose rejection details after cleanup. Technical IDs/diagnostics should not be sent with automatic support reports. Normal UI cannot replace “candidate” terminology with shorter but stronger contact-event names.

## 14. Visual design system

Define reusable Android tokens/components before later polish; final visual design is not produced here. Reuse trustworthy ink/teal/neutral direction from current theme where contrast passes; do not inherit its sample-score widgets or wellness claims.

- Typography: scalable platform text, body approximately 16 sp, clear title/section/body/caption hierarchy; avoid giant numeric “health scores.” Support font scaling and wrapping of long scientific labels.
- Spacing: consistent 4/8/12/16/24/32 dp scale; comfortable card padding and stable vertical rhythm. Modest radii, restrained elevation and generous recording area.
- Components: primary/secondary/destructive buttons, labeled text inputs, anatomical-side and direction selectors, checkbox, cards, banners, headers, loading indicators, empty/error states and expandable details. Define focus/pressed/disabled/busy states once.
- Semantics: green/teal for completed operation only, warning for limited/rejected capture, red for failure/destructive action. Pair colors with text/icons; avoid red/green medical-good/bad interpretation.
- Accessibility: minimum 48 dp touch areas, tested text contrast (4.5:1 normal text, 3:1 large text), TalkBack names/roles/state and logical focus, password-field labels, live region for meaningful progress/errors, no excessive timer announcements. Test keyboard avoidance, insets, small phones, large text, long names/emails and permission denial.
- Icons: existing vector icons plus labels; no unexplained controls. Stable headers/back behavior. Loading/empty states explain the next action and never display sample measurements as real data.

Keep design tokens modular so Android screen polish does not inadvertently redesign web/showcase assets. Define offline/local banners only where useful; no repeated full-screen disconnected warnings.

## 15. Migration phases

### Phase 1 checkpoint — SOURCE/BUILD COMPLETE / PHYSICAL PENDING

**PHASE 1 SOURCE IMPLEMENTATION: IMPLEMENTED.** **PHASE 1 PHYSICAL ACCEPTANCE: PENDING.** The professional-app milestone is not complete.

Android index now renders [HomeScreen](../../frontend/src/home/HomeScreen.tsx). Its only action is Start Gait Measurement -> `/offline`; a synchronous ref latch prevents rapid repeat pushes and resets on Home focus. The existing root Expo Router Stack gives Android `/offline` a constant singular identity, including different query parameters, so an existing workspace route is reused. No navigation framework or dependency was added.

[offline.android.tsx](../../frontend/src/app/offline.android.tsx) mounts exactly one existing OfflineCapture and supplies a fixed [measurement workspace header](../../frontend/src/home/MeasurementWorkspaceHeader.tsx). OfflineCapture adds only an optional header-render callback exposing a live exit predicate: mounted, ready, no active handler lock, no retained video, and no recording snapshot. Capture/processing/analysis handlers are unchanged. Home is enabled only while idle; hardware Back is consumed and explains how to settle an active attempt through existing controls. Expo Router 57's bundled `usePreventRemove` also guards pops/replacements and replays the original action only when the live predicate permits exit. Home uses `dismissTo('/')`, which removes the workspace or replaces it for direct entry, rather than pushing Home over the camera. This is deliberately an idle-only exit boundary, not a new active-cancellation controller.

Home shows GaitSense, “Offline gait analysis using your phone camera,” a guided-recording card, local/no-upload information, and a visible “Scientific status: not evaluated” / non-diagnostic note. History remains inside the existing workspace. Android dashboard, assess, history, login, register, profile and report/[id] remain intentional transitional redirects to `/offline`. Web routes/layout, native gait code, permissions, SQLite schema and scientific modules are unchanged. Device-wide session ownership/account isolation remains a separate pre-multi-account-release decision; no hypothetical UID is assigned.

Initial source verification, before the build checkpoint: [14 new shell/navigation tests](../../frontend/tests/home-navigation.test.mjs), plus 117 existing recording-analysis-setup/offline/saved-analysis UI/integration tests, passed (131/131 focused); the full frontend suite passed 649/649 with no failures or skips. TypeScript passed. These Node checks use actual production components/handlers with injected UI/native seams and the installed underlying stack router; they do not establish Android hardware transitions, camera behavior or SDK persistence. No APK build, native compilation or physical test was performed in that initial source task. Unrelated work is excluded from the checkpoint and verified against before/after file hashes.

**Pre-auth source/build checkpoint (9 October 2026): COMPLETE.** The [native-input checker](../../frontend/scripts/check-offline-native.mjs) now parses the Home -> `/offline` -> single OfflineCapture relationship with the already-installed TypeScript parser; intentional legacy redirects and all existing native/privacy/model gates remain checked. [25 new preflight regression tests](../../frontend/tests/native-input-check.test.mjs) pass; focused tests pass 156/156 and the full frontend suite passes 674/674, with no failures/skips. TypeScript, corrected native preflight and whitespace checks pass.

The established `scripts/android-build.ps1 -Action assemble` workflow succeeded without toolchain, package, signer or native-source changes (`BUILD SUCCESSFUL in 1m 56s`; 544 tasks, 36 executed). The Android bundle was rebuilt. Nonfatal CMake path-length and Gradle deprecation warnings remain; no upgrades were made. APK verification and certificate checks passed: `com.gaitsense.research`, versionName 0.1.0, versionCode 1, minSdk26, targetSdk36, historical signer unchanged; INTERNET/audio/broad storage absent, backup disabled, pinned model and arm64-v8a/x86_64 libraries present, no private/data archive entries detected.

Candidate APK: `output/pre-auth-baseline/gaitsense-pre-auth-home-78bb8320c30516bf03a609751ddf73093776b83f405854ef97bef082f083ad72.apk`, **117,298,039 bytes**, SHA-256 `78bb8320c30516bf03a609751ddf73093776b83f405854ef97bef082f083ad72`. The ignored hash-named copy is frozen for later device acceptance; APK/build artifacts are not committed. **PHASE 1 PHYSICAL ACCEPTANCE: PENDING.** Firebase is not started; account-scoped History remains deferred pending supervisor decision.

Remaining physical acceptance, in a later authorized task: native app Home cold launch; rapid repeated Start; direct `/offline` and legacy entry; idle Home/Back removal; blocked exits during countdown/recording/preview/processing/cleanup failure and return after settlement; one authorized 10–15-second engineering walk with explicit setup; Airplane-mode processing/save/History/saved analysis and close/reopen. Phone + engineering recording required; Firebase/internet/research dataset/supervisor approval are not required for ordinary Phase 1 acceptance. A source checkpoint does not alter the previously accepted binary or replace device evidence.

All phases preserve unrelated work, use selective edits/staging only when separately authorized, and retain existing scientific contracts. No phase requests research recordings by default. “Phone” means required for acceptance; most authoring/unit checks can occur before a phone is connected. “Internet” concerns development/configuration/acceptance, not a new dependency for local gait use.

| Phase / likely files | Reuse and risk | Required automated checks | Phone / internet / Firebase | Engineering video / dataset / supervisor |
| --- | --- | --- | --- | --- |
| 1. Navigation shell + Home: `src/app/index.android.tsx`, Android Home component, carefully scoped native layout/route wrapper, theme primitives | Existing `/offline` and OfflineCapture unchanged; medium risk from Back/route lifetime. No account placeholder. | Typecheck, full frontend regression suite, meaningful Home->single-capture->Home/back/deep-link tests and old-route compatibility checks. | Phone: yes for route/camera/offline acceptance; internet: dependency acquisition only if needed, not runtime; Firebase: no. | One fresh self/authorized engineering walk for regression, no dataset or supervisor approval for shell. |
| 2. Real Firebase: `src/auth/*`, auth Android routes, account controls, `package.json`/lock/app config, dedicated Google bridge if needed, privacy plugin/build verification scripts | Preserve native gait/store code; high integration/security risk. Enable INTERNET only for identity boundary; basic reset/verify/sign-out/delete/linking complete here. | Auth state/route/error races, emulator supported flows, credential hygiene, existing frontend/native regressions; revised manifest checks. | Phone: yes; internet: yes for setup/first login/email/provider acceptance; Firebase: real configured project required. | Engineering walk and offline saved reload; no dataset. Owner setup needed, study approval not required. |
| 3. Acknowledgement + manual: first-use routes/content, local preference adapter, Help | Keep capture consent boolean/version compatibility; low-medium risk from version/storage failures. | Per-UID/version/Skip/decline/replay and offline bundled-content tests; regression suite. | Phone: yes for UX/accessibility; internet: only dependencies, not use; Firebase: existing Phase 2 session for integrated checks. | Video/dataset: no. Supervisor for formal study material only, which is excluded. |
| 4. Extract Setup: setup screen and minimal measurement-scoped controller boundary | Reuse frozen setup binding and controls; medium-high lifecycle risk. Preserve optional unknown assertions. | All side/direction/upright combinations, immutable countdown snapshot, stale-control mutations, resets and notice gates. | Phone: yes; internet: no after auth; Firebase: established session only. | Engineering video: yes; dataset/supervisor: no for engineering regression. |
| 5. Extract Camera + Processing: measurement layout/controller, camera/review/processing screens | Reuse capture handlers, framing, VideoView, native bridge/progress/cancel/cleanup; high risk from unmount/cancellation. | Record/countdown/preview/discard/cancel/background/unmount/cleanup-failure and single-controller/navigation tests; existing native checks. | Phone: essential; internet: no after auth; Firebase: restored session. | Authorized engineering recording: yes; no research dataset. |
| 6. Dedicated Result: Result route, shared result renderer | Existing saved pipeline is source of truth; medium race/presentation risk. | Loading/partial/unavailable/failure/zero-vs-null, metadata-v1/v2 conflicts, continuity and terminology suites; save-ID navigation. | Phone: yes; internet: no; Firebase: restored session. | Engineering save: yes; dataset/supervisor: no unless changing scientific claims, which is excluded. |
| 7. History + Saved Result: Android History/report aliases, repository adapter and main tabs | Existing list/read/delete/loader and latest-100 contract; medium race/deletion risk. | Move redirect-specific test expectations; selection generations, deletion during reads, focus/background, unavailable old IDs and offline reopening. | Phone: yes; internet: no; Firebase: restored session. | Saved engineering sessions sufficient; no new dataset. |
| 8. Profile/Settings polish: settings/profile/local-data/about screens | Extend Phase 2 working lifecycle controls; medium destructive-action clarity/shared-device risk. | Account vs local deletion, declined confirms, partial cleanup failure, provider linking, cache clearing and offline sign-out. | Phone: yes; internet: yes for account deletion/linking, no for local data; Firebase: yes. | Video/dataset: no new recordings needed; supervisor only for study-specific text. |
| 9. Design-system/accessibility polish: tokens/shared controls/screen styles | Reuse completed flows; medium layout/accessibility risk. | Typecheck/regressions and meaningful accessibility/state checks; contrast/layout review. | Phone: yes for TalkBack/font scales/keyboard; internet: no for local acceptance; Firebase: test account for route coverage. | Engineering clips only if capture layout changed; dataset/supervisor: no. |
| 10. Final regression/device acceptance: tests and dated evidence documentation | Entire accepted engine and new identity shell; high completion risk until physical checks pass. | Full frontend suite, required native quality/setup/metadata tests, auth/emulator coverage and final APK manifest/model checks. | Primary phone required; second supported phone recommended; online auth then Airplane-mode relaunch/process death/reboot essential; Firebase: yes. | Self/authorized engineering walks, no research dataset; supervisor for any study/clinical claim, not ordinary regression. |

Dependencies: 4->5->6 for active measurement ownership; 7 reuses 6; 8 reuses working lifecycle from 2. Main tabs become real as destinations arrive. Each phase is separately reviewable and must pass its own device gate before calling the affected workflow accepted. Avoid a giant route reorganization commit and do not preempt unrelated ML/research changes.

Planning estimate for one developer familiar with the repo: approximately **30–45 focused engineering days (6–9 working weeks)** for all ten phases, including authentication integration and device regressions. Phase 1 approximately 2–3 days including acceptance; Phase 2 approximately 5–8 days depending on provider/configuration and SDK compatibility. These are effort ranges, not a measured completion percentage or delivery promise. Owner setup delays, unavailable devices, additional account-isolation requirements and institutional review can extend calendar time. ML validation and participant study work are separate and not included.

## 16. Firebase owner / manual setup requirements

Owner actions for Phase 2, not this task:

1. Create/select an actual Firebase project and approve owner/access roles and privacy/contact information. Start with no-cost Spark if sufficient. Do not create participant identities or upload datasets.
2. Register the Android app with the existing `com.gaitsense.research` application ID. Preserve package/signing identity so update installs keep the existing app sandbox/SQLite. Uninstall/reinstall is not a safe data-preserving migration strategy.
3. Generate/read actual debug, approved release and, if distributing through Play, Play App Signing certificate fingerprints. Register required SHA-1/SHA-256 values; never fabricate them or share private keystores. Test the fingerprints for the actual installed acceptance build.
4. Enable Google and Email/Password providers; configure project/support email, password policy, abuse controls/email-enumeration protection and email templates. Phone/SMS remains disabled. Verify real reset/verification mail delivery.
5. Review Google OAuth branding/consent/project audience and testing/production status. Configure the required Android identity and Web/server OAuth client for Google ID credential audience; add test users only if the actual project's status requires them. Check Play Services/device requirements in the acceptance environment.
6. Download official, updated `google-services.json` after provider/fingerprint configuration. Supply it privately through the approved build configuration path. No placeholder project ID, app ID, API key or client ID. Check config belongs to the approved package/project.
7. Configure supported Expo/native Firebase plugins/Gradle wiring in the separate task and rebuild the native app under the established safe build workflow. Inspect native generation before applying it; do not blindly run clean regeneration over local files. Keep model packaging and existing native module intact.
8. Adjust the release privacy plugin to permit INTERNET for actual Auth. Update [native input checks](../../frontend/scripts/check-offline-native.mjs), [APK checks](../../frontend/scripts/verify-android-apk.ps1) and privacy documentation: old “no INTERNET permission” acceptance is intentionally superseded, while no microphone/broad storage, backup disabled and no gait upload remain. Verify the merged release manifest and actual offline pipeline, not just app.json.
9. Use project-owner test accounts for Google/email/link/reset/delete acceptance. No service-account key is required in the mobile app. Do not connect production tests to real participant records.

Firebase project IDs, app IDs, OAuth client IDs and Firebase client API keys/configuration are shipped application identifiers, not administrative secrets. API keys do not themselves authorize access to protected data; apply appropriate API/application restrictions and quotas without breaking Auth. Actual tokens, passwords, private signing keys and service-account credentials are secrets. Never commit them. Keep official client config local/build-managed initially; any future repository inclusion must be deliberate and reviewed. [Firebase API-key guidance](https://firebase.google.com/docs/projects/api-keys).

This task creates no Firebase console resources/configuration, signing material, SDK dependencies or APK.

## 17. Cost considerations

Expected initial authentication infrastructure cost: **US$0/month** for a small thesis population using Google and password Auth within applicable no-cost quotas. Firebase lists other/non-phone authentication as no-cost; this is a planning expectation, not unlimited service or a guarantee for an unspecified project configuration. [Firebase pricing](https://firebase.google.com/pricing).

Do not enable phone/SMS, paid custom backend, Cloud Functions, cloud video storage, gait databases or unnecessary hosted compute. No Firestore means no profile database read/write costs. Prefer local Android builds; paid build-service plans and distribution expenses are separate choices, not required Auth costs.

Current documented Spark email quotas include 1,000 verification emails/day and 150 password-reset emails/day. With Identity Platform on Spark, documented Tier-1 limits include 3,000 daily active users; paid Identity Platform configurations have different MAU pricing. Recheck actual console plan/quotas before implementation or scale-up. Handle throttling as recoverable account-operation failure, never a local gait lock. [Firebase Auth limits](https://firebase.google.com/docs/auth/limits).

Later costs could arise from Identity Platform upgrades/scale, SMS, Firestore writes/listeners, storage/egress, Functions, paid hosting or hosted builds. Do not enable billing silently. If later Blaze is chosen, use budgets/alerts and service quotas; alerts are not guaranteed hard spending caps.

## 18. Security / privacy boundaries

- Authentication identity stays with Firebase/provider SDKs; gait data stays in the app sandbox/local SQLite. Do not add a custom token/password store or treat UID alone as server authentication.
- Auth necessarily sends identity-related data/network traffic to Firebase/Google. Update app privacy wording: “gait processed locally” remains accurate, but “the entire app has no network/account” no longer does. Consent to Auth is not consent to gait upload or a university study.
- Preserve current disabled backup and no audio/broad-media/storage permissions. SQLite is not claimed to be independently encrypted; route guards do not protect a rooted/unlocked device or provide separate account vaults. Explain device-wide History without inventing security guarantees.
- No raw video retention promise beyond actual cleanup behavior. Native removes source before successful save; force-close can leave cache and cleanup failure must be visible. Keep leftover cleanup. Authentication should not change these rules.
- Sign-out/deletion invalidate result bindings and in-memory frames to prevent late reads leaking into another UI identity. They do not automatically erase committed sessions. Guard database deletion during active work and clearly confirm its device-wide scope.
- Error logs must redact email/credential/token material where unnecessary. No automatic participant/session attachments, remote logging, analytics or crash-upload SDK adoption in this milestone.
- Approved project access/configuration and provider-specific recent-login checks protect account operations. Offline local use cannot provide instantaneous server-revocation enforcement; this is an explicit product tradeoff.
- Provider linking proves both accounts and maintains UID. If two existing UIDs collide, stop at a safe recovery flow; automatic account/data merging is outside scope.
- Future cloud sync, stronger local account isolation, formal study consent or revised scientific metrics require separate architecture, approvals where applicable, and tests. App and scientific evaluation remain equally important deliverables.

## 19. Success criteria

The eventual professional app milestone is complete only after evidence demonstrates:

- Real Google and email/password authentication, registration, reset and appropriate verification guidance; no fake/demo credentials.
- Native session persistence through normal reopen, process restart and phone reboot; returning restored users skip Welcome and do not require a network check.
- Prior-authenticated Airplane-mode launch supports Home, record/process/save, History, current/saved Result, local deletion and cleanup. Day-30 behavior has no app-imposed expiry; extended-token conditions are additionally tested without claiming offline server validation.
- Separate Home, Setup, Camera/review, Processing, Result, History, Saved Result, Help/onboarding and Profile/Settings/About responsibilities with accessible navigation/back behavior.
- Sign-out, remote account deletion/reauthentication and safe provider linking work; account action failure does not corrupt local measurements; retained/deleted local-data outcomes are explicit.
- App acknowledgement is durable/versioned and distinct from university consent; no final study language invented or participants collected as part of frontend acceptance.
- Latest-100 History limitations, saved loading/ready/partial/unavailable/failed states, metadata-v1/v2 compatibility, conflicts, checked continuity and null values remain truthful.
- Full required-joint gate (>=70%, visibility/presence >=0.6, normalized bounds and selected joints), 33 landmarks, local native processing, SQLite transactions, cleanup/recovery and offline reopened analysis retain accepted behavior.
- Exact scientific labels remain projected 2D knee flexion, candidate ankle-motion extrema and candidate-to-candidate temporal intervals. Requested Android timestamps are not actual decoded-frame PTS. Status remains NOT_EVALUATED; no diagnosis/treatment/fall-risk/medical-accuracy claims.
- Normal UI is concise, with material limitations visible and detailed diagnostics still locally accessible. No score/exercise/showcase results leak into Android.
- Final merged permissions/config/model packaging, full automated regressions and dated real-device online/offline acceptance pass. Polished screenshots or mocked Auth do not substitute for these gates.

Completion of this document satisfies planning only; none of these new product capabilities is marked implemented by this task.

## 20. Recommended FIRST implementation slice

**One bounded task: Android navigation shell + professional Home, with Start Gait Measurement opening the existing `/offline` workflow.** The source audit supports this choice: Router already exists and the entire accepted capture route can remain in place.

Scope:

1. Replace the Android entry redirect with a real Home route/component, using a small set of reusable theme/button/card primitives and accurate non-diagnostic/local-storage copy.
2. Add one primary Start Gait Measurement action which pushes the existing `/offline` route once. Keep OfflineCapture's recording/processing handlers, native bridge, analysis contracts, SQLite schema and per-recording notice behavior intact; allow the minimal read-only header safety seam described in the checkpoint above.
3. Provide an explicit return-to-Home header and Android Back handling, available only at safe idle. Guard pops/replacements using current capture refs; during an active or retained attempt explain how to cancel/stop/discard or finish cleanup through the existing controls. Do not offer an unconditional confirmed exit during processing or retained cleanup failure. Idle exit removes/unmounts capture; never push Home over a still-mounted camera. Prevent duplicate pushes and use one singular workspace route.
4. Keep History/results available in the existing workspace for this transitional slice and label that availability honestly. Do not invent dedicated History/Settings destinations, fake account status or nonfunctional buttons. Add main tabs later as real screens arrive.
5. Preserve web variants and old Android route compatibility; direct `/offline` entry remains supported before Phase 2 protection. No new auth gate in this slice. After Phase 2, all legacy entry aliases must pass real guards.

Likely edits: `src/app/index.android.tsx`, a new Android Home component, an Android-scoped route wrapper/header and, only if necessary, the native root layout; limited reusable tokens/components. Any platform-specific route variant must be checked against existing generic route resolution. Add route/Back tests and rerun current frontend suite/typecheck. Do not edit unrelated research files or native code. If existing cleanup is insufficient under navigation testing, address that as an explicitly scoped lifecycle fix with preservation tests before claiming acceptance, not an opportunistic engine rewrite.

| Requirement | First-slice answer |
| --- | --- |
| Android phone | Not required to author the shell; required to accept camera/Back/cancel/offline reopen behavior on the actual app. |
| Internet | Not required for runtime acceptance; only if development dependency/docs acquisition needs it. |
| Firebase project | No. Real authentication is Phase 2, not a placeholder in Phase 1. |
| Engineering video | One self-recorded or already authorized 10–15-second side-view engineering walk for regression; no upload/commit. No clip is needed for this planning task. |
| Research dataset | No. |
| Supervisor approval | No for shell engineering. Approved study consent/participant recruitment/scientific validation remain separate. |

Acceptance: Home cold start; one capture owner; countdown/record/preview/process without route-induced cancellation; idle-only exit and guarded active attempts/cleanup; saved output/History after offline close/reopen; no fake auth/results; no scientific/native/storage change. This slice is visible progress but not completion of the full professional app milestone.

### Planning-task verification record (historical, before Phase 1)

The preceding planning task left only this new plan as its own edit, unstaged/uncommitted/unpushed. Pre-existing changes included `docs/CURRENT_STATE.md`, the PoC README/common script, PoC reproducibility/metadata/tests additions and a native ShortInterval instrumentation addition; Phase 1 also preserves them byte-for-byte.

Verification passed: `git diff --check` reported no whitespace errors (only existing LF/CRLF conversion warnings in unrelated PoC files). The untracked plan was checked separately because ordinary git diff excludes it: no trailing whitespace/tabs; all 32 relative Markdown links resolve; all 20 required numbered sections are present. SHA-256 comparison of 341 pre-existing tracked/nonignored untracked files found zero changes; the plan is the only added file from this task. Branch remains `main`, HEAD remains the baseline above, and the index has no staged changes. Nothing was committed or pushed. External technical guidance was read from official Expo/Firebase and library-maintainer documentation on 9 October 2026; recheck changing provider/SDK/cost details in Phase 2.

No production frontend, Android/native code, scientific logic, configuration or dependencies are changed by this planning task. No Firebase identifiers fabricated, fake authentication implemented, APK built or formal research-consent text authored. Runtime/typecheck/native tests are not claimed as rerun for a documentation-only change. Device acceptance and actual auth persistence remain future implementation gates.
