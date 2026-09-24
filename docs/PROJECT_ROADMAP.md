# GaitSense: one-year product and research roadmap

Status date: 9 August 2026

## 1. Executive decision

GaitSense should be developed as a **gait measurement and longitudinal screening
platform first**, not as a disease-diagnosis app. A defensible one-year result is:

> A cross-platform application that captures a standardized walking video, rejects
> unsuitable recordings, estimates a validated subset of gait measurements, explains
> them with uncertainty, tracks change over time, and has been compared with a clinical
> reference method in a supervised pilot study.

Parkinson's diagnosis, stroke classification, depression/anxiety detection, and a
general-purpose clinical “health score” are later research goals. Presenting these as
working medical claims before suitable data and clinical validation would be unsafe and
scientifically unsupported.

## 2. Honest current status

The repository contains a useful foundation, but not a functioning gait-analysis
system yet.

| Workstream | Current state | Approximate completion |
|---|---|---:|
| Product definition | Broad proposal; clinical indication not narrowed | 10% |
| Frontend | Responsive interactive prototype with mocked reports | 15% |
| Database | Strong schema, validators, indexes, Atlas deployment | 55% |
| Backend/API | Typed frontend boundary only; no FastAPI service | 2% |
| Video storage/processing | Not implemented | 0% |
| Pose and gait features | Not implemented | 0% |
| ML models | Placeholder model records only | 0% |
| Data collection | No approved protocol or paired ground truth | 0% |
| Clinical validation | Not started | 0% |
| Production/security/operations | Initial database guidance only | 5% |

Across the complete research-to-pilot product, the project is roughly **5% complete**.
The exact number matters less than recognizing that data quality and validation will
take more effort than the screens and database combined.

## 3. Scope: what belongs in year one

### Release A — engineering alpha

- Accounts, consent, and participant profiles.
- Guided side-view capture using a fixed protocol.
- Secure upload to object storage.
- Automated video-quality checks.
- Server-side pose extraction with stored version and confidence.
- Deterministic gait-feature extraction.
- Processing status, reports, history, deletion, and audit records.

### Release B — research MVP

- Cadence and step count.
- Left/right temporal symmetry and variability.
- Knee flexion range and hip-angle range from the supported view.
- Trunk lean and arm-swing range/symmetry.
- Quality-aware reference ranges and change-from-personal-baseline.
- Clinician-reviewed, low-risk exercise education.
- A paired validation study against manual or laboratory references.

### Explicitly deferred until evidence supports them

- Diagnosing Parkinson's disease, stroke, depression, or anxiety.
- Claiming that a single score represents overall health.
- Automated treatment plans.
- Fall-risk classification for unsupervised elderly users.
- Reliable absolute stride length or walking speed without spatial calibration.
- Ground-contact and double-support time from unsuitable frame rates or camera views.
- Multi-person analysis and arbitrary camera angles.

The UI may show these as research goals, but production reports must not imply that
unvalidated outputs are available.

## 4. Critical feasibility corrections

### Dataset mismatch

The proposed public datasets are useful, but not in the way initially described:

| Dataset | What it actually supplies | Appropriate GaitSense use | Not valid for |
|---|---|---|---|
| PhysioNet Gait in Parkinson's Disease | Under-foot force-sensor signals from 93 Parkinson's participants and 73 controls | Learn established temporal features; independent research benchmark | Directly training a camera-pose classifier |
| CASIA Gait | Videos/silhouettes for identity recognition across views and conditions | Stress-test person tracking, viewpoint, clothing, and background robustness after licence review | Clinical health labels or disease validation |
| CMU Motion Capture | Laboratory motion sequences, including walking | Verify angle calculations and feature-code behavior on clean motion | Population-level clinical claims |
| “PhysioNet Fall Risk” | The proposal does not identify an exact accession and label definition | Must be identified and licence/endpoint audited first | Training until provenance is resolved |
| Local volunteer videos | Potentially matched to the real product modality | Primary development/validation source if consented and independently labelled | Self-labelled disease or clinical ground truth |

The project needs a new **paired camera dataset** recorded with the same protocol as
the app and a trustworthy reference: physiotherapist rating, timed walkway, manual
event annotation, motion capture, gait mat, or force plate depending on the endpoint.

### Measurement limits

- A monocular image has no guaranteed metric scale. Absolute stride length and speed
  need a known walkway length, calibration marker, camera calibration, or a separately
  validated scale-recovery method.
- Side and frontal recordings reveal different features. Year one should standardize
  one primary side view. A separate frontal protocol can be added only after the first
  view is stable.
- Pose “world” coordinates are model estimates, not clinical 3D motion capture.
- Contact events and foot clearance are sensitive to frame rate, motion blur, shoes,
  occlusion, and the camera position.
- The system must be allowed to say **“unable to measure reliably—record again.”**

## 5. Target system architecture

```text
Expo mobile app / responsive web app
        |
        | HTTPS + access token
        v
FastAPI API service ---------------------- MongoDB Atlas
        |                                  metadata, status, features,
        | presigned upload                 reports, consent, audit
        v
Private object storage
raw video + derived overlays
        |
        v
Job queue / worker
quality checks -> pose extraction -> gait events -> features -> approved scoring
        |                                      |
        v                                      v
versioned model/artifact storage          monitoring + evaluation logs
```

### Repository structure to reach

```text
GaitSense/
├── frontend/                 Expo Router: Android, iOS, web
├── backend/                  FastAPI, auth, ownership, orchestration
├── pipeline/                 video, pose, gait events, feature extraction
├── ml/                       datasets, experiments, evaluation, model cards
├── database/                 MongoDB schema and migrations
├── infrastructure/           Docker, CI, deployment configuration
├── tests/                    contract and end-to-end fixtures
└── docs/                     protocol, architecture, risk, research reports
```

### Technology choices

- Frontend: Expo/React Native/TypeScript with Expo Router.
- Initial pose processing: Python worker using MediaPipe on the server. This makes
  algorithms easier to reproduce and validate across platforms.
- Later on-device pose: a native MediaPipe Tasks integration in an Expo development
  build after feature definitions stabilize. Do not make Expo Go a production
  constraint.
- API: FastAPI, Pydantic, async MongoDB driver, OpenAPI contracts.
- Queue: Redis plus Celery, Dramatiq, or RQ. Keep job execution outside API workers.
- Media: private S3-compatible object storage using short-lived presigned URLs.
- ML: NumPy, pandas, scikit-learn, XGBoost only when it beats simpler baselines.
- Experiment tracking: MLflow or equivalent, with dataset and feature versions.
- Delivery: Docker, GitHub Actions, staged environments, EAS development builds.

The mobile/web client must never receive an Atlas connection string or communicate
directly with MongoDB.

## 6. Twelve-month roadmap

Each month ends in a gate. If a gate fails, correct the foundation rather than adding
another health claim.

### Month 1 — intended use, protocol, and engineering baseline

**Product and clinical**

- Choose one primary user and indication: recommended starting point is gait
  self-monitoring for adults who can walk independently.
- Recruit a licensed physiotherapist as clinical adviser and a biostatistics adviser.
- Write intended use, exclusions, contraindications, and escalation language.
- Define a side-view capture protocol: distance, phone height, frame rate, lighting,
  clothing, walkway, direction, repeats, and assistance rules.
- Define the first measurable endpoints and their reference methods.
- Create risk register, data management plan, participant information, and consent.
- Seek university ethics/IRB approval before collecting research participant data.

**Engineering**

- Establish issue tracking, pull-request review, branch policy, coding standards, and
  environment separation.
- Add CI for frontend/database and skeleton backend tests.
- Define API contracts and shared error/status vocabulary.
- Create a formal architecture decision record for server-side versus on-device pose.

**Gate 1:** signed product requirements, capture protocol v1, endpoint table, clinical
reviewer, ethics submission plan, and passing CI.

### Month 2 — FastAPI, authentication, and private media storage

- Scaffold FastAPI with configuration validation, health/readiness endpoints, logging,
  OpenAPI, and Docker.
- Implement signup/sign-in, password hashing, refresh-token rotation, logout, and
  ownership enforcement.
- Connect the existing collections through repository/service layers.
- Implement consent/profile/session APIs.
- Add private object storage and presigned upload/download flow.
- Add rate limits, request IDs, structured audit events, and secret management.
- Connect the frontend to development API responses; remove mock identity state.

**Gate 2:** a test user can consent, create a session, upload a harmless fixture,
retrieve only their own metadata, log out, and delete the session.

### Month 3 — capture workflow and video-quality gate

- Replace the camera prototype with a state machine: prepare, permission, countdown,
  record, preview, upload, retry, processing, result.
- Record device metadata, orientation, resolution, FPS, duration, and protocol version.
- Implement checks for duration, full-body visibility, single person, brightness,
  blur, occlusion, framing, camera motion, and usable frames.
- Provide immediate, specific retake instructions.
- Test low-, mid-, and high-range Android devices plus mobile/desktop browsers.
- Add an offline upload queue and interruption recovery where feasible.

**Gate 3:** at least 90% of internally staged valid videos pass and intentionally bad
videos fail for the correct documented reason; no partial uploads become assessments.

### Month 4 — reproducible pose pipeline

- Build a worker that downloads a video, decodes frames deterministically, and runs
  MediaPipe Pose Landmarker.
- Normalize landmarks, visibility, timestamps, handedness/view direction, and frame
  coordinates.
- Add temporal smoothing without hiding real movement events.
- Store bounded pose chunks and extractor version in the existing schema.
- Produce a stick-figure/landmark overlay for developer review.
- Build a labelled set of failure examples and pose-quality metrics.

**Gate 4:** repeated processing of the same fixture is reproducible within tolerance;
pose overlays and quality failures are manually reviewed on the device test matrix.

### Month 5 — gait-event and feature extraction

- Detect walking interval, heel-strike candidates, toe-off candidates, and left/right
  cycles using a documented signal-processing method.
- Implement cadence, step count, temporal symmetry, cycle variability, knee range,
  hip range, trunk lean/sway, and arm-swing range/symmetry.
- Mark features unavailable when view, visibility, or cycle count is insufficient.
- Add unit tests with synthetic trajectories and regression tests with frozen videos.
- Create feature definitions with units, reference frame, confidence, supported view,
  algorithm version, and known limitations.
- Compare event annotations from two human reviewers on a representative sample.

**Gate 5:** every reported feature has a definition, test, confidence rule, failure
behavior, and preliminary comparison against human annotations.

### Month 6 — end-to-end engineering alpha

- Orchestrate upload -> job -> pose -> feature -> report -> notification.
- Add retry-safe jobs, idempotency keys, timeouts, dead-letter handling, and cleanup.
- Replace all frontend mock assessment data with API data.
- Add progress comparison only when protocol/feature versions are compatible.
- Add accessibility, Bangla-ready localization infrastructure, low-bandwidth behavior,
  and user-facing deletion.
- Conduct internal usability testing and threat modelling.

**Gate 6:** ten team-controlled participants can complete the full flow without manual
database edits; failures are recoverable and visible; deletion removes media and
derived records according to policy.

### Month 7 — approved local pilot data collection

- Begin collection only after ethics/consent approval.
- Record at least two or three walks per participant to measure repeatability.
- Capture the paired reference measurement on the same visit.
- Have trained assessors label quality and events without seeing model output.
- Track cohort, device, environment, sex, age band, mobility status, and missingness
  while minimizing identifiable data.
- Freeze raw data; create versioned, de-identified analysis manifests.
- Audit every public dataset's licence, population, modality, labels, and allowed use.

**Gate 7:** dataset v1 has consent/provenance for every record, no unresolved identity
leakage, documented exclusions, assessor agreement, and an immutable split manifest.

### Month 8 — statistical baselines and model development

- Start with rules and linear/logistic regression; compare Random Forest and XGBoost
  only afterward.
- Split by participant, never by video or step, to prevent leakage.
- Keep an untouched evaluation set and, ideally, a distinct external/temporal cohort.
- Report uncertainty and calibration, not accuracy alone.
- Evaluate continuous measurements with error, bias, agreement, and repeatability.
- Evaluate flags with sensitivity, specificity, ROC/PR curves, predictive values, and
  calibration at a declared threshold.
- Evaluate performance across device type and meaningful demographic subgroups.
- Implement abstention for out-of-distribution or low-confidence samples.
- Version data, code, features, parameters, artifacts, thresholds, and model cards.

**Gate 8:** a reproducible experiment report shows that a chosen model improves on a
simple baseline without leakage; otherwise ship the simpler method.

### Month 9 — measurement and clinical validation

- Run a prespecified blinded analysis against reference measurements.
- Quantify capture failures, pose failures, feature errors, repeatability, and subgroup
  performance separately.
- Validate the complete pipeline, not only a model on pre-cleaned features.
- Calibrate user-facing categories and confidence thresholds.
- Ask clinicians to review false negatives, false positives, and unsafe advice.
- Remove or relabel any endpoint that misses its acceptance target.

**Gate 9:** validation report and limitations are approved by the clinical/statistical
advisers. No score reaches users merely because it “looks reasonable.”

### Month 10 — trustworthy reporting and longitudinal experience

- Replace the arbitrary overall score with validated per-domain measures, or publish a
  transparent, evidence-backed composite if one has been justified.
- Show measurement confidence, capture quality, change beyond expected measurement
  error, and the relevant comparison population.
- Add clinically reviewed explanations, red-flag escalation, and safe exercise content.
- Add Bangla and English localization with clinician review of translations.
- Implement reminders, history filters, accessible charts, and report export/share
  controls.
- Conduct usability studies with target users and physiotherapists.

**Gate 10:** users can explain what a result does and does not mean; recommendations
contain no unsupported diagnosis or treatment claim.

### Month 11 — production hardening

- Automated unit, integration, contract, end-to-end, load, and recovery tests.
- Device/browser accessibility matrix and network-interruption testing.
- Encryption, least-privilege service accounts, backup/restore drill, credential
  rotation, dependency scanning, penetration testing, and incident response runbook.
- Production observability for API latency, job failures, quality failure rates, model
  drift, storage, and cost—without logging sensitive video or landmarks.
- Define retention, account deletion, consent withdrawal, and research-data handling.
- Obtain a Bangladesh-specific legal/regulatory assessment before public health claims.

**Gate 11:** release candidate passes security/privacy review, restore drill, load
target, device matrix, and safety checklist with zero unresolved critical defects.

### Month 12 — supervised pilot and thesis/project delivery

- Deploy a staged pilot with feature flags and an immediate rollback path.
- Monitor technical failures, subgroup behavior, user comprehension, and adverse events.
- Freeze v1 artifacts and produce model cards, dataset cards, system card, architecture,
  API docs, data dictionary, validation report, and user manual.
- Prepare demonstration, poster/paper/thesis, reproducible evaluation notebook, and
  limitations/future-work chapter.
- Decide from evidence whether to expand to fall risk, neurological cohorts, frontal
  capture, or on-device inference.

**Gate 12:** reproducible supervised research MVP and evidence package. Public medical
deployment is a separate decision requiring the applicable regulatory pathway.

## 7. Clinical and ML evaluation plan

### Define each endpoint before collecting data

For every output record:

1. Intended population and exclusions.
2. Capture protocol and supported view.
3. Clinical/biomechanical definition.
4. Reference instrument or assessor.
5. Unit and plausible range.
6. Minimum usable cycles and visibility.
7. Acceptance threshold and uncertainty.
8. Known confounders.
9. User-facing interpretation and escalation.

### Data-split rules

- One participant belongs to exactly one of train, tuning, or evaluation.
- Multiple walks, directions, and frames from one participant stay together.
- Fit normalization, imputation, selection, and thresholds using training data only.
- Document all exclusions before inspecting final evaluation results.
- Do not balance away real prevalence when reporting predictive values.

### Suggested metric families

| Output | Required evidence |
|---|---|
| Continuous feature | MAE/RMSE, bias, limits of agreement, ICC/repeatability, failure rate |
| Binary flag | Sensitivity, specificity, AUROC, AUPRC, PPV/NPV at declared prevalence, calibration |
| Category/score | Calibration, ordinal agreement, decision-curve or utility rationale |
| Full pipeline | Capture rejection, processing failure, latency, coverage, subgroup results |

TRIPOD+AI should guide prediction-model reporting. DECIDE-AI becomes relevant if the
system reaches early live clinical decision support evaluation.

## 8. API and backend delivery map

Minimum API groups:

- `/auth`: register, verify, login, refresh, logout, password recovery.
- `/users/me`: identity, settings, export, account deletion.
- `/profiles`: participant context and eligibility.
- `/consents`: current documents and signed version history.
- `/walk-sessions`: create, status, list, detail, cancel, delete.
- `/uploads`: presigned upload completion and integrity confirmation.
- `/assessments`: report, breakdown, flags, confidence, model lineage.
- `/progress`: comparable history and baseline changes.
- `/recommendations`: reviewed assignments and completion state.
- `/admin/research`: tightly controlled dataset/export tools; never part of a normal
  user token.

Every resource read/write must check authenticated ownership. The API, queue, and
worker must use separate least-privilege credentials.

## 9. Team and equipment needed

### Minimum team

| Role | Responsibility | Suggested allocation |
|---|---|---:|
| Product/technical lead | scope, architecture, integration, delivery | 1 full-time student |
| Mobile/web engineer | Expo capture and experience | 1 full-time student |
| Backend/platform engineer | API, storage, queue, deployment | 1 full-time student |
| Computer-vision/ML engineer | pose, events, features, evaluation | 1 full-time student |
| Physiotherapist/clinical adviser | protocol, labels, safety, interpretation | weekly/part-time |
| Biostatistics/research adviser | design, sample size, validation | milestone reviews |
| Security/privacy adviser | threat model and pre-pilot review | milestone reviews |

If the student team is smaller, reduce scope—do not remove independent clinical and
statistical review.

### Physical resources

- Tripods/phone stands and floor markers.
- Measuring tape and a marked 4–6 metre level walkway.
- At least three Android performance tiers; access to an iPhone if iOS is promised.
- Stable and deliberately poor lighting environments for robustness testing.
- Encrypted research storage and controlled lab workstation.
- Borrowed/partner access to a gait mat, force plate, motion capture, or validated
  manual reference procedure for selected endpoints.

### Cloud and software resources

- Git hosting and protected CI.
- Separate development, staging, and production environments.
- MongoDB Atlas for metadata, not raw video.
- Private object storage with lifecycle rules.
- Redis-compatible queue and CPU/GPU worker capacity after benchmarking.
- Error monitoring, metrics, alerting, dependency scanning, and encrypted backups.
- EAS or local native build tooling once native pose/secure storage is introduced.

## 10. Quality and release gates

No public pilot until all are true:

- Intended use and exclusions are visible in product and documentation.
- Consent, withdrawal, export, and deletion work end to end.
- Raw videos are private, access-controlled, and absent from logs/source control.
- Low-quality or unsupported captures abstain instead of generating confident scores.
- Feature definitions and model/data versions are traceable from every assessment.
- Validation includes participant-level separation and subgroup/failure analysis.
- Recommendations are reviewed, versioned, and conservative.
- Backup restoration and incident response have been exercised.
- Clinical, statistical, privacy, and regulatory reviewers approve the release scope.

## 11. Major risks and mitigations

| Risk | Impact | Mitigation |
|---|---|---|
| Public data do not match phone videos | Invalid model | Collect paired product-modality data; use public data only for appropriate auxiliary tests |
| Too many clinical claims | No endpoint validated well | Freeze a narrow MVP and promote outputs one at a time |
| Scale/viewpoint distort features | Misleading measurements | Standardized protocol, calibration, quality rejection, per-view algorithms |
| Participant leakage | Inflated test results | Immutable participant-level splits and reproducible pipelines |
| Small/local cohort | Poor generalization | Report uncertainty, abstain, test devices/subgroups, seek external validation |
| Health video breach | Serious privacy harm | Private object storage, least privilege, encryption, retention/deletion, audit |
| Low-end phone/network failure | Excludes target users | Device matrix, compressed resumable uploads, offline recovery, server processing |
| Arbitrary health score | False reassurance/alarm | Prefer validated measures; document any composite derivation and calibration |
| Advice causes injury/delay in care | Safety harm | Clinical review, exclusions, stop rules, red-flag escalation, no diagnosis |
| Research demo mistaken for medical product | Regulatory/reputation risk | Intended-use controls, evidence labels, legal review, gated production models |

## 12. The next two-week sprint

This is the immediate order of work.

### Product/research

1. Write a one-page intended-use statement and choose the exact year-one endpoints.
2. Schedule a physiotherapist review of the capture protocol and report language.
3. Create the dataset inventory/licence sheet and remove “direct training” claims for
   mismatched datasets.
4. Draft ethics, consent, exclusion, safety, and paired-reference plans.
5. Define measurable acceptance targets for video quality and the first three features.

### Engineering

1. Create `backend/` with FastAPI, settings validation, tests, Docker, and health route.
2. Add CI that runs database checks, frontend type/build checks, and backend tests.
3. Implement Atlas repository wiring without exposing credentials to the frontend.
4. Implement user/session ownership and a temporary development authentication flow.
5. Select private object storage and build a presigned upload proof of concept.
6. Define the session-processing state machine and API contract.
7. Connect one frontend screen to a real backend endpoint.
8. Add one frozen walking-video fixture and a CLI experiment that produces pose JSON
   plus an overlay video; do not build a classifier yet.

### Sprint definition of done

- A teammate can clone the repository, configure example environment files, start the
  database and backend, run the web client, and pass all checks from documented commands.
- The frontend can create a real empty walk session through FastAPI.
- A fixture video can be processed into versioned pose landmarks offline.
- No health score is produced from dummy logic.

## 13. Definition of year-one success

The project is successful if it delivers a reproducible, honest and validated research
MVP—not if it displays the largest number of disease labels. A strong final result will
show:

- standardized capture that ordinary users can complete;
- transparent quality rejection;
- a small set of measurements with quantified agreement and repeatability;
- secure end-to-end data handling;
- meaningful personal progress tracking;
- clinician-reviewed interpretation;
- clear limitations and a credible next clinical study.

## References consulted

- [Google MediaPipe Pose Landmarker](https://ai.google.dev/edge/api/mediapipe/python/mp/tasks/vision/PoseLandmark): 33-landmark pose representation.
- [PhysioNet Gait in Parkinson's Disease v1.0.0](https://physionet.org/content/gaitpdb/1.0.0/): force-sensor modality, cohort, and licence.
- [CASIA Gait Database](http://www.cbsr.ia.ac.cn/english/Gait%20Databases.asp): gait-recognition purpose and dataset variants.
- [Bangladesh DGDA Registration Guidelines for Medical Devices](https://dgda.gov.bd/sites/default/files/files/dgda.portal.gov.bd/policies/802ec167_9ba7_4f1b_adde_88871d797f08/2024-02-15-08-52-970321e5d385df48394bdd2d06110efa.pdf): software may fall within the medical-device definition when intended for specified medical purposes.
- [WHO Ethics and Governance of Artificial Intelligence for Health](https://www.who.int/publications/b/58847).
- [FDA/IMDRF Software as a Medical Device clinical-evaluation principles](https://www.fda.gov/medical-devices/software-medical-device-samd/global-approach-software-medical-device).
- [TRIPOD+AI](https://www.bmj.com/content/385/bmj-2023-078378): reporting guideline for clinical prediction models.
- [DECIDE-AI](https://www.nature.com/articles/s41591-022-01772-9): reporting guideline for early-stage clinical AI evaluation.
- [Expo development builds](https://docs.expo.dev/develop/development-builds/introduction/): production/native-library workflow.
