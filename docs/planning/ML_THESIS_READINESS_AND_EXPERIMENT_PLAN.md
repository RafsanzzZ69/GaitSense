# GaitSense ML/thesis readiness and experiment plan

Sprint 6 Task 1 — audit and proposed roadmap, 8 October 2026 (Asia/Dhaka).

**Scientific status: NOT_EVALUATED.** Engineering acceptance, synthetic numerical tests and historical exploratory fits are not scientific validation. No clinical diagnosis, disease classification, health score, fall-risk or treatment claim is supported.

GaitSense has **two equally required tracks**: a reliable real offline application and scientifically defensible ML operating within it. Neither is secondary. Application capture, History/restart/offline reliability, saved-analysis correctness, failure handling, UX/accessibility, device testing, model integration/parity and runtime/release readiness continue alongside the research phases. A polished app cannot substitute for ML validation, and good ML results cannot substitute for app reliability. The [supervisor decision brief](ML_SUPERVISOR_DECISION_BRIEF.md) carries the parallel milestones and unresolved decision owners.

Task configuration: requested default model **GPT-6.1 Sol**, reasoning effort **High** for research/architecture analysis. This audit requires **no phone, no video and no research dataset**. No training, collection, production-code change, APK build, staging, commit or push is part of this task.

Audit baseline: local `HEAD` and local `origin/main` both resolve to `f99c95d807c6d16c7a0223ca5451077427160197` on `main`. The remote was not fetched during this audit. Existing uncommitted research reconciliation and documentation were inspected as working-tree evidence, not represented as committed baseline. This plan proposes decisions; it does not approve recruitment or amend approved requirements.

## 1. Current ML reality and repository evidence

### 1.1 Four different kinds of work

| Category | What actually exists | Honest thesis interpretation |
| --- | --- | --- |
| Pretrained pose-estimation inference | MediaPipe Pose Landmarker Full model, 33 normalized landmarks; Python PoC, Python backend and Kotlin Android inference | Uses an externally trained ML model. No evidence of GaitSense training or fine-tuning the pose backbone |
| Deterministic gait-analysis logic | Quality checks, Savitzky–Golay smoothing/peak finding in PoC; projected knee geometry, ankle-motion extrema, gap-aware same-polarity intervals in Android analysis | Feature engineering/measurement algorithms, not newly trained gait ML. Current Android extrema are candidates, not verified contacts; intervals are not validated step/stride times |
| Implemented downstream learned models | Random Forest condition-classification script; linear, Random Forest and shallow MLP walking-speed regression script, with historical regression artifacts | Actual training implementations exist. Historical regression fits are exploratory and scientifically inadequate; classifier training on valid labels is not established |
| Planned ML work | Broader benchmark, independent labels, larger cohort, grouped model selection, temporal models, export/runtime parity | Proposed work, not completed experiments or deployed trained gait inference |

MediaPipe's official documentation describes a body detector plus landmark model and Lite/Full/Heavy bundles. These are upstream pretrained models; the project currently selects Full. [Official Pose Landmarker guide](https://developers.google.com/edge/mediapipe/solutions/vision/pose_landmarker).

### 1.2 Evidence register

Paths below are relative to this document. Links identify the actual source for factual statements; private artifacts are described only in aggregate.

| ID | Repository evidence | Audited finding |
| --- | --- | --- |
| E01 | [PoC pose extraction](../../research/gaitsense_poc/scripts/02_pose_extraction.py) | MediaPipe Tasks VIDEO mode, Full `.task` asset, one pose, 0.5 detection/presence/tracking thresholds; sequential OpenCV decoding with timestamps calculated from frame number/nominal FPS |
| E02 | [Android native inference/storage](../../frontend/modules/gaitsense-pose/android/src/main/java/expo/modules/gaitsensepose/GaitSensePoseModule.kt), [native dependency](../../frontend/modules/gaitsense-pose/android/build.gradle), [asset preparation](../../frontend/scripts/prepare-pose-model.mjs) | `tasks-vision:0.10.32`; hash-verified Full asset; two-pose inference with 0.6 thresholds, requested 100 ms sampling via `OPTION_CLOSEST`; SQLite summary/frame transactions; no gait-model pickle/runtime inference here |
| E03 | [Backend pipeline](../../backend/app/pipeline.py) | MediaPipe inference plus deterministic view-sensitive measurements; nominal-FPS clock, different sampling/quality rules; walking speed explicitly unavailable without independent calibration or validated model |
| E04 | [Smoothing](../../research/gaitsense_poc/scripts/05_smoothing.py), [events](../../research/gaitsense_poc/scripts/06_gait_events.py), [features](../../research/gaitsense_poc/scripts/07_feature_extraction.py), [geometry helper](../../research/gaitsense_poc/scripts/common.py) | Deterministic interpolation/smoothing, ankle peak finding, cadence/timing/angle/arm/sway proxies. Historical PoC feature definitions differ from current backend/Android definitions |
| E05 | [Classifier trainer](../../research/gaitsense_poc/scripts/10_train_model.py) | `RandomForestClassifier`, 200 trees, balanced class weights; binary `condition == controlled_variation`; one `GroupShuffleSplit` by participant; accuracy, precision, recall, F1, confusion matrix and joblib artifact output |
| E06 | [Regression trainer](../../research/gaitsense_poc/scripts/12_train_regression.py) | `LinearRegression`, 300-tree `RandomForestRegressor`, `MLPRegressor(32,16)`; one participant-grouped 25% holdout, seed 42; training-fitted imputer/scaler pipelines; MAE/RMSE/R-squared outputs; estimated-label warning does not stop fitting |
| E07 | [Speed annotation tool](../../research/gaitsense_poc/scripts/measure_walking_speed.py) | Hard-coded 4 m and `(end_frame-start_frame)/fps`; saves chosen frame boundaries. Does not authenticate course length, marker visibility, decoder PTS, two observers or independent timing |
| E08 | [Historical research summary](../../research/gaitsense_poc/README.md); local provenance audit at `research/gaitsense_poc/VIDEO_AUDIT.md` and local uncommitted reconciliation at `research/gaitsense_poc/REPRODUCIBILITY.md` (neither included in this planning checkpoint) | Eight unique originals/four participants, eight aliases of the same files; five feature rows; front/side mix; unknown conditions; estimated speed labels; stale view/participant reports; separate one-row reference source |
| E09 | [Relative pattern indicator](../../research/gaitsense_poc/scripts/13_compute_pattern_index.py), [reference table preparation](../../research/gaitsense_poc/scripts/15_prepare_reference_gait_parameters.py) | Percentile-based indicator is deterministic and dataset-relative, not independent labels. Script names Kuopio/Health&Gait; source attribution, licence, measurement provenance and suitability are not verified by that name |
| E10 | [Session contract](../../frontend/src/offline/contract.ts), [metadata reader](../../frontend/src/offline/analysis-metadata.ts), [recording setup](../../frontend/src/offline/RECORDING_ANALYSIS_SETUP.md), [metadata persistence](../../frontend/src/offline/ANALYSIS_METADATA.md), [saved continuity audit](../../frontend/src/offline/SAVED_CONTINUITY.md) | Structured native inference geometry; metadata-v2 operator direction/upright assertions; conflicts retained. Direction source means an operator assertion, not an operator-person ID or authentication. Checked continuity concerns requested-clock usable observations only |
| E11 | [Knee engine](../../frontend/src/offline/knee-flexion.ts), [motion engine](../../frontend/src/offline/motion-candidates.ts), [interval engine](../../frontend/src/offline/motion-intervals.ts), [session wrapper](../../frontend/src/offline/session-analysis.ts), [saved adapter](../../frontend/src/offline/saved-payload-analysis.ts) | Deterministic analysis, exclusions/nulls/gaps, explicit `NOT_EVALUATED`; optional caller participant/attempt IDs remain nullable; saved native session UUID does not identify a participant |
| E12 | [Knee comparison](../../frontend/src/validation/knee-comparison.ts), [motion cohort](../../frontend/src/validation/motion-cohort.ts), [evidence package](../../frontend/src/validation/evidence-package.ts), [validation README](../../frontend/src/validation/README.md) | Synthetic-only comparison/provenance infrastructure, participant aggregation and cluster uncertainty; not a real-reference import/evaluation system. Dummy synthetic hashes are not file authentication |
| E13 | [Study draft](STUDY_PROTOCOL.md), [dataset contract](DATASET_CONTRACT.md), [consent draft](CONSENT_DRAFT.md), [approval register](approvals.json), [study checker](../../research/study/check.py), [architecture](ARCHITECTURE.md) | Existing 15–30-adult/3–5-trial feasibility proposal, independent marked-distance speed endpoint, grouped split rules and pending A-01 through A-05. Checker validates a narrow accepted-speed schema, not signatures or scientific validity |
| E14 | [Exact-image workflow](EXACT_FRAME_EVIDENCE_WORKFLOW.md), [knee protocol](KNEE_FLEXION_VALIDATION_PROTOCOL.md), [motion-reference protocol](CANDIDATE_MOTION_REFERENCE_VERIFICATION.md) | Planned real-image/reference routes and explicit unresolved PTS/authenticity boundaries; portrait/720p knee variant differs from broader landscape/1080p draft. Earlier source snapshots in these documents must not override Sprint 5 geometry/setup improvements |
| E15 | [Pipeline runner](../../research/gaitsense_poc/run_pipeline.py), [historical requirements](../../research/gaitsense_poc/requirements.txt), [data policy](../REPOSITORY_DATA_POLICY.md) | Runner includes training, so must not be run just to refresh metadata. Research dependencies are unpinned; imported output/default path mismatch; private data/artifacts excluded from Git |

### 1.3 Existing experiments, metrics and splits

The local ignored `research/gaitsense_poc/reports/` contains three walking-speed model `.pkl` files and `walking_speed_regression_report.json`. This audit read the text report and aggregated CSV metadata; **no pickle was loaded, model was executed, video was decoded or fit was reproduced**. Artifact presence plus the historical report establishes saved exploratory work, not an independently reproduced result.

| Historical report entry | MAE (m/s) | RMSE (m/s) | Interpretation |
| --- | ---: | ---: | --- |
| Linear baseline | 0.042319 | 0.042319 | One held-out recording; not evidence of a generalizable winner |
| Random Forest | 0.170642 | 0.170642 | Same weak label/test setup |
| Shallow MLP | 0.489824 | 0.489824 | Same weak label/test setup |

The report records three training participants, one test participant, prototype and estimated-label warnings, and undefined R-squared (`NaN`). The reconciliation documents one held-out recording. Equal MAE/RMSE is consistent with that one-observation evaluation. These figures may describe history with caveats; they must not be cited as thesis validation, clinical accuracy or a stable model ranking. The saved feature table currently has **five rows/four participants, all condition and view values `unknown`**. Reconciled metadata does not automatically repair old derived tables (E08).

Classifier source exists, but the current unknown conditions cannot establish a valid two-class experiment. Its expression converts every non-`controlled_variation` value, including `unknown`, to class 0. With the current table the two-class guard stops fitting; a later mixture could silently mislabel unknown records. No verified classifier comparison is claimed (E05).

Both training scripts implement a participant-grouped train/test split. **There is no implemented dedicated validation partition, nested grouped search or broad benchmark in these trainers.** Study contracts propose train/validation/test allocation; this is planned methodology, not proof that an approved partitioned dataset exists. No GaitSense pose-backbone training, fine-tuning, alternative-backbone benchmark, temporal deep model or exported downstream model integrated into the audited app/backend path was found in the source search (E01–E06, E11, E15).

### 1.4 Participant identity and immediate defects to address later

- PoC metadata has participant identifiers; a local reconciliation makes missing identity/condition/view `unknown`. That string passes ordinary `dropna`; unknown participants must be rejected from grouped scientific evaluation rather than pooled as a fictional person (E05, E06, E08).
- Native sessions persist UUIDs and setup provenance but no research participant/session-of-study/trial/attempt identity or independent labels. The adapter can accept caller IDs; that is not a durable research linkage (E02, E10, E11).
- Both trainers select columns using whole-table nonmissing fraction before splitting; move missingness-based feature selection into training folds. Regression imputation/scaling already fits on training data, which should be retained (E05, E06).
- Label warnings in regression do not enforce valid independent provenance. Require a reviewed label manifest, unique one-to-one video/target joins and accepted references before future fitting; keep rejected/uncertain trials in the ledger (E06, E07, E13).
- PoC peak detection derives an FPS default from `df.timestamp.diff().median()` over a landmark-row table. Multiple joints share timestamps, so this is not a reliable frame clock and can fall back to 30. It then treats peak-array indices as uniform samples despite possible missing observations. Audit on synthetic irregular/gap sequences before using those features (E04).
- PoC smoothing interpolates, event detection fills remaining missing values with a median, angles use normalized x/y without image-aspect correction, and feature duration spans observed timestamps rather than a reviewed straight-walking interval. These cannot be presented as equivalent to Android's gap-preserving projected geometry (E03, E04, E11).
- Study manifest v1 is deliberately strict and lacks session/device/setup/failure-ledger fields. Extend/version it in a future task; extra fields currently fail `check.py`. Do not silently edit the current contract or deem every field proposed below supported (E13).

## 2. Proposed primary ML research problem

### 2.1 Ranked formulations

| Rank | Formulation | Feasibility and decision |
| --- | --- | --- |
| 1 | **Predict trial-average walking speed from side-view smartphone pose sequences/features on unseen participants** | Recommend primary: continuous, independently labelable target; aligns with existing regression work and study draft; supports diverse tabular/temporal models and mobile deployment. Requires a measured course, reliable timing and qualified data pipeline |
| 2 | Detect visible gait events and estimate cadence against blinded video annotations | Natural app extension, but visible contacts/occlusion and unknown actual PTS make physical event timing harder. Keep secondary; candidate-extremum verification is not contact detection |
| 3 | Compare pose backbones for projected landmark/angle error and downstream speed prediction | Useful supporting experiment if supervisor wants it. Needs matched images/common joints and budget; using pretrained backbones alone may leave downstream ML contribution weak |
| 4 | Classify capture usability/quality against a reviewed annotation rubric | Non-clinical fallback/secondary target. Objective rubric possible, but predicts recording quality rather than gait; do not equate it with gait health |
| 5 | Temporal gait-pattern/pace classification | Needs justified non-clinical labels and safe conditions; pace instruction is not measured speed. Binning regression labels can be secondary, not an independent contribution by itself |
| Defer | Disease diagnosis, fall risk, normal/abnormal health classification | No appropriate cohort, labels, validation or approvals; outside current study |

### 2.2 Precise question and endpoint

**Question:** For consenting independently walking adults under an approved stationary side-view RGB protocol, how well can learned models predict average straight-zone walking speed for previously unseen participants, relative to simple training-only baselines, and how do temporal context, pose normalization and quality handling affect error, coverage and mobile cost?

One supervised observation is one independently labeled walking trial/video, not one frame. Input is a versioned pose sequence, confidence/missingness mask, time semantics and geometry/setup metadata, or prespecified aggregate features from that sequence. Output is one scalar predicted speed in **m/s**. Target is `measured_distance_m / independently_annotated_crossing_duration_seconds`. Primary endpoint is participant-balanced trial MAE; report coverage and secondary errors alongside it.

The deployed predictor must not receive reference crossing times, reference elapsed duration, manually counted reference steps, speed target or pattern-index-derived targets as input. Never train a model simply to rediscover `distance/time` from the same provided reference values. Independently measured speed is a label, not a pose feature. Participant IDs, filenames, reviewer IDs and consent codes are grouping/provenance, not predictors.

Use a fixed-length, protocol-selected straight-walking pose window inside the timed zone, with enough usable motion; keep the rule independent of measured speed. Predict its trial's zone-average speed only if pilot review establishes that the window represents the same steady walk. Do not stretch every trial to one normalized cycle duration and thereby remove the timing information needed for speed. Avoid a target-dependent window length that exposes crossing duration. Retain full-source reference evidence privately under consent; fixed recording duration includes lead-in/out and is not the target duration.

Uncalibrated monocular scale remains ambiguous: this is **empirical speed prediction within the studied domain**, not direct recovery of metric distance. A separate prespecified variant may include independently measured participant height or camera calibration, with an explicit extra-input requirement and a pose-only comparator. Do not assume these metadata are currently available or necessary. If independent speed labels cannot be established, pause this formulation and agree a narrower non-clinical target; do not substitute guessed speed or fabricated diagnoses.

Provisional hypotheses: normalized features improve camera-distance robustness; compact nonlinear models can improve on a regularized linear baseline; temporal context may help only with sufficient independent participants; filtering may reduce conditional error while reducing coverage. All are questions to test, not expected results to report.

## 3. Scalable model-family benchmark

**Final model count and whether the panel counts pose estimators, downstream models or both: supervisor/panel confirmation pending. Exactly 10 is not established.** Compare task-matched regressors for the primary target; Logistic Regression is a classifier and does not belong in a continuous-speed regression table merely to increase the count.

Representation `F`: a small, audited aggregate feature vector from an identical pose extractor, with training-fold imputation/scaling where needed. Representation `S`: fixed-window normalized joint positions/angles/velocities plus time and quality masks; gaps must be explicit. Every primary row below predicts trial speed in m/s. Qualitative capacity/data/device assessments are planning judgments to verify empirically, not measured GaitSense performance. Official implementations of the classical families are documented in the [scikit-learn supervised-learning guide](https://scikit-learn.org/stable/supervised_learning.html).

| Model/family | Status and role; why included | Input → output | Complexity / likely data need | Potential strength / weakness | On-device path |
| --- | --- | --- | --- | --- | --- |
| Training-only mean/median predictor | Proposed essential sanity baseline; tests whether learning adds value | No gait features → speed | Minimal; pilot diagnostic | Transparent lower bar / cannot adapt to trial motion | Trivial constant; not counted as a substantive learned family unless panel agrees |
| Linear regression; regularized Ridge/Elastic Net variant | Linear source/history exists; regularized variants proposed baseline and compact candidate | F → speed | Low; pilot exploratory, thesis cohort for claims | Interpretable, cheap / misses nonlinear relationships; collinearity | Coefficients plus preprocessing, parity test required |
| k-NN regression | Proposed locality baseline; asks whether similar motions suffice | Scaled F → speed | Low fitting cost; memory/query cost grows with examples; thesis cohort | Simple local comparison / distance sensitivity, storage and weak extrapolation | Possible but stores reference feature vectors; privacy/storage review |
| Support Vector Regression (linear/RBF) | Proposed margin/kernel baseline/candidate | Scaled F → speed | Moderate; thesis cohort; support-vector count controls runtime | Nonlinear small-vector alternative / tuning and scaling sensitivity | Custom/exported kernel runtime conditional on support-vector budget |
| Random Forest regression | Source/history exists; core nonlinear candidate | F → speed | Moderate ensemble; thesis cohort | Interactions, tabular baseline / large trees, poor extrapolation | Bounded tree evaluator/export; not the existing Python pickle |
| Gradient-boosted trees | Proposed strong tabular candidate; choose one implementation first, e.g. histogram boosting or XGBoost-style | F → speed | Moderate training/tuning; thesis cohort | Complementary boosting bias / overfit/tuning and export burden | Conditional on verified tree export; dependency/licence decision later |
| Shallow MLP regression | Source/history exists; compact learned nonlinear comparator | Scaled F → speed | Moderate; thesis cohort, regularization/seeds | Compact dense model / variance and scaling sensitivity | Dense inference feasible after weights/preprocessing parity |
| Compact 1D CNN | Proposed first temporal candidate if sequence labels/coverage support it | S → pooled speed | Moderate; stronger cohort; windows do not increase subject count | Learns local motion patterns / limited receptive field, missingness artifacts | Candidate mobile tensor runtime; validate supported operators |
| Temporal Convolutional Network (TCN) | Proposed conditional expansion; tests longer temporal context | S → pooled speed | Moderate–high; stronger/expanded cohort | Larger temporal receptive field / depth/context overfit | Conditional compact export; compare with 1D CNN fairly |
| GRU | Proposed conditional recurrent comparator | S → pooled speed | Moderate–high; stronger/expanded cohort | Stateful temporal representation / sequence/padding/optimization sensitivity | Conditional runtime/operator/export validation |
| LSTM | Proposed only if recurrent comparison is scientifically useful or panel scope demands it | S → pooled speed | Higher recurrent parameter/state budget at comparable width; expanded data preferred | Alternative memory mechanism / may add cost without benefit | Conditional export; choose GRU or LSTM first |
| Small Transformer-style temporal encoder | Proposed stretch; long-context test, not prestige model | S plus time/position/masks → speed | High relative tuning/data need; expanded cohort or approved pretraining | Flexible context / small-cohort overfit and mobile cost | Research benchmark first; mobile only after measured benefit |

Start with constant, linear/regularized, k-NN, SVR, Random Forest, boosted trees and shallow MLP: a useful baseline plus **six learned families**, not a mandatory count. Add a compact 1D CNN when the pilot supports sequences. If a larger count such as 10 is confirmed, agree counting rules and add justified TCN/GRU/LSTM/Transformer or a distinct uncertainty-oriented model with an explicit hypothesis. Hyperparameter settings, random seeds and several widths of one architecture are not independent model families. Do not add classifiers to a regression ranking or inflate the count with backbone variants.

For a separately approved classification endpoint, an appropriate parallel family set is majority baseline, Logistic Regression, SVM, Random Forest, boosted trees, k-NN, MLP and justified temporal classifiers, each with classification outputs and metrics. No such labels or experiment are accepted now.

### 3.1 Pose-backbone track, conditional on scope

| Backbone | Current status / role | Input and output | Burden, data and limitations | Mobile intention |
| --- | --- | --- | --- | --- |
| MediaPipe Full | Existing fixed upstream baseline | RGB → 33 landmarks/confidences | Freeze model hash/thresholds; independently labeled thesis cohort still needed for downstream evaluation | Already integrated |
| MediaPipe Lite / Heavy | Proposed capacity/cost comparison | Same broad task; verify exact schema and preprocessing | Extra extraction runs and paired references, not new participants; no assumed winner | Feasible candidate adapters, acceptance required |
| MoveNet Lightning / Thunder | Proposed alternative only if supervisor wants backbone comparison | RGB → 17 keypoints/scores | Common hip/knee/ankle subset possible; no equivalence to MediaPipe heel/foot/presence fields; own crop/orientation adapter and matched-image tests | Official mobile-oriented models, project integration not implemented |

The availability of MediaPipe variants is verified in the [official guide](https://developers.google.com/edge/mediapipe/solutions/vision/pose_landmarker). MoveNet's two variants and 17-keypoint output are documented in the [official tutorial](https://www.tensorflow.org/hub/tutorials/movenet). Suitability for GaitSense still requires a pilot, schema mapping and runtime evidence. Avoid a large pose-network training/rewrite track without time and reference capacity. First freeze one backbone for downstream comparisons; otherwise different preprocessing can confound model rankings. A paired backbone experiment should separate landmark error, downstream prediction and total compute.

### 3.2 Fair comparison and selection

Use identical participant splits, label version, eligible trials and aggregate feature definitions for tabular models; temporal models get the same trial labels and documented sequence input. Set comparable tuning budgets, record all attempted configurations, use validation for early stopping, and report several prespecified seeds for stochastic models. Do not cherry-pick the best seed. Compare conditional error and coverage on the full ledger and on a common supported subset so abstention cannot masquerade as superiority.

Select by prespecified participant-balanced error, acceptable coverage and measured size/latency limits. A simpler model with comparable uncertainty may be the deployment choice. No minimum performance or winning family is asserted before reference validation and pilot review.

## 4. Dataset design and reference protocol

### 4.1 Units and practical scale

Participant = independent person; session = recording visit/setup/date; trial = planned walking passage; attempt = actual take, including a failed/replacement take; video = captured file for an attempt; frame/window = correlated derived observation. A renamed file, overlay, mirrored augmentation or thousands of frames is not another independent participant.

The handoff estimates roughly 10–12 available engineering/test videos. The reconciled historical PoC cohort is specifically eight unique originals/four people, five feature rows (E08). These describe different scopes; a complete cross-folder authorized inventory is unresolved. Neither is an approved thesis dataset, and extra engineering footage must not be counted as independent research subjects without provenance/consent review.

All targets below are **planning ranges, not power calculations, guarantees or approved recruitment targets**. Final allocation depends on pilot reference uncertainty, observed between-person variance, failures, resources and supervisor/statistical review.

| Stage | Participant range | Session/trial structure | Illustrative planned video count | What it can support |
| --- | --- | --- | ---: | --- |
| Minimum approved protocol pilot | 8–12 new participants | 1 session, 4–6 trials/person | 32–72 before failures | Label feasibility, timing agreement, quality and burden; exploratory baselines, not final superiority claims |
| Stronger thesis aim | 40–60 participants | 1–2 sessions, 6–10 total trials/person; second visit on a subset or all if feasible | 240–600 | Grouped classical benchmark, cautious compact temporal study, useful held-out person sample and controlled robustness |
| Ideal/expanded study | 80–120+ participants | 2 sessions where feasible, 8–12 total trials/person, multiple setups/devices/sites | 640–1,440 for the stated 80–120 range | More robust learning curves/strata and temporal comparison; still not clinical validation |

The existing 15–30/3–5 draft was a feasibility proposal, not an approved final thesis cohort. This larger proposal must be reconciled with it under A-03. If 40–60 people are infeasible, narrow claims/model capacity and document precision; do not replace people with more frames. With ~50 participants, a possible frozen allocation is ~10–15 final test people and remaining development people in grouped CV; review sample adequacy before freezing. Very small held-out cohorts have wide/unstable uncertainty even when clips are numerous.

### 4.2 Capture variation without confounding

Use a manageable balanced/partially crossed design rather than every possible combination. Each participant should contribute both image-x directions and, when possible, repeats across selected conditions. Record the visible anatomical side independently; direction does not determine side. Randomize/counterbalance trial order and rest. Do not make one device/background/side identify a speed category or participant partition.

| Variation | Proposed control/record | Purpose and gate |
| --- | --- | --- |
| Participants/body sizes | Consenting adults across accessible height/body-size ranges; optional measured height only with reviewed need/consent | Evaluate scale sensitivity; avoid sensitive demographic inference from video |
| Sessions/repeats | Session IDs, date/setup codes, repeat comfortable trials; selected second visits | Separate person generalization from repeatability and day/setup change |
| Speed | Comfortable baseline; optional self-selected slower/faster comfortable walking only after protocol review | Independent continuous labels across safe range; instruction is not ground truth |
| Direction/side/view | Both image-x directions and left/right visible side, upright image check; primary side view | Generalization across setup; front/oblique views are separately labeled secondary/OOD tests, not silently pooled |
| Devices | Primary phone plus 1–2 additional accessible device classes; repeated trials on a paired subset | Device effects; record make/model/lens, OS, codec, actual frame dimensions/rate/timebase |
| Lighting/clothing/background | Even light for primary trials; ordinary varied clothing/backgrounds, controlled mild lighting variation if reviewed | Natural robustness; no deliberate privacy-compromising clothing or bystanders |
| Distance/framing | Stable perpendicular camera around hip height, full body through zone; measured camera height/distance and lens mode | Separate perspective/scale from person/target; comfortable safe framing variation |
| Occlusion | Record naturally occurring mild limb/self-occlusion, cropping and blur as failures/strata | Quantify coverage; no hazardous occlusion or balance challenges |
| Normal variability | Operator/setup code, orientation, compression, timestamp mode, blur/framing flags | Domain analysis and reproducibility rather than hidden exclusions |

Existing broader draft requests landscape 1080p/30 FPS, while the knee amendment proposes portrait/720p and current capture has a 720p request (E13, E14). Freeze one primary variant with verified actual output; document alternatives as distinct protocol versions. Do not describe nominal resolution/FPS or an upright checkbox as actual image/timing verification.

### 4.3 Labels/reference before recruitment

1. Physically measure the straight zone (e.g. reviewed 4 m design); record distance, instrument/verification and floor-marker layout. No assumed 4 m for legacy videos without visible/verified course evidence.
2. Define one crossing landmark/boundary convention, camera projection of marker lines and lead-in/out exclusion. Review whether the window is steady walking and representative of zone speed.
3. Two trained observers independently annotate start/end on original evidence, blinded to model outputs and each other. Retain both submissions, decoder frame/PTS or independently validated timebase, uncertainty, disagreements and adjudication. Record intra/inter-observer repeat checks on a blinded subset.
4. Pilot-test timing reliability using a qualified decoded-frame PTS/timebase or another independently approved timing route. Nominal frame/FPS arithmetic remains diagnostic and must not be presented as qualified PTS; without either qualified reference route, scientific timing labels remain unavailable. Freeze disagreement, uncertainty, exclusion and replacement rules before main study. No unreviewed timing tolerance is a clinical standard.
5. If markers/crossings are obscured or timing/distance uncertain, target is missing/excluded with a reason. Preserve attempt in coverage ledger; do not invent a label. Independent visible-event annotations are a separate label task and cannot use algorithm extrema as their own reference.

### 4.4 Research schema, consent and acquisition route

Future versioned private manifests need participant/session/trial/attempt IDs; planned/attempted/failure/replacement status; source hash and alias resolution; protocol/consent references; device/setup/side/direction/upright source; source and inference dimensions/transforms; frame-rate/timebase/PTS availability; reference observer submissions and uncertainty; label/feature/model/split versions; exclusions and retention/deletion receipts. Keep contact/consent linkage separately restricted. A source/image hash supports integrity checks but is not proof of consent or anatomical correctness.

Ordinary Android deletes raw video after processing and saves successful sessions only (E02, E10, E14). That cannot supply blinded retrospective annotation or a complete failure ledger. Before the pilot, choose a **separately authorized research acquisition/evidence route** with time-bounded consented source retention, authentic trial linkage and recorded failures. Options are a qualified research harness or a controlled desktop workflow whose differences from Android are explicit. Desktop results cannot be called Android-runtime validation without equivalence evidence. Existing synthetic-only validators must stay synthetic; a real-evidence adapter requires a separate reviewed contract.

Collection gate: reviewed protocol/labels/targets, institutional determination (approval or documented exemption), usable consent and withdrawal/retention schedule, named owners/access controls, reference readiness and stable capture/evidence route. A local app notice or possession of a video is not research consent. Draft 30-day raw/12-month numeric retention proposals in the existing contract are not activated policies. Finalize backup expiry, access/encryption and actual deadlines before recruitment. Include unsuccessful recordings in retention/deletion accounting.

### 4.5 Public datasets — future search, no suitability claim

No public dataset is selected or approved by this audit. The existing script's Kuopio/Health&Gait naming and one-row table are an unverified reference lead, not a validated augmentation source (E09). Create a separate literature/data-search task to verify official publication/repository, licence, permitted secondary use, access/ethics, RGB modality, side view, frame/timebase quality, independent speed/event labels, participant IDs, diversity and downloadable documentation. Motion-capture-only or silhouette/identity datasets cannot automatically become smartphone speed labels.

Possible roles after verification: separate external-domain testing, upstream pretraining, or additional training with explicit dataset provenance/domain balancing. Preserve public-source participant grouping and prevent duplicate people/content across all partitions. Do not merge feature tables with incompatible units or labels. External test data should remain separate if domain/label comparability is uncertain.

## 5. Leakage-prevention rules

Grouped splits and training-fitted transformations are supported by official guidance. [Cross-validation](https://scikit-learn.org/stable/modules/cross_validation.html), [data leakage and pipelines](https://scikit-learn.org/stable/common_pitfalls.html).

1. Freeze a pseudonymous participant split manifest before modeling. All sessions, repeats, attempts, frames, overlapping windows and augmentations from one person stay in that person's partition. Unknown participant identity blocks scientific use.
2. Resolve aliases, file hashes and known re-encodings/derived copies before allocation. Exact-hash deduplication alone does not catch transcoded copies. Never split original and skeleton overlay into separate observations.
3. Keep final held-out participants untouched during feature, hyperparameter, threshold, backbone and architecture choices. Pre-register any frozen all-model test comparison; it must not feed another round of selection. If inspected for tuning, retire that test version and obtain independent evaluation.
4. On development participants, use `GroupKFold` (e.g. 4–5 folds if cohort supports it); for approved classification, consider `StratifiedGroupKFold` only with adequate class-bearing groups. Tune inside grouped inner folds. If a separate holdout is infeasible, nested participant-grouped CV is the explicit alternative, not random-frame CV.
5. Fit imputation, scaling, missingness/variance selection, PCA, learned normalization, feature selection, percentile references, calibration and decision thresholds only on each training fold. Deterministic per-frame geometry transforms need no cohort fit but still require a frozen definition. Move current whole-table column selection into folds.
6. Oversampling/augmentation applies only after splitting training data. Record seeds and group lineage. Trial/window weighting must prevent people with many usable takes dominating training or evaluation.
7. No measured target arithmetic, adjudicated reference timing, participant IDs or label-correlated filenames as predictors. Freeze which deployment-available metadata are legitimate inputs.
8. Pilot participants used to design labels/thresholds do not join the final held-out test cohort. Predefine how approved pilot data may enter development training; do not reuse legacy engineering fixtures as final evaluation.

Random frame splitting places near-identical adjacent images, the same person's body/clothing and the same camera/background in train and test. A model can recognize person/recording patterns instead of generalizing to new people. Thousands of these correlated frames make an apparently precise high score misleading. Grouping clips alone is insufficient when repeated clips share a person. Device-held-out evaluation is additional to participant separation, not a substitute.

## 6. Evaluation metrics and reporting contract

Use task-appropriate error and classification definitions; accuracy is not a regression metric. Official metric definitions are available in the [scikit-learn evaluation guide](https://scikit-learn.org/stable/modules/model_evaluation.html). The aggregation and coverage rules below are proposed specifically for this study and must be frozen with the protocol.

### 6.1 Primary speed regression

For each evaluation participant, average absolute trial errors over valid reference/prediction pairs, then average those participant means equally. This is **participant-balanced MAE in m/s**, conditional on a valid pair. For participant-balanced RMSE, average squared errors within each person, average equally over people and take the square root. Do not average person RMSEs and call that the same statistic. If windows yield predictions, first aggregate by the frozen within-trial rule so many windows do not create more trial labels.

Report participant-balanced MAE/RMSE, signed bias, participant/trial distributions, weighted median and P95 absolute error, worst errors and prespecified speed strata. Define quantile weights as equal person weight, equal trial weight within person. Pooled trial metrics are supplementary and explicitly labeled. R-squared is optional/descriptive only with adequate nonconstant target variation; undefined values remain unavailable, never zero. Include residual plots against speed, height if approved, direction, device and usable ratio; investigate systematic errors rather than only rank models.

A reviewed tolerance-success rate (e.g. absolute-error threshold selected from pilot uncertainty and use case) can be secondary, with its unit and denominator. Do not call an arbitrary percentage within tolerance "accuracy" or a clinical acceptance threshold. Compare paired participant errors against the training-only constant and regularized linear baselines with effect sizes and uncertainty.

### 6.2 Secondary tasks only if approved

| Task | Required measures | Specific caution |
| --- | --- | --- |
| Non-clinical classification | Accuracy plus balanced accuracy, per-class precision/recall/F1, macro-F1, confusion matrix and class/group counts; ROC-AUC/PR-AUC with appropriate scores/classes; calibration if probabilities are used | Sensitivity/specificity only for an explicitly defined binary positive class; no disease interpretation. Missing classes can make AUC undefined; never hide that |
| Independent visible-event detection | One-to-one matching under frozen tolerance; event precision/recall/F1, misses/extras, matched timing MAE/RMSE/median/P95/bias, tolerance-success rates, left/right results | Timing error on matches alone can hide missed events. Contact labels and candidate-extremum labels are different tasks; unknown actual PTS limits physical timing claims |
| Projected knee agreement | Participant-balanced angular MAE/RMSE/bias, disagreement distribution, exact-image reference/model coverage | Independent projected 2D reference is not 3D anatomical truth. Existing tools are synthetic-only; real evidence must be qualified |

### 6.3 Denominators, uncertainty and failures

Maintain full planned-trial/actual-attempt ledger. Report enrolled/attempted participants, planned/unattempted trials, capture/processing failures, reference failures, exclusions, rejected poses, successful predictions and replacement attempts. Original and replacement takes stay visible; do not present a best-take subset as all attempts.

For each participant, define reference yield `R/A`, end-to-end prediction coverage `M/A` and conditional prediction availability `M/R`, where `A` is actual attempts, `R` valid references and `M` valid reference/prediction pairs. Report equal-participant averages of the first two; define cohort conditional availability as their ratio when reference yield is positive. Report pooled counts separately. This deliberately distinguishes a valid reference with model abstention from missing reference evidence. Planned but unattempted trials require a separate completion rate; do not manufacture failed captures. A participant with no attempts has unavailable attempt-based rates and must be explicitly counted; report full-cohort status/conditional descriptive rates, not silently exclude them. All-error summaries with no valid pairs remain unavailable.

Bootstrap whole evaluation participants, retaining all their trials/attempts, for 95% confidence intervals and paired model differences; prespecify seed/draw count (e.g. 2,000) and treatment of undefined draws. Never bootstrap frames as independent subjects or discard undefined draws to narrow intervals. Report the number of people contributing valid pairs, and separate training-seed variability from test-participant uncertainty. With very few participants, label intervals unstable/descriptive and consider reducing claims rather than promising precise significance. Review formal tests/multiple-comparison correction if many hypotheses are promoted to confirmatory claims.

### 6.4 Runtime and deployment

Measure pose extraction, feature calculation, learned-model inference, persistence and total processing separately. On specified phones report warm/cold median and P95 latency, clip length/sample count, peak memory if measurable, model/asset size, thermal/battery conditions and failures. A tiny regressor can be fast while pose decoding dominates total latency. GPU/CPU/delegate differences require explicit configuration and numerical parity checks. No on-device runtime for proposed models has been measured here.

## 7. Experimental design, explanations and ablations

Freeze experiment IDs, primary endpoint, input/label/split versions, tuning budgets, seed list and analysis rules before final testing. The following experiments answer distinct questions; secondary experiments may be dropped with an explicit scope decision rather than rushed into unreliable comparisons.

| ID / priority | Experiment and question | Controlled comparison and deliverable |
| --- | --- | --- |
| A / essential | Baseline: is there predictive signal? | Constant mean/median versus audited linear/regularized features; development grouped scores, then frozen held-out report |
| B / essential | Model comparison: which inductive bias helps? | Same F/splits for k-NN, SVR, RF, boosting, MLP and linear; identical label/coverage accounting, bounded tuning, paired participant effects |
| C / essential | Unseen-participant generalization | Development grouped CV plus untouched person holdout; test-person error/coverage distribution, not one clip or random frames |
| D / essential | Robustness to capture variation | Direction, side, clothing/light/background/framing/quality strata; sufficient person counts per stratum, paired controlled subsets when feasible; missing strata reported |
| E1 / essential | Normalization: pose geometry or camera shortcut? | Raw aspect-corrected coordinates versus hip-centered/body-scale-normalized features, with identical folds/model; separate calibration/height-assisted variant |
| E2 / essential | Visibility/missingness: error versus coverage? | Frozen current gate versus masks/features and prespecified alternate filtering; report full-ledger coverage and common-supported-subset errors; do not bridge unknown gaps silently |
| E3 / recommended | Temporal context: does sequence information help? | Matched trial labels, aggregate F versus S; fixed context durations and compact CNN; preserve seconds, distinguish architecture from representation effects |
| E4 / recommended | Which signals matter? | Remove knee, ankle, arm/sway or quality groups one at a time; cadence-only/kinematic-summary comparators; held-out fold permutation/group importance and uncertainty |
| F / recommended | Cross-device effects | Devices A/B on paired subjects for sensitivity; independently held-out participants on withheld device B for combined domain test. Label the two designs separately |
| G / essential before app deployment | Accuracy/coverage versus compute | Same clips/configuration, model-only and whole-pipeline runtime, memory/size; error/latency/coverage tradeoff chart |
| H / essential if cohort permits | Data-size learning curve: still data-limited? | Repeated training subsets of increasing participant counts, fixed validation people, training-only preprocessing and comparable tuning; uncertainty bands by participant subset/seed |
| I / conditional | Pose-backbone effect | Full versus Lite/Heavy or qualified MoveNet on matched source frames/common joints; separate upstream error, downstream speed and total runtime |
| J / recommended | Repeatability and label noise | Repeated-session/trial errors, observer disagreement, sensitivity to reference uncertainty; do not attribute reference noise entirely to model failure |

For H, sizes might be 8, 16, 24, 32 and all available development-training participants when folds support them; these are illustrations, not forced counts. Fixed validation people remain excluded from every size. Sample complete participant clusters and repeat subset draws; keep the final holdout sealed. Plot training and validation participant-balanced error and coverage versus **participants**, with trial/window counts secondary. A steep improving validation curve suggests possible data limitation; a plateau alone cannot distinguish reference noise, representation limits and true saturation. Standard learning curves compare performance against training size; this study adapts that idea to participant clusters. [Official learning-curve guide](https://scikit-learn.org/stable/modules/learning_curve.html).

Explain model differences with evidence: learning curves/seed variance for overfit, residual strata for scale/device bias, grouped feature ablations for useful signals, and temporal/context ablations for sequence benefit. Importance scores are associative and unstable under correlated features; do not claim biomechanical causation. If MLP loses to linear, test capacity/regularization/label noise before making a universal claim. Negative results and failed models remain reportable.

## 8. Candidate novelty/contribution audit

These are **candidate contributions, not verified novelty claims**. Category labels mean: potentially novel = a focused testable research idea; likely engineering contribution = useful system work without established scientific originality; requires literature verification = originality cannot be asserted yet; probably not novel = established method/component use. A contribution can be academically useful without being a new algorithm.

| Candidate | Category | Existing evidence | What is needed before thesis wording |
| --- | --- | --- | --- |
| Low-cost smartphone-only gait capture | Probably not novel | RGB capture/MediaPipe path (E01–E03) | Related-work comparison; state accessibility/workflow contribution without claiming invention |
| Offline local inference with source deletion | Likely engineering contribution | Native processing/storage, deletion, data policy (E02, E10, E15) | Latest-device acceptance and lifecycle audit; local operation reduces transfers, not guaranteed anonymity/certified privacy |
| Provenance-aware, fail-closed measurement availability | Requires literature verification | Native geometry, assertion/conflict checks, null/exclusion contracts (E10, E11) | Compare comparable systems, demonstrate prevented unsupported outputs and quantify error/coverage cost |
| Timestamp/gap-aware candidate interval analysis | Likely engineering contribution | Candidate detector/intervals/continuity (E11) | Independent candidate-reference agreement; preserve requested-clock limitation; do not claim new verified gait-event algorithm |
| Operator-assertion provenance distinguished from geometry/continuity | Requires literature verification | Direction/upright metadata-v2 and setup conflict rules (E10) | Literature comparison and reproducible fault cases; operator correctness not established by serialization |
| Participant-balanced error plus full failure/availability reporting | Probably not novel as statistical method | Synthetic cohort/cluster tooling (E12) | Real cohort evidence and clear denominator contract; claim transparency/application contribution rather than inventing grouped evaluation |
| Quality-aware speed learning with an explicit abstention/error/coverage tradeoff | Potentially novel | Existing quality masks/gaps can support the proposal (E11); learned version not implemented | New approved experiment, literature search, benchmark/ablations showing a distinct benefit; no novelty claim from planning alone |
| Matched cross-device speed benchmark and generalization analysis | Requires literature verification | Model/geometry/version metadata infrastructure (E02, E10); benchmark absent | Diverse approved data, paired/OOD design and verified comparison against existing datasets/studies |
| Compact downstream ML chosen by participant error, coverage and whole-app cost | Requires literature verification | Historical regressors plus offline architecture (E06, E13); integration absent | Fair benchmark, reproducible export/parity/runtime study; an empirical tradeoff can be a contribution without algorithm novelty |

Strongest prospective thesis package: independent participant-separated speed benchmarking; a measured quality/coverage tradeoff; and a reproducible accuracy/efficiency/domain-robustness analysis supported by provenance-aware local infrastructure. Its ML evidence is future work. Existing app features alone do not establish a defensible learned contribution.

Create a separate **literature novelty search** task before claiming originality: search primary gait-video/pose/edge-ML studies and dataset papers; record exact task, cohort/groups, labels, backbones/models, leakage controls, metrics/coverage, device cost and limitations. Build a comparison table with citations and identify a precise gap. Confirm contribution wording with supervisor; neither offline operation nor using MediaPipe is sufficient novelty by itself. This audit verified technical documentation, not that literature gap.

## 9. Limitation audit and reduction plan

Categories: **A** avoidable before defense; **B** reducible through data/experiments; **C** intrinsic to current technical/design scope; **D** future work. A row may have a reducible component while retaining an intrinsic boundary.

| Limitation | Category / present evidence | Concrete action and remaining boundary |
| --- | --- | --- |
| Tiny exploratory cohort/estimated labels | A; five rows/four people, uncertain speed (E06–E08) | Establish reviewed references and new approved cohort; exclude legacy estimates from scientific targets. If cohort stays small, restrict claims rather than hide it |
| Unclear ML thesis endpoint | A; app infrastructure advanced, accepted learned model absent (E06, E11, E13) | Supervisor agrees speed question, benchmark scope and endpoint before recruitment; reserve schedule for experiments/reporting |
| Unknown conditions/views and misleading stale reports | A (E05, E08) | Reject unknown target/group identity; repair metadata joins into new versioned outputs; retain history and provenance, never silently overwrite |
| Whole-table feature selection and inadequate tuning split | A (E05, E06) | Training-fold selection/pipelines, grouped inner validation and sealed holdout; automated split/lineage audits in later implementation |
| Legacy PoC event/geometry/time definitions | A (E04) | Review FPS from unique frame timestamps, aspect correction, gaps, interval selection and feature units; validate synthetic edge cases and independent reference; freeze shared contract |
| No independent real-reference evaluation | A; synthetic-only validators (E12–E14) | Qualify real-evidence adapter/reference workflow and observers before pilot; evaluate approved evidence with honest unavailable status |
| App deletes evidence; no durable research participant/attempt/failure ledger | A for research workflow (E02, E10, E11) | Separate authorized research acquisition/retention and pseudonymous ledger; preserve ordinary deletion semantics unless a future reviewed task changes them |
| Protocol/schema/capture variant mismatch | A (E13, E14) | Version protocol and manifest together, qualify actual resolution/orientation/timebase, update checker in a separate task |
| Unpinned dependencies/path mismatch; no downstream export parity | A (E06, E13, E15) | Isolated locked environment, explicit run dirs/inputs, finite portable metric serialization, feature/model cards and golden mobile/Python predictions |
| Pending institutional/consent/retention/owner decisions | A, external gate (E13) | Obtain recorded authentic decisions A-01–A-05 and exact storage/deletion responsibilities before recruitment; checker pass is not authorization |
| Few devices/body sizes/settings | B (E08, E13; current newest device acceptance pending by handoff) | Balanced multi-device/cohort plan, held-out domain tests and learning curves; no universal compatibility claim |
| Pose occlusion, cropping, missed/multiple detections | B + C (E02–E04, E11) | Quantify failures, improve qualified framing/quality handling and test alternate backbone; monocular observations still cannot recover invisible truth |
| No actual decoded PTS at Android samples | C currently; reducible only with a new qualified acquisition path (E02, E10, E14) | Assess decoder/evidence route before collecting timing-sensitive data; keep requested and decoded times separate. Cannot repair old sessions retrospectively; no tight physical-event timing claims from requested times alone |
| No independent exact-image authentication | C currently; A for same-image validation claim (E10–E14) | Qualify canonical bitmap/source hashes and inference/export equality on new research evidence; hashes detect inconsistency, not anatomy/consent; old landmarks alone cannot authenticate deleted images |
| 2D projected geometry, depth/metric-scale ambiguity | C (E03, E11) | Keep 2D labels/claims; test scale/calibration variants and bias; lab/3D validation is separate, not solved by reading normalized z |
| Side-view/stationary camera dependency | C, B robustness (E10, E11, E13) | Freeze supported view, annotate OOD failures; additional views require new feature/label validation |
| Dependence on externally trained pose estimator | C, B model comparison (E01–E03) | Disclose model/version/population uncertainty, paired backbone test if justified; no claim of new pose training |
| No clinical population or clinical validation | D / claim boundary (E08, E13) | Keep adult non-diagnostic study; separate clinically reviewed protocol and independent reference population in future |

A limitations should be closed or explicitly scoped out before defense; B limitations need measured residuals rather than promises; C/D limitations remain prominently disclosed. Better provenance does not establish biomechanics, actual PTS or clinical validity.

## 10. Concrete future work

| Direction | Specific next research outcome | Prerequisite beyond present thesis |
| --- | --- | --- |
| Multi-site cohort/external replication | Repeat frozen model on independently recruited people/sites, report domain shifts | Institutional coordination, comparable references and consent |
| Clinical populations | Test specific gait endpoint in a defined patient cohort against suitable independent measurements | Clinical collaborators, approvals, safety and new labels; no diagnosis promise |
| Additional views/3D validation | Compare side/front/multiview against calibrated 3D or lab reference | New capture/calibration contract, synchronized reference; monocular z is not proof |
| Compression/quantization | Measure post-compression participant error, coverage, size/latency and parity | Selected valid model and representative calibration set from development only |
| IMU fusion | Test incremental speed/event benefit of synchronized video plus inertial data | New hardware/synchronization/consent study; smartphone-video baseline retained |
| Personalized baselines/longitudinal monitoring | Analyze within-person repeatability and change under stable protocol | Repeated visits, drift/retention policy; separately label personalization versus unseen-person testing |
| Federated learning | Evaluate privacy/utility and communication costs across decentralized sites | Multi-site infrastructure, threat model and consent; local inference alone is not federated learning |
| iOS implementation | Reproduce supported capture/pose/features and predictions with parity/acceptance | Platform-specific decoder/model adapters and actual device tests |

These are prioritized extensions from measured thesis limitations, not obligations to implement now or substitutes for completing the present benchmark.

## 11. Thesis-risk matrix

Deadlines are dependency gates because the defense date and recruitment capacity are unresolved. "Before defense" does not mean waiting until thesis writing to discover the problem.

| Risk | Severity | Current status / why it matters | Mitigation | Resolve by |
| --- | --- | --- | --- | --- |
| Dataset size | CRITICAL | ~10–12 engineering videos in handoff; only five historical feature rows; no approved final dataset | Protocol pilot then justified larger cohort; participant learning curve and honest restricted claims if constrained | Size/budget decision in B; execution D, evidence H |
| Participant count/diversity | CRITICAL | Four historical PoC people; repetitions do not establish unseen-person performance | Participant recruitment plan, grouping, held-out people and strata counts | B target; D collection; G evaluation |
| Label/reference quality | CRITICAL | Visual estimates and assumed distance; no verified independent speed labels | Reviewed course/timing, blinded dual observers, uncertainty/adjudication and failed-label ledger | Before C pilot; freeze after C before D |
| Data leakage | CRITICAL | GroupShuffleSplit exists, but unknown IDs and whole-table feature selection remain | Versioned split/content lineage, fold-fitted preprocessing, sealed test and grouped tuning | E before first scientific fit; continuously audited |
| Ethics/retention readiness | CRITICAL | A-01–A-05 pending, source deletion conflicts with annotation needs | Authentic institutional decisions, complete consent/deletion plan, controlled research route | Before any C/D research recruitment |
| ML contribution clarity | HIGH | Actual trainers exist but thesis learning question/contribution unconfirmed | Agree one target and testable hypotheses, allocate ML/report effort | B before data design freeze |
| Number/diversity of comparisons | HIGH | Three historical regressors, no broad valid benchmark; rumored count unconfirmed | Supervisor counting decision, six core learned families and conditional temporal expansion | B scope; F execution |
| Lack of independent validation | HIGH | Synthetic checks are not real evidence; current PTS/image limits | Qualified real-reference path and independent held-out people | A/B qualification; C feasibility; G report |
| Novelty evidence | HIGH | Candidate systems/methods lack proper related-work search | Primary-literature matrix and defensible narrow empirical contribution | B/I planning, finalized before J claims |
| Reproducibility | HIGH | Unpinned research dependencies, private inputs, stale/path-mismatched artifacts | Locked environment, versioned runs/hashes/annotations/splits, reproducible synthetic smoke and documented access | E before benchmarking; J reproduction audit |
| App-versus-ML imbalance | HIGH | Sprint 5 engineering advanced; independent ML evaluation incomplete; both tracks remain required | Track app reliability/UX/device/integration and research label/cohort/model/evaluation milestones in parallel with named owners and shared completion gates | Throughout A–J; supervisor checkpoints |
| Application quality | HIGH | Newest physical acceptance pending; crashes, persistence/analysis defects, confusing/inaccessible UI or mobile model failures can prevent a reliable release despite good ML results | Physical/multi-device acceptance, offline/restart/failure regressions, UX/accessibility review, model parity and runtime/thermal/memory checks | A and ongoing app work; I integration and J release/demo readiness |
| Device diversity | MEDIUM | Latest setup/continuity physical acceptance pending; no established diverse scientific device study | Exact-APK smoke, qualified second/third phone strata, scope limitations if unavailable | A acceptance; D/H domain tests |
| Representation/clock validity | HIGH | PoC and Android features differ; requested versus nominal versus decoded clocks | Shared versioned feature/time contract, qualified acquisition, no false parity | A/E before labeling-sensitive fits |
| Temporal model overfit/resources | MEDIUM | Temporal training absent; cohort/compute budget unknown | Start tabular/compact CNN, learning curve, bounded tuning; drop unjustified capacity | F scope and H evidence |
| Deployment parity | MEDIUM | No selected downstream gait model in Android path | Frozen preprocessing/order/units, export/golden parity and end-to-end offline acceptance | I after scientific selection |
| Public dataset dependence | LOW unless critical path | No suitable licensed source verified | Separate search; own-cohort plan must stand independently | Before any download/use or recruitment reduction |

## 12. Ordered execution roadmap and collection gates

Each phase produces reviewable evidence. Research collection starts only at C after gates; **large research collection starts only at D after successful pilot review**. This document does not authorize either.

| Phase / owner role | Work and concrete exit evidence | Phone | Engineering video | Research data |
| --- | --- | --- | --- | --- |
| A — measurement/capture infrastructure; engineering lead | Latest exact APK physical smoke; qualified source/time/image/research-linkage route; capture variant frozen; existing deterministic feature boundaries reviewed; source retention/failure ledger design | Yes for acceptance | One fresh smoke clip; more engineering fixtures only if qualification needs them | No collection |
| B — question, labels and governance; research lead + supervisor/data steward | Supervisor agrees primary task/count/backbone scope and cohort rationale; label/reference SOP, annotation readiness, protocol/consent/retention decisions A-01–A-05; literature/data search; versioned schema design | Optional setup review | Optional approved engineering reference rehearsal | No new research collection |
| C — approved pilot; research/annotation leads | Gate A/B satisfied; 8–12-person feasibility pilot, dual annotations, failure/coverage analysis, time/geometry/window qualification and burden review; revised tolerances/protocol frozen | Yes | Engineering qualification completed first | **NEW RESEARCH COLLECTION MAY BEGIN HERE, after all gates** |
| D — main cohort; research/data steward | Pilot accepted; approved target/strata and replacement rules; 40–60-person aim or justified alternative; private ledgers/labels/consent and retained failures; frozen test allocation | Yes, multiple classes if feasible | No separate smoke per scientific trial unless needed | **LARGE COLLECTION BEGINS ONLY HERE** |
| E — preprocessing/reproducibility; ML lead | Qualified shared feature contract, masks/timebase/window rules, fresh versioned outputs, locked environment, participant/hash splits and fold-fitted pipelines | No; phone may support parity qualification | No new capture | Approved C/D data; no automatic collection |
| F — model benchmark; ML lead | Core task-matched families, grouped tuning, bounded temporal expansion, full run registry/seeds and errors; no final-test tuning | No | No | Approved frozen development data |
| G — independent evaluation; ML + independent reviewer | Frozen configs and held-out predictions, participant metrics/CI/coverage, paired baselines, failure ledger and scientific decision under approved rules | No unless capture/domain check unresolved | No | Held-out research evidence; no reuse for selection |
| H — robustness/ablations; ML lead | Prespecified normalization/context/missingness/feature/device tests and participant learning curve; interpretation of differences and residual limitations | Yes for phone/device runtime tests | Only if authorized engineering/runtime fixtures needed | Existing approved cohort; any expansion needs amendment |
| I — selected-model integration; engineering + ML leads | Versioned export/preprocessing, golden Python/mobile parity, input mismatch rejection, offline history/abstention acceptance and measured full-pipeline cost | Yes | Fresh engineering acceptance clip | No new research collection solely for integration |
| J — thesis/reproduction; thesis lead | Dataset/model cards, methods, literature matrix, frozen experiment tables/plots, uncertainty/failure reporting, limitations, bounded contribution claims and reproducible commands | Optional demo | Optional consenting engineering demo | No automatic collection |

A's immediate phone milestone uses the existing release at `frontend/android/app/build/outputs/apk/release/app-release.apk`, SHA-256 `ea14cded9e2cb6490f878f9cb7f4b857b649899e2bb2e495d0bcc0498b729519`, package `com.gaitsense.research`, signing certificate SHA-256 `fac61745dc0903786fb9ede62a962b399f7348f0bb6f899b8332667591033b9c`. These identify the **user-handoff verified artifact**, not a new verification/build by this audit. Install/update that exact APK, record one fresh engineering walk, explicitly choose image-x direction and confirm upright image, verify save/reload, knee/candidate extrema/intervals and offline reopen. The newest Sprint 5 milestone remains physically unaccepted pending a phone; earlier acceptance for older versions does not close it. This is not dataset collection and does not change `NOT_EVALUATED`.

Practical next documentation task can run without a phone: supervisor decision brief plus label/timebase/retention SOP and a versioned research-manifest proposal. Do not let phone availability delay clarifying the ML question and governance. Conversely, a phone smoke pass alone is insufficient to start pilot recruitment.

### 12.1 Reproducible experiment package to build in E–J

Future artifacts should include a task/protocol record, dataset card, private consent/attempt/reference ledgers, immutable input hashes, schema/annotation/feature/split versions, frozen preprocessing definitions, dependency/interpreter locks, explicit run command/config/seed, tuning history, participant membership, fit-only-on-train checks, per-trial held-out predictions and exclusions, metrics/cluster uncertainty, hardware/runtime configuration and model/export hashes. Use fresh run directories; preserve historical outputs and do not load arbitrary pickles as an audit shortcut.

Share source, synthetic fixtures, configs and aggregate reports within approved limits; provide restricted data-access instructions rather than promising public release of people/videos/features. Reproduction with private data is conditional on authorized access. Synthetic reproduction tests code only, not the empirical study. For future numerical exports, encode undefined metrics explicitly as null/unavailable with a reason rather than nonstandard JSON `NaN`.

## 13. Open decisions and verification record

| Unresolved decision | Required confirmer / timing | Consequence |
| --- | --- | --- |
| Specific minimum model count (including rumored ~10) | Supervisor/panel, B | Confirm number and counting rules; plan expands only with scientifically justified task-matched models |
| Pose-estimator comparison, downstream learned comparison, or both | Supervisor/panel, B | Determines reference burden, extraction matrix and scope; neither is assumed |
| Primary speed formulation versus an alternative | Supervisor + user, B | This document recommends speed; no target is approved by the recommendation |
| Final participant count/diversity and available recruitment time | Supervisor/research lead with statistical advice, B/C | Review ranges after pilot variance/coverage; no scientifically guaranteed number |
| Final labels/reference method, timebase, annotation agreement, thresholds and fixed-window rule | Supervisor/reference reviewers, B/C | Freeze before main collection and final-test analysis; guessed labels forbidden |
| Ethics/consent/retention/withdrawal/access requirements and actual owners | Appropriate institutional authority + supervisor/data steward, before C | Pending A-01–A-05 remains a collection blocker; no external legal determination made here |
| Stable capture variant, research retention/evidence route and PTS qualification | Engineering/research leads, A/B | Ordinary session deletion cannot supply retrospective reference evidence |
| Suitability/licence of any public dataset, including the named one-row source | Literature/data-search task + supervisor, before use | No dataset selected, downloaded or declared suitable |
| Holdout size, grouped/nested design and confirmatory comparisons | Supervisor/statistical reviewer, before E/F | Avoid small-sample precision claims and test-set model selection |
| Cross-device resources, mobile budget, defense timeline and division of work | User/team/supervisor, B | Prioritize core benchmark and identify explicit deferrals |

Audit scope: source/docs searches, read-only text/aggregate artifact inspection and primary technical documentation verification. No training, model execution, raw-video inspection, collection, Android behavior change or APK build. Existing study/checklist/protocol files were not rewritten; historical status prose can be stale and must be reconciled in later scoped work rather than treated as current acceptance.

Only this planning file is created by Sprint 6 Task 1. Verification completed: all 43 local evidence links resolve; `git diff --check` reports no whitespace errors; the new untracked document also passes `git diff --no-index --check -- NUL <document>` without whitespace diagnostics (exit 1 denotes the new-file difference). Before/after SHA-256 comparisons match for all nine pre-existing modified/untracked/protected files, including `output/task8-apk/verify-current-bundle.cjs`, `ShortIntervalComponentTest.kt`, the local research reconciliation and `docs/CURRENT_STATE.md`. The staged diff remains empty. No broad `git add`, staging, commit, push, generated APK or build artifact was produced by this task.

Stop after this audit/documentation task. The next engineering action needs a phone and one fresh engineering smoke video; the next protocol/label/decision document task needs neither. **No research dataset is required for either next step.**
