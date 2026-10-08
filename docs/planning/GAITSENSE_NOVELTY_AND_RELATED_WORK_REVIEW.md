# GaitSense — novelty and related-work review

Sprint 6 Task 6 · 8 October 2026 · supervisor meeting: Monday, 12 October 2026.

**Scientific status: NOT_EVALUATED.** This is a focused literature audit and a proposed contribution package, not scientific validation, an approved study or an exhaustive novelty search. Model: GPT-6.1 Sol; reasoning effort: High. This task requires no Android phone, engineering video or research dataset.

**Conclusion:** smartphone markerless gait analysis, pose-based speed prediction, on-device pose inference, grouped evaluation and selective prediction already have substantial precedent. No completed research contribution earns category A below. GaitSense has useful implemented systems contributions and three promising empirical directions that require approved data, experiments and closer prior-work comparison. Five contribution statements are offered; they are not five established novelties.

Both tracks remain equally necessary: **a reliable real application** and **scientifically defensible ML/thesis work**. App reliability does not replace learned-model evaluation; research scores do not replace capture, persistence, accessibility or deployment reliability.

## 1. Scope, search and evidence rules

Search date: 8 October 2026. The reviewed set comprises **13 unique works**: nine peer-reviewed gait/movement/dataset papers, one peer-reviewed general ML methods paper, two recent gait-system preprints, and one foundational pose technical/workshop paper accessed through arXiv. Publication years span 2019–2026. This is a focused narrative comparison, not a systematic review with prevalence estimates.

Searches used the web search tool, publisher pages, PLOS full texts, Nature/Scientific Data records, primary-paper copies in PMC, arXiv manuscripts and PMLR proceedings. Author repositories helped identify source versions; repository copies are not additional studies. No blog, marketing page or AI summary supports a conclusion.

Representative queries actually used:

- `smartphone video gait analysis walking speed MediaPipe on device offline validation`
- `walking speed estimation monocular pose machine learning subject independent gait video`
- `Stenum video gait analysis OpenPose smartphone 2021 2024 clinical`
- `OpenCap smartphone cameras 2023 Uhlrich cloud validation`
- `gait smartphone on-device pose analysis paper`
- `gait coverage pose failure uncertainty`
- `"gait analysis" "provenance" smartphone`
- `"gait" "abstention" "coverage" pose`
- `"smartphone" "gait" "different devices" video pose`
- `Health & Gait dataset walking speed`

These cover smartphone/monocular RGB gait, low-cost markerless assessment, walking-speed learning, gait-event and 2D knee calculations, MediaPipe, local/edge/privacy deployment, reliability/abstention, participant separation, camera/device robustness and failure reporting. Provenance searches produced relatively few directly matching gait papers; that retrieval result is **not evidence that comparable systems do not exist**.

Three evidence types remain separate:

1. **Paper evidence:** findings reported by the cited source, under its own setup and population.
2. **Project evidence:** capabilities read in the working tree, linked below; source presence is not device or scientific acceptance.
3. **Inference/proposal:** this review's differentiation judgments and experiments, conditional on missing evidence.

In the matrix, **NR** means *not established in the inspected source material*, not proof of absence. **N/A** means the question does not apply, for example a downstream training split in a deterministic measurement-validation study. A pretrained pose model still has its own training history. “Local desktop” and “local phone” are different deployment categories. Unverified numerical results are omitted; no reported accuracy transfers to GaitSense.

## 2. Current project evidence and boundaries

Baseline: local `main` at `c565f639680a77d4de898b4a68e0d7aee3bd9d34`. Existing unrelated research reconciliation is uncommitted and remains separate. The audit inspected current files rather than treating all working-tree contents as committed evidence.

| ID | Direct repository evidence | Established capability and limit |
| --- | --- | --- |
| P01 | [Native inference/storage](../../frontend/modules/gaitsense-pose/android/src/main/java/expo/modules/gaitsensepose/GaitSensePoseModule.kt) | Hash-checked pretrained `pose_landmarker_full.task`; MediaPipe VIDEO inference on Android; 33-point saved poses and SQLite transactions. Samples request `0,100,...` ms through `OPTION_CLOSEST`. No actual decoded PTS or exact-image identity is supplied. Temporary source is deleted before successful storage; no new learned gait predictor is deployed here. |
| P02 | [Geometry contract](../../frontend/src/offline/ANALYSIS_METADATA.md), [metadata reader](../../frontend/src/offline/analysis-metadata.ts), [saved adapter](../../frontend/src/offline/saved-payload-analysis.ts) | Geometry observed at actual inference bitmaps, constancy across calls, transform/source tags and unavailable/conflict states. Persisted geometry is not anatomical validation or authentication of source images. |
| P03 | [Recording setup](../../frontend/src/offline/RECORDING_ANALYSIS_SETUP.md), [saved adapter](../../frontend/src/offline/saved-payload-analysis.ts) | Explicit image-x direction and upright-image assertions persist with `operator-recording-setup` provenance. Caller/persisted disagreement blocks affected components. This tag neither identifies an operator person nor proves the assertion correct. |
| P04 | [Knee engine](../../frontend/src/offline/knee-flexion.ts), [motion detector](../../frontend/src/offline/motion-candidates.ts), [interval engine](../../frontend/src/offline/motion-intervals.ts) | Deterministic projected geometry, quality-filtered ankle extrema and adjacent same-polarity candidate intervals; nulls/reasons/gaps retained, no interpolation. Candidates are not validated contacts; intervals are not validated physical step/stride times. |
| P05 | [Saved continuity](../../frontend/src/offline/SAVED_CONTINUITY.md), [session wrapper](../../frontend/src/offline/session-analysis.ts), [History binding](../../frontend/src/offline/saved-analysis-binding.ts) | Fresh detector segments are checked against loaded observations and requested-clock gaps. This establishes engineering continuity of usable samples, not decoded-image continuity, complete physical cycles or independently authenticated ownership. |
| P06 | [Synthetic cohort tooling](../../frontend/src/validation/motion-cohort.ts), [validation scope](../../frontend/src/validation/README.md) | Synthetic participant-balanced errors, coverage, failures/replacements and participant-cluster bootstrap machinery exist. No real cohort or scientifically validated speed coverage result follows. Zero-attempt policies remain explicitly restricted. |
| P07 | [Classifier source](../../research/gaitsense_poc/scripts/10_train_model.py), [regression source](../../research/gaitsense_poc/scripts/12_train_regression.py) | Random Forest condition classifier; linear, Random Forest and shallow MLP speed trainers. GroupShuffleSplit and train-fitted imputation/scaling exist; feature availability is selected before splitting. These are exploratory training implementations, not an approved benchmark, new architecture or production model. No trainer was run for this task. |
| P08 | [ML audit](ML_THESIS_READINESS_AND_EXPERIMENT_PLAN.md), [supervisor brief](ML_SUPERVISOR_DECISION_BRIEF.md), [speed SOP](WALKING_SPEED_REFERENCE_SOP_DRAFT.md) | Proposed primary task: trial-average walking-speed regression for previously unseen participants. Target is independently measured distance / independently qualified crossing duration; neither reference input becomes a predictor feature. Supervisor confirmation remains pending. Historical tiny-cohort estimated-label fits are not scientific validation. |
| P09 | [V2 proposal](RESEARCH_MANIFEST_V2_PROPOSAL.md), [timing qualification](REFERENCE_TIMING_AND_ANNOTATION_QUALIFICATION.md), [V2 invariants](RESEARCH_MANIFEST_V2_INVARIANTS.md), [synthetic catalog](../../research/study/fixtures/v2-proposal/README.md) | Reference/prediction separation, participant/session/trial/attempt ownership, failure accounting, lineage and frozen split rules are proposed. The separate validator exercises synthetic metadata only; V2 is not implemented into production. The app UUID is not research participant identity. |

The six Sprint 6 contracts above remain in force as drafts/proposals. Pilot **8–12**, stronger thesis **40–60**, expansion **80–120+** participants are planning ranges, not approved recruitment, power analyses or guaranteed sufficiency. Participants, sessions, planned trials, actual attempts, videos and frames/windows are distinct. The rumored approximately ten-model requirement and downstream-versus-backbone scope remain unconfirmed; seeds/widths do not establish distinct families, and classifiers do not belong in a regression benchmark just to raise its count.

No primary endpoint, course distance, decoder/timing technology, observer threshold, adjudication rule, institutional determination, consent/retention policy, public dataset or device requirement is approved by this review. [Existing conflict owners/gates](ML_SUPERVISOR_DECISION_BRIEF.md#conflicts-requiring-explicit-resolution) remain unresolved: older cohort/trials and endpoints, portrait/720p versus landscape/1080p, ordinary deletion versus research retention, V1 versus V2 and requested/nominal versus qualified physical timing. No existing protocol or checker is amended.

## 3. Related-work matrix

The following three linked tables form one matrix. Study IDs refer to the source register in section 4. Splitting refers to the **downstream study**, not upstream pretrained-pose training. Cohort denominators distinguish recruited/dataset participants from analyzed subsets.

### 3.1 Task, population, acquisition and models

| Study | Task/population/sample | Input/device/setup | Pose and downstream method → output |
| --- | --- | --- | --- |
| [S01](https://www.nature.com/articles/s41467-020-17807-z), 2020 | Visit-level gait prediction; 1,792 videos, 1,026 patients with cerebral palsy | Single sagittal clinical RGB camera; 29.97 fps | OpenPose → CNN, Random Forest, Ridge; speed, cadence and other clinical metrics |
| [S02](https://journals.plos.org/ploscompbiol/article?id=10.1371/journal.pcbi.1008935), 2021 | Measurement validation; 32 healthy people in source dataset, 31 analyzed | Left/right Basler sagittal RGB, 25 Hz | OpenPose BODY_25 → deterministic MATLAB events, spatiotemporal values and projected joint angles |
| [S03](https://www.mdpi.com/1424-8220/23/2/696), 2023 | Running measurement; 31 healthy experienced runners | Two iPhone 13 capture views, each processed from video; 240 fps treadmill recordings | BlazePose → signal-analysis contact/timing/knee/foot-strike measurements; no trained downstream regressor |
| [S04](https://journals.plos.org/ploscompbiol/article?id=10.1371/journal.pcbi.1011462), 2023 | Movement dynamics; ten healthy adults in laboratory validation; separate 100-person field squat demonstration | Two iPhones in validation; calibrated multi-view RGB | OpenPose/HRNet, triangulation, LSTM marker augmentation and musculoskeletal simulations → 3D kinematics/kinetics |
| [S05](https://www.mdpi.com/2306-5354/11/2/141), 2024 | Camera-location effects; 20 healthy volunteers | Five Samsung Galaxy S22 cameras at different angles, 30 fps; treadmill | MediaPipe/BlazePose → deterministic 2D joint angles and detection rates |
| [S06](https://journals.plos.org/digitalhealth/article?id=10.1371/journal.pdig.0000467), 2024 | Clinical/viewpoint measurement; 44 stroke and 19 Parkinson's participants, plus public healthy dataset (32, one excluded) | Samsung Galaxy Tab A7 frontal/sagittal 1080p/30 Hz; public Basler recordings | OpenPose BODY_25 → deterministic gait measurements and change analysis |
| [S07](https://www.nature.com/articles/s41597-024-04327-4), 2025 | Health & Gait dataset; 398 adults, 1,564 videos | Controlled indoor RGB; pace, direction and jacket variation; camera model NR here | AlphaPose and other visual representations; XGBoost/MLP/MoviNet technical benchmarks for sex, age, weight; measured gait data also supplied |
| [S08](https://journals.plos.org/plosone/article?id=10.1371/journal.pone.0317933), 2025 | Measurement validation; 24 people with early Parkinson's disease | Two Galaxy A Quantum views, 30 Hz; treadmill/overground | MediaPipe → MATLAB filtering/interpolation, ankle peaks, gait parameters and projected angles |
| [S09](https://journals.plos.org/digitalhealth/article?id=10.1371/journal.pdig.0001004), 2025 | Simulated gait classification; 27 able-bodied DPT students/faculty, 743 videos, seven classes | Frontal/sagittal smartphone RGB, outdoor path; hardware model NR | On-device MediaPipe → features, SVM/RF/XGBoost, window/video voting |
| [S10](https://arxiv.org/html/2605.21421v1), 2026 preprint | AIGaitor deployment benchmark; 74 survey respondents are not a gait-validation cohort | iOS smartphone videos; reported compute benchmark on iPhone 14 | CoreML pose/mesh/refinement and example downstream deep models → motion analysis/classification |
| [S11](https://arxiv.org/html/2609.22619v1), 2026 preprint | GaitVista reliability-aware reconstruction; TotalCapture/MoVi, five held-out participants per reported protocol | Calibrated multi-view RGB plus body-worn IMUs | Visual/inertial reconstruction and learned small gate → inspectable fusion, pose/knee measures |
| [S12](https://proceedings.mlr.press/v97/geifman19a.html), 2019 | General selective prediction; four non-gait benchmarks | SVHN, CIFAR-10, Cats vs Dogs, Concrete Strength; no gait participants | SelectiveNet prediction/rejection heads → classification/regression plus abstention |
| [S13](https://arxiv.org/abs/2006.10204), 2020 technical foundation | Mobile body pose tracking; not gait validation | Monocular RGB, Pixel 2 runtime demonstration | BlazePose lightweight CNN → 33 body keypoints |

### 3.2 Evaluation, reference and deployment

| Study | Participant separation | Independent reference/target | Processing/runtime boundary |
| --- | --- | --- | --- |
| S01 | Patient-disjoint train/validation/test | Vicon visit-level metrics; separate video/reference walks | Titan X pose extraction and cloud computation; not on-phone; no GaitSense runtime inference |
| S02 | N/A: no downstream fitting | Synchronized Vicon; spatial scale retrospectively estimated | Colab pose + offline desktop MATLAB; no phone runtime |
| S03 | N/A: measurement comparison | Vicon, 200 Hz | Off-phone Raspberry Pi server/edge processing; smartphone capture/UI is not full phone compute; mobile end-to-end runtime NR |
| S04 | Augmenter has a separate train/validation/test split; participant grouping not established here; no downstream speed-regression split | Marker-based capture and force plates | Cloud/server compute; field processing time reported, not fully local phone execution |
| S05 | N/A: measurement comparison | Optitrack, 120 fps | Phone capture; fully on-phone analysis not established; runtime NR |
| S06 | N/A: measurement comparison | Synchronized Vicon | Local RTX 3080 desktop + MATLAB; privacy from avoiding upload is not phone execution |
| S07 | Participant-disjoint four-fold technical benchmarking | OptoGait/MuscleLAB measurements separate from pose-estimated gait files | Offline research feature/benchmark pipeline; phone deployment/runtime NR |
| S08 | N/A: measurement comparison; participant means also reported | Optitrack, 240 Hz | MATLAB postprocessing; full phone execution/runtime not established |
| S09 | LOSO outer loop, participant-grouped inner validation; train-only feature selection/SMOTE | Instructed simulated class; not disease diagnosis | Pose on device, pose upload/server pathway described; full offline downstream phone inference not established |
| S10 | No new participant-separated reference-speed evaluation established | Runtime workloads/survey, not accepted speed labels | Full phone pipeline; 10 s clip took 77 s versus 94 s cloud under one uplink scenario; not universal real-time execution |
| S11 | Subject-disjoint protocols, with participant-specific supervised IMU calibration | Motion-capture/marker-supported references | Research reconstruction pipeline; phone deployment/runtime NR; speed excluded by shared-root setup |
| S12 | Gait grouping N/A | Dataset labels | Research training/inference; smartphone/runtime validation NR |
| S13 | Downstream gait grouping N/A | Pose evaluation, not independent gait labels | Reported >30 fps on Pixel 2; cannot transfer that number to Full-model GaitSense |

### 3.3 Failure reporting, limitations and relevance

| Study | Failure/coverage evidence | Main constraint and GaitSense implication |
| --- | --- | --- |
| S01 | Missing poses interpolated; complete attempt-yield ledger NR | Single clinical center/controlled view; direct precedent for learned speed plus model comparisons |
| S02 | Excluded diagonal participant; manual false-person/limb corrections; short gap interpolation | Healthy side-view measurements and scale uncertainty; event/angle analysis is established |
| S03 | Outcome agreement reported; complete capture/reference/prediction funnel NR | Controlled running; precedent for cheap mobile workflow, with external compute |
| S04 | Quantitative validation; all-attempt replacement ledger NR | Multi-camera calibration/cloud; proves consumer capture alone is not a novel concept |
| S05 | Joint detection rates explicitly compared by location | Same phone model at five positions; not five-model handset-domain testing |
| S06 | Manual tracking corrections and exclusions documented | View/population effects and desktop processing; local analysis already exists |
| S07 | Missing anthropometry/sensor parameters disclosed | Controlled dataset; independent measured and estimated fields must not be mixed; suitability remains unapproved |
| S08 | Gap creation/filling and participant versus step analyses described | Narrow population/view dependence; MediaPipe gait/knee analysis and participant aggregation are not new |
| S09 | No-pose frames excluded and partial-keypoint gaps interpolated | Simulated patterns, small cohort; rigorous grouping already has precedent |
| S10 | Per-stage/end-to-end timing, parameter sizes and thermal behavior reported | Preprint, hardware/workload-specific; direct threat to offline/runtime-first novelty claims |
| S11 | Controlled degradation, worst-condition errors and reliability ablations | Preprint, multimodal/calibration limits; quality-aware inspectable measurement has precedent |
| S12 | Explicit risk–coverage experiments | Not gait-specific; abstention/error–coverage is established methodology |
| S13 | Pose/mobile efficiency evaluated; all-attempt gait yield N/A | Technical foundation, not clinical evidence or invention by GaitSense |

**Interpretation:** the retrieved examples establish participant-independent practice; they do not estimate how frequently the entire field uses it. Several sources disclose failures or missingness. We cannot say “other studies hide failures” or “coverage is never reported.” An exhaustive planned-trial → attempt → reference → prediction accounting contract remains a narrower potential empirical distinction, requiring supplement/code review.

## 4. Source register and access verification

Each ID counts once. Publisher/PMC copies, arXiv versions, author code and variant capitalizations do not increase the count.

- **S01:** Kidziński et al. (2020), *Deep neural networks enable quantitative movement analysis using single-camera videos*, Nature Communications 11, 4054. DOI **10.1038/s41467-020-17807-z**. [Publisher](https://www.nature.com/articles/s41467-020-17807-z); [primary-paper PMC copy](https://pmc.ncbi.nlm.nih.gov/articles/PMC7426855/). Methods and participant separation checked; exact split-size text is internally inconsistent with the stated unique cohort, so numerical partition counts are deliberately not repeated.
- **S02:** Stenum, Rossi and Roemmich (2021), *Two-dimensional video-based analysis of human gait using pose estimation*, PLOS Computational Biology 17(4), e1008935. DOI **10.1371/journal.pcbi.1008935**. [Publisher/full text](https://journals.plos.org/ploscompbiol/article?id=10.1371/journal.pcbi.1008935). Methods, exclusions, scaling and processing checked.
- **S03:** Young et al. (2023), *Internet-of-Things-Enabled Markerless Running Gait Assessment from a Single Smartphone Camera*, Sensors 23(2), 696. DOI **10.3390/s23020696**. [Publisher](https://www.mdpi.com/1424-8220/23/2/696); [primary-paper PMC copy](https://pmc.ncbi.nlm.nih.gov/articles/PMC9866353/). Indexed primary methods and author accepted manuscript checked when direct publisher access was rate-limited.
- **S04:** Uhlrich et al. (2023), *OpenCap: Human movement dynamics from smartphone videos*, PLOS Computational Biology 19(10), e1011462. DOI **10.1371/journal.pcbi.1011462**. [Publisher/full text](https://journals.plos.org/ploscompbiol/article?id=10.1371/journal.pcbi.1011462). Validation, model architecture and deployment checked.
- **S05:** Yang and Park (2024), *Improving Gait Analysis Techniques with Markerless Pose Estimation Based on Smartphone Location*, Bioengineering 11(2), 141. DOI **10.3390/bioengineering11020141**. [Publisher](https://www.mdpi.com/2306-5354/11/2/141); [primary-paper PMC copy](https://pmc.ncbi.nlm.nih.gov/articles/PMC10886083/). Primary methods inspected; Crossref title/author/date independently matched.
- **S06:** Stenum et al. (2024), *Clinical gait analysis using video-based pose estimation: Multiple perspectives, clinical populations, and measuring change*, PLOS Digital Health 3(3), e0000467. DOI **10.1371/journal.pdig.0000467**. [Publisher/full text](https://journals.plos.org/digitalhealth/article?id=10.1371/journal.pdig.0000467). Methods checked; Crossref metadata matched.
- **S07:** Zafra-Palma et al. (2025), *Health & Gait: a dataset for gait-based analysis*, Scientific Data. DOI **10.1038/s41597-024-04327-4**. [Publisher](https://www.nature.com/articles/s41597-024-04327-4); [primary-paper PMC copy](https://pmc.ncbi.nlm.nih.gov/articles/PMC11724122/). Dataset/methods and author benchmark materials checked. DOI's `024` does not change publication year to 2024. No dataset files downloaded or suitability approved.
- **S08:** Kim et al. (2025), *Assessment of temporospatial and kinematic gait parameters using human pose estimation in patients with Parkinson’s disease: A comparison between near-frontal and lateral views*, PLOS ONE 20(1), e0317933. DOI **10.1371/journal.pone.0317933**. [Publisher/full text](https://journals.plos.org/plosone/article?id=10.1371/journal.pone.0317933). Methods checked; Crossref metadata matched.
- **S09:** Reddy et al. (2025), *Classifying simulated gait impairments using privacy-preserving explainable artificial intelligence and mobile phone videos*, PLOS Digital Health 4(9), e0001004. DOI **10.1371/journal.pdig.0001004**. [Publisher/full text](https://journals.plos.org/digitalhealth/article?id=10.1371/journal.pdig.0001004). Methods checked; Crossref metadata matched. Earlier arXiv 2412.01056 is the same work, not a fourteenth study.
- **S10:** Reddy, Kesar and Kwon (2026), *AIGaitor: Privacy-preserving and cloud-free motion analysis for everyone, using edge computing*. **Preprint**, arXiv **2605.21421v1**, 20 May 2026. [Record](https://arxiv.org/abs/2605.21421); [inspected manuscript](https://arxiv.org/html/2605.21421v1). Deployment, workload and thermal sections checked. No peer-reviewed version verified in this task.
- **S11:** Jayasinghe, Parashar and Trivedi (2026), *GaitVista: Reliability-Aware AI Measurement toward Accessible Longitudinal Gait Assessment*. **Preprint**, arXiv **2609.22619v1**, 18 September 2026. [Record](https://arxiv.org/abs/2609.22619); [inspected manuscript](https://arxiv.org/html/2609.22619v1). Reliability, grouping, references and limitations checked. No peer-reviewed version verified.
- **S12:** Geifman and El-Yaniv (2019), *SelectiveNet: A Deep Neural Network with an Integrated Reject Option*, ICML, PMLR 97:2151–2159. [Stable proceedings record](https://proceedings.mlr.press/v97/geifman19a.html); [primary PDF](https://proceedings.mlr.press/v97/geifman19a/geifman19a.pdf). Classification/regression experiments checked. No DOI asserted.
- **S13:** Bazarevsky et al. (2020), *BlazePose: On-device Real-time Body Pose tracking*, arXiv **2006.10204**, CVPR workshop identified in the author record. [Stable technical-paper record](https://arxiv.org/abs/2006.10204). Pose/on-device facts checked; not counted as a peer-reviewed clinical gait study. No DOI asserted.

All 13 source identities and linked primary records were located through browsing. All nine DOI strings match the cited paper in primary records; four also returned matching Crossref metadata. Nature/MDPI/PMC and some Crossref requests intermittently returned fetch errors, rate limits or CAPTCHA. A final direct check of the document's 20 unique external URLs returned 12 ordinary HTTP 200 responses, six HTTP 200 browser challenges and two HTTP 403 responses. Browser challenges are not successful full-text retrieval. Accessible indexed primary text/copies supplied the comparisons. Bibliographic identity is verified; unrestricted access to every endpoint, supplement/code completeness and exhaustive novelty are not established.

## 5. Candidate classification — exactly one category per candidate

Category keys: **A DEFENSIBLE DISTINCT CONTRIBUTION**; **B POTENTIALLY DISTINCT — MORE EVIDENCE NEEDED**; **C STRONG ENGINEERING CONTRIBUTION**; **D ESTABLISHED GOOD PRACTICE**; **E NOT DISTINCT**; **F UNSAFE TO CLAIM**. Letters identifying candidates below are independent of category letters.

| Candidate | One category | Evidence-based judgment / safe boundary |
| --- | --- | --- |
| A. Low-cost smartphone-only markerless workflow | **E — NOT DISTINCT** | [S03](https://www.mdpi.com/1424-8220/23/2/696), [S04](https://journals.plos.org/ploscompbiol/article?id=10.1371/journal.pcbi.1011462), [S08](https://journals.plos.org/plosone/article?id=10.1371/journal.pone.0317933) establish consumer-camera gait workflows. GaitSense's accessibility is valuable but the general idea is established. |
| B. Offline/local on-device pose and analysis | **C — STRONG ENGINEERING CONTRIBUTION** | P01/P04 are implemented locally. [S13](https://arxiv.org/abs/2006.10204) and [S10](https://arxiv.org/html/2605.21421v1) prevent an originality claim from local execution alone. A useful Android implementation still requires physical acceptance. |
| C. Provenance-aware fail-closed analysis | **B — POTENTIALLY DISTINCT — MORE EVIDENCE NEEDED** | P02/P03 distinguish geometry, assertions and conflicts. [S11](https://arxiv.org/html/2609.22619v1) is close reliability-related prior art, while [S06](https://journals.plos.org/digitalhealth/article?id=10.1371/journal.pdig.0000467) has documented corrective workflows. The exact persisted contract may differentiate a system; fault and availability benefits are unmeasured. Broader measurement-provenance search needed. |
| D. Timestamp/gap-aware candidate intervals | **C — STRONG ENGINEERING CONTRIBUTION** | P04/P05 explicitly preserve requested-clock limitations. [S02](https://journals.plos.org/ploscompbiol/article?id=10.1371/journal.pcbi.1008935) and [S08](https://journals.plos.org/plosone/article?id=10.1371/journal.pone.0317933) already contain peak/event pipelines. Different repair/eligibility policies do not establish a new or superior gait-event method. |
| E. Error/quality/coverage tradeoff | **B — POTENTIALLY DISTINCT — MORE EVIDENCE NEEDED** | General rejection is established by [S12](https://proceedings.mlr.press/v97/geifman19a.html); reliability/degradation by [S11](https://arxiv.org/html/2609.22619v1). A speed-specific Android study with independent reference yield and participant-balanced denominators could add empirical evidence. It is not implemented or evaluated yet. |
| F. Participant-separated ML benchmarking | **D — ESTABLISHED GOOD PRACTICE** | [S01](https://www.nature.com/articles/s41467-020-17807-z), [S07](https://www.nature.com/articles/s41597-024-04327-4) and [S09](https://journals.plos.org/digitalhealth/article?id=10.1371/journal.pdig.0001004) provide direct precedent. Claim rigorous evaluation, not invention; no field-wide frequency claim follows. |
| G. Error/runtime/size/whole-pipeline tradeoff | **B — POTENTIALLY DISTINCT — MORE EVIDENCE NEEDED** | [S10](https://arxiv.org/html/2605.21421v1) is a strong deployment comparator. The possible difference is a matched unseen-person speed benchmark on Android with availability and parity, not a new efficiency metric. P07 provides starting trainers, not this result. |
| H. Cross-phone gait robustness | **B — POTENTIALLY DISTINCT — MORE EVIDENCE NEEDED** | [S05](https://www.mdpi.com/2306-5354/11/2/141) tests placement, not different handset models; [S10](https://arxiv.org/html/2605.21421v1) has a specific hardware benchmark. Matched handset-domain speed testing is a narrower open question in this reviewed set, not a proven worldwide gap. |
| I. Operator assertion versus inferred evidence | **C — STRONG ENGINEERING CONTRIBUTION** | P03 makes the distinction explicit and durable. Orientation handling already appears in [S01](https://www.nature.com/articles/s41467-020-17807-z) and [S02](https://journals.plos.org/ploscompbiol/article?id=10.1371/journal.pcbi.1008935). A source discriminator alone is neither a new ML algorithm nor authenticated truth. |
| J. Failure ledger and participant-balanced reporting | **D — ESTABLISHED GOOD PRACTICE** | P06/P09 enforce transparency at synthetic/proposal scope. [S02](https://journals.plos.org/ploscompbiol/article?id=10.1371/journal.pcbi.1008935), [S05](https://www.mdpi.com/2306-5354/11/2/141), [S07](https://www.nature.com/articles/s41597-024-04327-4) and [S08](https://journals.plos.org/plosone/article?id=10.1371/journal.pone.0317933) already report relevant exclusions/detection/missingness/aggregation. Completeness in GaitSense can be a useful reproducibility artifact, not a new statistical principle. |

Totals: A **0**, B **4**, C **3**, D **2**, E **1**, F **0**. Category F is unnecessary for these carefully bounded candidate descriptions; several stronger claims are unsafe in section 8. A category B assignment is a research hypothesis, not permission to write “novel” in the thesis.

## 6. Five strongest contribution statements

The package has two implemented engineering statements and three conditional empirical statements. Their merit does not depend on being world-first. Supervisor acceptance of the contribution type remains required.

### C1. Auditable saved-analysis prerequisites — systems/app

**Safe present wording:** “GaitSense implements a local Android analysis workflow that records inference geometry and operator setup separately, preserves conflicts and explains unavailable saved-analysis components.”

What exists: P01–P03/P05. Closest comparisons: [S06](https://journals.plos.org/digitalhealth/article?id=10.1371/journal.pdig.0000467) and [S11](https://arxiv.org/html/2609.22619v1). **Proposed difference:** durable native/caller/operator distinctions and fail-closed reload behavior for this app's measurements. This review has not established that other systems lack equivalent metadata.

Required evidence: a contract comparison against closest source/supplements, reproducible malformed/missing/conflicting setup cases, and newest-APK acceptance. Required experiment before claiming improved reliability: prespecified fault injection comparing explicit eligibility with a clearly described permissive baseline; report unsupported outputs prevented, valid outputs lost, reason correctness and restart behavior. Synthetic safety tests can establish contract behavior, not real measurement accuracy. No operator authentication or privacy guarantee follows.

### C2. Honest candidate-motion continuity — systems/app and methodology

**Safe present wording:** “GaitSense exposes candidate ankle-motion extrema and intervals with checked requested-clock continuity, explicit gaps and unsupported-result reasons.”

What exists: P04/P05. Closest comparisons: [S02](https://journals.plos.org/ploscompbiol/article?id=10.1371/journal.pcbi.1008935) and [S08](https://journals.plos.org/plosone/article?id=10.1371/journal.pone.0317933). **Difference:** a deliberately restricted output contract, not validated gait-event detection. No claim that refusing interpolation is universally better.

Required evidence: new qualified image/time evidence and independent annotations for any physical-event extension. Required experiment: approved boundary/gap/quality perturbations and independent reference comparison, with errors and unavailable intervals jointly reported. Prior studies' repair policies are experimental comparators, not implementation authorization now. Requested timestamps cannot serve as speed-reference timing. This is presently an engineering contribution, not an ML novelty.

### C3. Speed regression with explicit error–availability accounting — ML/evaluation

**Safe proposal wording:** “GaitSense proposes to evaluate unseen-participant walking-speed regression with participant-balanced prediction errors, reference yield and prediction availability under prespecified quality policies.”

Starting evidence: P06–P09; no speed study completed. Closest comparisons: [S01](https://www.nature.com/articles/s41467-020-17807-z), [S11](https://arxiv.org/html/2609.22619v1), [S12](https://proceedings.mlr.press/v97/geifman19a.html). **Proposed difference:** the endpoint-specific combination of independently qualified labels, pose quality, full attempt denominators and learned speed comparison. Neither speed regression nor abstention is invented here.

Required experiment: after approval, compare ungated/permitted-quality policies using development-only threshold selection; freeze models/gates; evaluate sealed people once. Report participant-balanced MAE/RMSE/bias, participant-cluster intervals, error versus coverage curves, zero-output people, reference yield and pose/prediction failures. Denominators must distinguish attempted, captured, reference-eligible and paired records. Missing references have no measurable error; missing predictions have no invented value. Reduced conditional error with collapsed coverage is not an unqualified improvement.

### C4. Compact versus temporal models at real mobile cost — ML/systems hybrid

**Safe proposal wording:** “GaitSense proposes a reproducible comparison of compact and temporal speed regressors using unseen-participant errors, availability, Python/mobile parity and whole-pipeline Android resource costs.”

Starting evidence: P01/P07/P08; broad comparison, export and parity absent. Closest comparisons: [S01](https://www.nature.com/articles/s41467-020-17807-z) and [S10](https://arxiv.org/html/2605.21421v1). **Proposed difference:** jointly controlled speed accuracy and Android deployment under one capture/feature/split contract. Adding familiar architectures or replacing iOS with Android alone is not novel.

Required experiment: fair constant/linear/tree/kernel/MLP baselines and justified temporal candidates; training-only preprocessing and comparable tuning budgets. Participant-count learning curves and context/normalization ablations explain differences. Measure exported model bytes, peak memory, feature/pose/downstream/end-to-end latency, sustained thermal behavior and golden prediction parity on approved test devices. Freeze deployment-available windows independently of reference crossing duration. A result may favor a simple model; do not presume deep models win. Final family count is panel pending.

### C5. Matched phone-domain transfer — empirical hybrid

**Safe proposal wording:** “GaitSense proposes to quantify how handset and capture variation affect walking-speed prediction error and availability while keeping participant identity separated from model development.”

Starting evidence: P02/P08/P09; no matched cross-phone scientific experiment exists. Closest comparisons: [S05](https://www.mdpi.com/2306-5354/11/2/141), [S06](https://journals.plos.org/digitalhealth/article?id=10.1371/journal.pdig.0000467), [S10](https://arxiv.org/html/2605.21421v1). **Proposed difference:** matched person/condition handset contrasts plus genuinely unseen-person/withheld-device evaluation, with coverage rather than accepted-trial error alone.

Required experiment: agree device classes/resources first; balance/order devices, sessions and pace; record actual camera/lens/codec/setup. Same person's trials stay in one outer partition. Repeated walks introduce biological variation: synchronized recordings, if feasible and approved, or counterbalanced repetitions with session uncertainty must address it. Analyze paired device contrasts separately from held-out-device generalization. Do not confound a handset with an exclusive set of participants or call camera-angle effects phone effects. Engineering multi-device reliability testing is independently required even if this research extension is deferred.

**Final wording gate:** present-tense “evaluates,” “demonstrates” or “improves” for C3–C5 becomes defensible only after the named studies exist. Until then use “proposes.” C1/C2 are implementation claims with device-acceptance limits, not clinically accurate measurements. Do not promote category B to A merely by completing code.

## 7. Combined contribution and testable literature gaps

**Inference:** an integrated contribution could combine local Android capture/analysis, saved evidence-source contracts, participant-separated speed learning, honest failure/coverage reporting and matched deployment experiments. No identical end-to-end package was identified in this bounded reviewed set. That does **not** prove novelty. [S10](https://arxiv.org/html/2605.21421v1) and [S11](https://arxiv.org/html/2609.22619v1) substantially narrow any broad systems/reliability claim.

The combination needs an answerable scientific question and a measured advantage or a useful negative finding. Listing standard features is insufficient. The thesis can contribute a reproducible benchmark and integration even when originality is empirical rather than architectural, if the supervisor/panel accepts that standard.

| Question retained from this review | Why it is worth testing, rather than an established absence | Study needed |
| --- | --- | --- |
| Do quality policies improve speed error at useful participant-balanced coverage? | S11/S12 prevent a general abstention novelty claim; endpoint-specific behavior remains unsettled here | C3 with independent labels and full funnel; predeclare coverage constraints |
| Can compact models match temporal models as participant count increases? | S01 supplies an important prior comparison, not a universal winner for GaitSense's domain | C4 grouped learning curves; participant counts, not frame counts, on x-axis; fixed held-out people |
| Does handset shift change error or availability beyond capture variation? | S05's placement evidence cannot answer model-to-model phone transfer | C5 matched/counterbalanced design plus separate withheld-device test |
| What changes after export to Android? | S10 makes mobile pipeline benchmarking established; GaitSense parity and speed-model resource costs remain unknown | C4 numerical parity, accepted-output agreement and end-to-end timing, including failures |
| Do explicit capture-evidence contracts prevent unsupported outputs without excessive loss? | S11 narrows reliability claims; serialized assertion conflicts are a different, unmeasured mechanism | C1 fault/availability experiment and blinded reason audit; do not equate assertions with correct anatomy |

A comprehensive review is still needed before publication-level novelty: backward/forward citation search from S01/S06/S09/S10/S11, comparable app source/supplement inspection, selective **regression** in gait, measurement/data-provenance systems outside gait, and matched smartphone-video domain testing. Refresh recent preprints and publication versions before defense. Failure-ledger completeness must be checked in supplements rather than inferred from abstracts. Public-dataset licence, raw-video access, independent label correspondence, governance and protocol compatibility need a separate suitability decision; finding S07 does not approve it.

## 8. Claims we should NOT make

- First smartphone gait app, first low-cost markerless system, first MediaPipe gait system, first offline pose app, first fully on-phone gait pipeline, or first participant-independent speed learner: related work above already prevents these broad assertions.
- Five proven novel contributions, a new pose network/new ML architecture, or a completed broad benchmark: current evidence does not establish them.
- Clinically accurate gait analysis; diagnosis, disease classification, fall risk, treatment benefit or validated longitudinal health monitoring: **NOT_EVALUATED** and no applicable clinical study.
- Validated gait-event detection, heel strike/toe off, step/stride/cadence measurement, 3D knee angles or anatomical ground truth from current projected/candidate outputs.
- Exact physical event timing from requested Android timestamps; nominal FPS as qualified PTS; source-image or participant authentication from session UUIDs/hashes.
- Universal walking-speed prediction or recovery of metric scale from arbitrary monocular coordinates. Learned speed is a conditional empirical target, pending independent reference qualification.
- Guaranteed privacy/anonymity, encrypted/research-compliant storage or consent established by local inference/raw deletion alone. Skeletons and metadata still require governance and a defined threat model.
- “Other gait papers never report failures,” “subject-independent testing is rare,” “quality gating is new,” or “cross-phone robustness has never been studied”: this focused sample cannot establish those prevalence/absence claims.
- Superior error/runtime/robustness to a published system without comparable data/reference, accepted-case denominators, workloads and hardware. Pretrained-model speed numbers and simulated-gait accuracies are not GaitSense results.
- Scientific adequacy from 40–60 participants, millions of frames, a synthetic validator PASS or a polished demo; exactly ten mandatory models without a recorded panel decision.
- An approved V2 manifest, reference timing method, ethics/consent/retention policy or public-dataset permission. Predictions, instructions and candidate extrema never become ground truth.

## 9. Next milestones and preservation of both tracks

**Next no-phone task:** prepare a concise supervisor meeting agenda/decision sheet from this review and the existing brief. Bring conditional C1–C5 wording, closest comparators, resource/timeline choices and the questions below. Record actual answers after the meeting; do not pre-fill approval. No phone, smoke-test video or research dataset is required for that preparation.

Application track still requires newest-APK physical acceptance; capture and failure-state reliability; History/persistence/restart/offline testing; saved-analysis correctness; UX/accessibility; multi-device tests; later selected-model integration and Python/app parity; runtime/thermal/memory checks; final release/demo readiness.

The separate pending acceptance artifact remains `frontend/android/app/build/outputs/apk/release/app-release.apk`, package `com.gaitsense.research`, built from `f99c95d807c6d16c7a0223ca5451077427160197`, SHA-256 `ea14cded9e2cb6490f878f9cb7f4b857b649899e2bb2e495d0bcc0498b729519`. It needs a phone and one fresh **engineering** walk with explicit direction/upright choices, saved/reloaded knee/candidate/interval inspection and offline reopen. It is not research dataset collection. No rebuild is part of this review.

ML track still requires supervisor/panel scope, authentic institutional/governance decisions, qualified independent reference and observers, stable research capture/linkage, approved pilot and main cohort, versioned features/splits, model comparisons, held-out testing, learning curves/robustness, and reproducibility/novelty evidence. **Do not start large research collection** before those protocol/reference/governance/capture gates. Source deletion and research evidence retention need an explicit separate design decision. App and ML milestones continue together; neither is secondary.

## 10. Questions to confirm with supervisor

For Monday, 12 October 2026; answers/decision owner/date remain blank until actually supplied:

1. Are systems/application contributions acceptable alongside a rigorous learned-model contribution?
2. Is a new ML algorithm or architecture mandatory, or is a well-designed empirical benchmark sufficient?
3. Can novelty be empirical/system/evaluation novelty rather than algorithmic novelty?
4. How many contribution points does the panel expect, and can established engineering work be identified separately from novelty?
5. Does the panel require a minimum model count? If so, what count and what defines a distinct family, and is scope downstream regression, pose backbones or both?
6. Is trial-average speed regression for unseen participants acceptable as the primary ML question?
7. Is matched cross-device scientific evaluation valuable enough to count as a contribution, and which device classes/resources are feasible?
8. Is privacy/local processing a contribution or an implementation property, and what evidence/threat model is expected?
9. Which published baselines must be reproduced or compared, and what constitutes a fair comparison when data/reference/hardware differ?
10. Is the expectation publication-level novelty or undergraduate-thesis-level contribution?
11. Must every claimed novelty be experimentally demonstrated before defense, including provenance, coverage and deployment claims?
12. Which of C1–C5 should be core versus conditional extensions given the defense timeline?
13. Who approves the reference method, course/crossing rule, observer disagreement/adjudication and institutional consent/retention route, and when must these gates close?
14. What pilot/main cohort, repeat-session structure and capture variant should be reviewed, without treating current planning ranges as guaranteed sample adequacy?
15. Should S07 or another public dataset be investigated, and what licence, independent-label and domain-compatibility evidence is required before use?

## 11. Local verification record

Only this Markdown document is created by Task 6. No Android/production source, earlier planning contract, protocol, V1 checker, synthetic validator or fixture is changed. No training, real media/participant use, collection, model artifact generation, APK build, staging, commit or push is performed.

Verification after writing: **24 internal link occurrences / 23 unique targets** passed existence and applicable heading checks; **13 bibliography IDs** are unique. Nine DOI identities and four non-DOI stable records were verified as described in section 4, with endpoint access limitations retained. `git diff --check` and explicit new-file whitespace checks passed. All **330 pre-existing file digests matched** the starting snapshot, including unrelated reconciliation, Android test, V1 checker, protected verification script and release APK. Only this new untracked Markdown file was added; the Git index remains empty and HEAD unchanged. These checks do not establish scientific acceptance.
