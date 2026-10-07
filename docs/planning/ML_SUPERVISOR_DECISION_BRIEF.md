# GaitSense — Supervisor Decision Brief

Sprint 6 Task 2 · 8 October 2026 · **Review draft, not research-collection authorization.**

Task configuration: GPT-6.1 Sol; High reasoning effort. This documentation task requires no phone, engineering video or research dataset. Scientific status: **NOT_EVALUATED**. All decision boxes below are unanswered.

## Project objective and current evidence

GaitSense must deliver **both a reliable offline smartphone gait-analysis application and a scientifically evaluated ML component operating inside that application**. Neither track is secondary; the app is a complete product with capture, processing, understandable results, reliable History and safe failure handling.

Current pose inference uses pretrained MediaPipe. Projected knee geometry, candidate motion extrema and candidate intervals are deterministic analyses. Downstream training source exists for Random Forest classification and linear, Random Forest and shallow MLP speed regression. Historical regression fits use inadequate estimated labels and a tiny cohort; they establish exploration, not scientific performance. No clinical diagnosis, disease, fall-risk or treatment claim is supported. Evidence and detailed experiments: [Sprint 6 audit](ML_THESIS_READINESS_AND_EXPERIMENT_PLAN.md).

## Proposed primary ML task

Recommend **trial-average walking-speed regression for previously unseen participants**:

| Item | Proposal requiring confirmation |
| --- | --- |
| Input | Side-view smartphone pose sequence or independently specified derived pose features |
| Output | Predicted walking speed in m/s |
| Reference | Independently measured course distance / independently measured crossing duration |
| Primary evaluation | Participant-separated generalization; participant-balanced MAE plus error distributions, uncertainty, reference yield and model coverage |
| Integration | Selected model, preprocessing and feature contract run in the offline app, with Python/mobile prediction parity and device acceptance |

Reference timing must use a qualified decoded-frame PTS/timebase or another independently approved timing route. Android requested sample timestamps and guessed legacy speeds are not reference labels. Reference distance/time cannot be fed back as predictors. Uncalibrated pose-based prediction is empirical within the studied capture domain, not direct recovery of metric distance. See [reference SOP draft](WALKING_SPEED_REFERENCE_SOP_DRAFT.md).

## Scalable benchmark and dataset proposal

Core learned families: **linear/Ridge/Elastic Net; k-NN regression; SVR; Random Forest regression; Gradient Boosted Trees; shallow MLP**. Include a training-only constant mean/median comparator. Conditional temporal candidates: compact 1D CNN, TCN, GRU, LSTM and small Transformer-style temporal encoder, selected for a testable hypothesis and available data.

**Model count is unconfirmed. A requirement around 10 is hearsay pending panel confirmation.** Seeds, widths and hyperparameters do not automatically count as distinct families. Do not add classification models to continuous regression merely to increase the count. Pose-backbone comparison is a separate scope decision; pretrained backbone use alone is not evidence of newly trained downstream ML.

| Stage | Participant planning range | Repeated-trial proposal |
| --- | --- | --- |
| Protocol pilot | 8–12 | 4–6 total trials/person, one session |
| Stronger thesis aim | 40–60 | 6–10 total trials/person, 1–2 sessions where feasible |
| Expansion | 80–120+ if feasible | 8–12 total trials/person, repeat sessions/device strata |

These are **planning ranges, not guarantees, power calculations or approved recruitment targets**. Final size/trials depend on reference uncertainty, diversity, failure rate, workload and timeline. Frames/windows are correlated observations, not independent participants. Main collection follows an approved pilot and frozen protocol; this brief authorizes neither.

## Parallel App + ML Completion Strategy

Both tracks continue in parallel with explicit owners and shared integration gates.

| Application milestones | ML/thesis milestones |
| --- | --- |
| Newest APK physical acceptance; multi-device engineering tests | Approved question, reference SOP and governance |
| Capture, persistence/restart/offline regressions; saved-analysis correctness | Approved pilot, reviewed larger cohort and participant grouping |
| Error cleanup, robustness, understandable UX and accessibility | Versioned preprocessing, model benchmark and held-out evaluation |
| Selected-model integration and Python/app inference parity | Learning curves, robustness/ablations and novelty verification |
| Runtime/thermal/memory tests; release/demo readiness | Reproducibility, limitations and final thesis evidence |

The newest Sprint 5 APK still requires a phone for physical acceptance. Test the existing local release at `frontend/android/app/build/outputs/apk/release/app-release.apk` (generated artifact, excluded from this source checkpoint), built from `f99c95d807c6d16c7a0223ca5451077427160197`, with SHA-256 `ea14cded9e2cb6490f878f9cb7f4b857b649899e2bb2e495d0bcc0498b729519`; package `com.gaitsense.research`; signing-certificate SHA-256 `fac61745dc0903786fb9ede62a962b399f7348f0bb6f899b8332667591033b9c`. Identity comes from the handoff; no rebuild is proposed.

Install/update that exact APK; record **one fresh engineering smoke-test walk** with explicit image-x direction and upright-image confirmation; process/save, reopen History, inspect projected knee analysis, candidate extrema and candidate temporal intervals, then verify offline persistence/reopen. **This recording is not research data.** Earlier-device results do not establish acceptance of the newest setup/continuity work.

## Biggest deferral risks

| Severity | Risks requiring tracked mitigation |
| --- | --- |
| CRITICAL | Dataset size; participant count/diversity; weak/estimated labels; leakage; ethics/consent/retention readiness |
| HIGH | ML contribution clarity; model-comparison scope; novelty evidence; reproducibility; imbalance between app and ML progress |
| HIGH — separate app risk | **APP QUALITY IS A SEPARATE DEFERRAL RISK:** crashes, broken persistence, incorrect saved analysis, inconsistent phone behavior, inaccessible/confusing UI, or the selected ML model failing inside the app |

App reliability cannot be substituted with a good research score; ML validity cannot be substituted with a polished demo. [A-01–A-05](approvals.json) remain pending. Authentic institutional decisions, consent, retention/access responsibilities and stable capture/reference evidence are prerequisites to research recruitment.

## Conflicts requiring explicit resolution

No older document is amended by this brief. The user's current two-track strategy governs this task; older audit prioritization must not imply that application engineering is optional.

| Older state → newer proposal | Decision owner | Resolve by |
| --- | --- | --- |
| [Study draft](STUDY_PROTOCOL.md): 15–30 people, 3–5 trials → larger ranges/repeat sessions above | Supervisor/research lead; statistical advice | Cohort review before pilot; main target frozen after pilot |
| Step count/cadence first; speed exploratory → speed as primary learned endpoint; measurement validation continues | Supervisor/panel | Before protocol/labels are frozen |
| Landscape 1080p/30 FPS → [knee draft](KNEE_FLEXION_VALIDATION_PROTOCOL.md) portrait/720p and current app variant | Supervisor + engineering lead | Before pilot; verify actual capture properties |
| Ordinary deletion after extraction → consented research evidence needed for blinded annotation/replay | Institution/data steward + supervisor/engineering lead | Before any research capture |
| Strict accepted-clip [v1 contract](DATASET_CONTRACT.md)/[checker](../../research/study/check.py) → [V2 proposal](RESEARCH_MANIFEST_V2_PROPOSAL.md) with sessions/attempts/failures | Data steward + schema/ML owner | Reviewed separate implementation before research intake |
| Nominal/requested-clock outputs → qualified independent reference timebase | Reference reviewer + engineering lead/supervisor | Synthetic qualification before pilot; policy frozen before main collection |
| Knee/motion-specific 3-person pilot/10-person evaluation → speed pilot/cohort ranges | Supervisor/reference lead | Keep endpoints separate; do not transfer their thresholds/sample counts |

The [exact-image workflow](EXACT_FRAME_EVIDENCE_WORKFLOW.md) and [motion-reference draft](CANDIDATE_MOTION_REFERENCE_VERIFICATION.md) address different endpoints. Their sampled-extremum clock cannot label physical walking speed. The older 30-day raw/12-month numerical retention proposals remain unapproved; no retention period or public dataset is selected here.

## Immediate decisions checklist — take to the supervisor

Record decisions as proposed/accepted/revise/defer with a date and private decision reference; unchecked boxes are not approval. Meeting date: ______. Decision-record reference: ______.

- [ ] **1. Primary task:** approve speed regression? □ approve □ revise □ defer; alternative/scope: ______.
- [ ] **2. Minimum models:** does the panel require a minimum? □ yes □ no □ pending; number, if confirmed: ______.
- [ ] **3. Counting rule:** what counts as a distinct model/family? Constant/backbone/variant treatment: ______.
- [ ] **4. Comparison track:** □ downstream ML □ pose backbones □ both □ pending; required scope: ______.
- [ ] **5. Temporal/deep models:** □ required □ optional □ pending; justified families: ______.
- [ ] **6. Pilot:** are 8–12 people/repeated trials feasible? Approved/revised size and readiness gates: ______.
- [ ] **7. Main cohort:** realistic participant/diversity target, sessions and total trials/person: ______.
- [ ] **8. Devices:** is cross-device scientific testing required? Required device classes and resources: ______; multi-device app testing also remains a tracked milestone.
- [ ] **9. Public data:** □ investigate □ not planned □ pending; no suitability/licence assumed: ______.
- [ ] **10. Institutional route:** applicable determination, consent language, retention/deletion/withdrawal/access policy: ______.
- [ ] **11. Timeline:** expected defense date and intermediate app/ML checkpoints: ______.
- [ ] **12. Accountability:** research-data approval owner and decision authority; named app/ML/data/reference responsibilities: ______.
- [ ] **Reference details:** timed-zone distance, crossing landmark/rule, timing technology, observer disagreement/adjudication/readiness rules: ______.
- [ ] **Capture/evidence decisions:** primary variant, research retention route, V2 migration and frozen test allocation: ______.

The responsible people and institution supply these answers. Until resolved, collection remains blocked; scientific status remains **NOT_EVALUATED**.
