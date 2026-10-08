# Public gait dataset suitability audit

9 October 2026 · Sprint 6 · Research audit only · **NOT_EVALUATED**.
Model: GPT-6.1 Sol; reasoning: High. Phone: no; engineering video: no;
research dataset access/download: no. Reviewed HEAD:
`9d626967ff8b995e0a0c61f8d71eada7ffa24794`.

**Recommendation:** preserve an own-cohort primary study proposal; investigate
Health & Gait and the Insole–GAITRite release for separate secondary/development
roles. Health & Gait's published release does not supply raw RGB or synchronized
clip-speed references; Insole–GAITRite remains unqualified. Do not acquire data until
licence/access, reference correspondence, intended role and supervisor approval
are resolved. No public replacement for the own-cohort study is established here.

## Working criterion and project contracts

The working target is **proposed, not supervisor-approved**, trial-average walking
speed regression for unseen participants using consumer-camera pose data. Review
sources: [ML roadmap](ML_THESIS_READINESS_AND_EXPERIMENT_PLAN.md),
[supervisor brief](ML_SUPERVISOR_DECISION_BRIEF.md),
[speed reference SOP](WALKING_SPEED_REFERENCE_SOP_DRAFT.md),
[V2 proposal](RESEARCH_MANIFEST_V2_PROPOSAL.md),
[V2 invariants](RESEARCH_MANIFEST_V2_INVARIANTS.md),
[timing qualification](REFERENCE_TIMING_AND_ANNOTATION_QUALIFICATION.md), and
[related-work audit](GAITSENSE_NOVELTY_AND_RELATED_WORK_REVIEW.md).

Own reference proposal: independently measured zone distance / accepted crossing
duration. Neither reference distance, crossing duration, target, observer decisions,
reference-selected window length nor participant identity may enter predictors.
Qualified PTS or independently synchronized external timing require review;
nominal FPS and Android requested sample timestamps are not physical reference clocks.
Public sensor labels need a separately reviewed equivalence/adaptation decision;
they do not automatically satisfy the own-cohort dual-observer SOP. V2 remains a
proposal, not a production ingestion route. Hashes establish bytes, not consent or
anatomical correctness. Adult-cohort, capture, retention and protocol decisions
remain pending; historical engineering videos are not scientific validation data.

Planning ranges remain 8–12 pilot participants with 4–6 trials, 40–60 thesis aim
with 6–10 trials, possible 80–120+ expansion. They are not approved targets, power
calculations or guaranteed sufficient sizes. Public people do not automatically
reduce these ranges. Exact model count and pose-backbone scope remain pending.
App acceptance is engineering evidence; both App and ML tracks remain required.

## Search and evidence method

Targeted searches combined gait, RGB/video, measured speed, GAITRite, participant
IDs and synchronized reference systems; search was not restricted to MediaPipe.
Four serious candidates were inspected: two possible video/reference routes and
two informative method-only contrasts. No fixed catalogue size was forced.
Search hits for inertial-only walking, identity recognition, unavailable clinical
video and other mocap collections were discovery leads, not verified candidates.
No claim of exhaustive coverage or novelty follows.

Sources below are primary papers, author repositories and official records.
All access dates: **9 October 2026**. Search snippets alone were not accepted.
HTML, documentation and repository metadata were inspected; no archives, samples,
CSV records, image/frame files or videos were downloaded. Some publisher/browser
routes failed; successful alternatives and unresolved fields are recorded below.
**NR** = not reported in inspected sources; **UNKNOWN** = unresolved/conflicting or
not verified against files. Counts describe source reports, not locally counted files.

### Bibliographic identity and source registry

| ID | Primary identity | Official access and additional inspected sources |
| --- | --- | --- |
| H / S07 | Zafra-Palma et al., *Health & Gait: a dataset for gait-based analysis*, Scientific Data 12:44, **2025**, DOI 10.1038/s41597-024-04327-4 | [Paper, PMC](https://pmc.ncbi.nlm.nih.gov/articles/PMC11724122/); [publisher](https://www.nature.com/articles/s41597-024-04327-4); [Zenodo record](https://zenodo.org/records/14039922), DOI 10.5281/zenodo.14039922; [author repository](https://github.com/AVAuco/healthgait); [DUA](https://github.com/AVAuco/healthgait/blob/main/DUA.txt); [code licence](https://github.com/AVAuco/healthgait/blob/main/LICENSE). Dataset record dates from 2024; paper year is 2025. |
| I | Dobrescu et al., *An Open Insole-Based Plantar Pressure Dataset at Varying Cadences Compared Against GAITRite*, **2026**, Zenodo version 1, DOI 10.5281/zenodo.19662017 | [Official record](https://zenodo.org/records/19662017); [linked author tool](https://github.com/MarcosRM02/GaitScope). Dataset record inspected; peer-reviewed companion identity NR, so this is not called a peer-reviewed data descriptor. |
| M | Palermo, Mendes Lopes, André, Cerqueira & Santos, *A multi-camera and multimodal dataset for posture and gait analysis*, **2021**, PhysioNet v1.0.0, DOI 10.13026/fyxw-n385 | [Official descriptor/repository](https://physionet.org/content/multi-gait-posture/1.0.0/); [raw description](https://physionet.org/content/multi-gait-posture/1.0.0/raw_data_description.txt); [processed description](https://physionet.org/content/multi-gait-posture/1.0.0/processed_data_description.txt). Cite the dataset, not unrelated platform references displayed on the page. |
| G | Horst, Slijepcevic, Simak & Schöllhorn, *Gutenberg Gait Database, a ground reaction force database of level overground walking in healthy individuals*, Scientific Data 8:232, **2021**, DOI 10.1038/s41597-021-01014-6 | [Paper, PMC](https://pmc.ncbi.nlm.nih.gov/articles/PMC8413275/); [official Figshare collection](https://springernature.figshare.com/collections/Gutenberg_Gait_Database_A_ground_reaction_force_database_of_level_overground_walking_in_healthy_individuals/5311538/1), DOI 10.6084/m9.figshare.c.5311538.v1; [speed record](https://springernature.figshare.com/articles/dataset/GRF_walking_speed/14095849); [metadata record](https://springernature.figshare.com/articles/dataset/GRF_metadata/14095847). |

## Comparison matrix: identity, capture and scale

The three matrices together constitute one candidate comparison; each field is
explicitly represented without a 35-column table. Evidence links refer to the
source registry; specific unresolved facts are not filled from filenames.

| Field | H: Health & Gait | I: Insole–GAITRite | M: multi-camera posture/gait | G: Gutenberg |
| --- | --- | --- | --- | --- |
| Participants | 398 | 23 in original collection; retained release count NR; noncontiguous IDs intentionally preserve acquisition identity after quality exclusions | 14 healthy | 350 healthy |
| Trials/videos | 1,564 reported videos; final direction-clips versus acquisition trials need reconciliation | Total NR; repeated unidirectional clips | 378 attempted; 15 excluded; remaining 363 by subtraction, not audited count | 8,819 trial rows; 661 session rows |
| Frames | Total NR; not subjects | NR | Approx. 166K synchronized frames, not people | RGB frames not provided |
| Participant IDs / repetitions | PAXXX; usual/fast, jacket/no-jacket, two directions | Participant/condition/clip hierarchy | participant00…13; sequence/location repeats | SUBJECT_ID, SESSION_ID, TRIAL_ID plus DATASET_ID |
| RGB/raw video | Acquisition RGB established; paper explicitly says raw recordings are not provided; listed modalities are derivatives | Anonymized MP4 per clip; original unmodified RGB availability UNKNOWN | Distributed depth, not RGB | No distributed RGB or pose |
| Pose | AlphaPose COCO-17, x/y; null joints possible | Provided pose NR | Xsens 3D; projected 2D skeletons | None in release |
| Camera/device | CASIO EX-ZR1000 | NR | Walker-mounted depth pair; exact camera model/resolution NR in inspected record | Infrared mocap involved in some references; RGB camera NR |
| View/orientation | Side-oriented corridor scene; fixed orientation qualification UNKNOWN | View/orientation NR | Walker-relative views; not stationary sagittal consumer RGB | Video view not applicable |
| Resolution/rate | Capture 1920×1080, 30 Hz; processed 960×540 | Nominal video 30 FPS; resolution NR | Depth 30 FPS; Xsens 60 Hz | RGB FPS/resolution not applicable |
| Conditions / population | Adults 18–64, activity eligibility/exclusions; normal/fast, jacket, both image directions | Own shoes; normal and metronome-guided slow/fast; clinical status/demographics NR | Straight/left/right paths, three locations, commanded 0.3/0.5/0.7 m/s | Level overground, self-selected; multiple source studies |

H evidence: [paper](https://pmc.ncbi.nlm.nih.gov/articles/PMC11724122/) and
[author README](https://github.com/AVAuco/healthgait). I evidence:
[release](https://zenodo.org/records/19662017). M evidence:
[descriptor](https://physionet.org/content/multi-gait-posture/1.0.0/) and
[raw layout](https://physionet.org/content/multi-gait-posture/1.0.0/raw_data_description.txt).
G counts/IDs: [speed item metadata](https://springernature.figshare.com/articles/dataset/GRF_walking_speed/14095849),
[session metadata](https://springernature.figshare.com/articles/dataset/GRF_metadata/14095847).

## Comparison matrix: reference and grouping

| Field | H | I | M | G |
| --- | --- | --- | --- | --- |
| Independent system | OptoGait quantities; MuscleLAB timing-gate speed | GAITRite per walking clip; sensor exports distinct from video | Hardware-triggered Xsens/reference alignment | Light barriers or pelvis-marker mocap |
| Speed field / units | Measured gait_parameters.csv, Speed_UGS/FGS (m/s); paper also says Velocity_UGS in missingness description | Exact exported speed column and units **UNKNOWN** | Commanded speed is not measured participant trial-speed label | WALKING_SPEED; paper-defined m/s |
| Time / distance | 6 m sensor zone described; video-estimation section says 4 m; raw timing events UNKNOWN | Independent distance/time columns UNKNOWN | Synchronization stamps/coordinates; no accepted crossing distance/duration field established | Underlying timed distance/event fields UNKNOWN; some studies use trajectories |
| Target granularity | Participant × pace documented; measured aggregation details UNKNOWN; no synchronized exact-passage target in published design | Per-clip gaitrite_test.csv; condition summary also present, not interchangeable | Kinematic/sample reference, not ready trial-average speed target | Trial-level speed with keys; different measurement routes |
| Media↔reference correspondence | Person join supported; paper states sensor measurements preceded video recording, so published references are not synchronized exact-passage labels | Same clip folder documented; sync_auto.json needs uncertainty/method review | Timestamp indices/calibration support depth↔skeleton mapping | Force trial↔speed keys; RGB join unavailable |
| Grouped evaluation possible? | Yes at person level; label eligibility separate | Yes by documented stable pseudonymous participant hierarchy; retained inventory still needs verification | Yes by participant across all paths | In principle; cross-study subject alias mapping needs review |
| Exact existing split reproducibility | Authors' participant partitions/code exist; speed-specific frozen split not established | Frozen split NR; design only after ledger audit | Frozen train/test split NR | Frozen speed-model split NR |
| Missingness/exclusions | Anthropometry 1.08%, measured gait table 4.19%; speed-specific usable count UNKNOWN | Participant quality exclusions explicitly documented; criteria/counts/rates NR; STAND/SITDOWN omit GAITRite by design | Sensor/file exclusions, sunlight corruption, alignment error disclosed | Speed absent in datasets 6, 8, 10; NaN placeholders |

Reference evidence: H [paper](https://pmc.ncbi.nlm.nih.gov/articles/PMC11724122/);
I [official record](https://zenodo.org/records/19662017);
M [processed description](https://physionet.org/content/multi-gait-posture/1.0.0/processed_data_description.txt)
and [descriptor](https://physionet.org/content/multi-gait-posture/1.0.0/);
G [paper](https://pmc.ncbi.nlm.nih.gov/articles/PMC8413275/) and
[speed item](https://springernature.figshare.com/articles/dataset/GRF_walking_speed/14095849).

## Comparison matrix: access, governance and verdict

Exactly one verdict per candidate. A = strong primary/secondary candidate;
B = promising with critical unresolved facts; C = external/robustness only;
D = auxiliary/method only; E = poor primary match; F = ineligible due to licence/reference.
No candidate receives A because essential input/reference conditions remain unmet.

| Field | H | I | M | G |
| --- | --- | --- | --- | --- |
| Access | Public Zenodo file listing, about 26.8 GB; no acquisition performed | Public record, about 1.7 GB archive; no acquisition | Open versioned PhysioNet listing | Open Figshare items; inspected metadata only |
| Licence | Zenodo API CC BY 4.0 **conflicts with restrictive author DUA**; code GPL-3.0 separate | Zenodo API CC BY 4.0 | Repository CC BY 4.0 | Inspected speed/metadata items CC0; every needed item still must be checked |
| Consent/privacy/reuse | DUA: academic/research, noncommercial, no identification/contact, secure access, no third-party distribution without written permission | Anonymized video; consent/reuse details beyond licence NR | Consent/ethics reported; identifying details withheld | Anonymized release; study-specific secondary-use review still needed |
| Commercial/redistribution | Do not assume CC BY metadata overrides DUA; obtain written clarification | No NC condition in stated licence; personality/privacy rights not thereby resolved | No NC condition in stated licence | No NC condition on inspected items; not a blanket rights assertion |
| Domain mismatch | Controlled camera, COCO-17 versus MediaPipe-33; published raw recordings absent and measured references from earlier passages | Instrumented walkway; view, setting, anonymization effect and camera unknown | Depth, walker-held posture and camera geometry | Force-only; cannot run smartphone RGB pipeline |
| Realistic role | Conditional, separately formulated person/pace feature development; published release ineligible for exact-clip RGB trial-speed validation | Conditional trial-speed development/external validation after export/camera review | Separate pose/feature alignment method study | Separate reference/missingness/aggregation benchmark; not video speed training |
| Verdict | **E — POOR PRIMARY MATCH for exact-clip RGB trial-speed task** | **B — PROMISING, BUT CRITICAL DETAILS NEED VERIFICATION** | **D — USEFUL ONLY FOR AUXILIARY/METHOD VALIDATION** | **D — USEFUL ONLY FOR AUXILIARY/METHOD VALIDATION** |

Licence evidence: [H Zenodo API](https://zenodo.org/api/records/14039922),
[H DUA](https://github.com/AVAuco/healthgait/blob/main/DUA.txt),
[H code licence](https://github.com/AVAuco/healthgait/blob/main/LICENSE),
[I Zenodo API](https://zenodo.org/api/records/19662017),
[M repository](https://physionet.org/content/multi-gait-posture/1.0.0/),
[G speed API](https://api.figshare.com/v2/articles/14095849),
[G metadata API](https://api.figshare.com/v2/articles/14095847).
The licence field is an observed declaration, not approval, ethics exemption or
permission beyond its text. Article licence, software licence and dataset terms
are different objects. No public redistribution in a thesis repo or APK is approved.

## Health & Gait: deeper suitability decision

### Why S07 matters, without granting approval

Its person scale and repeated conditions make grouped research plausible. The
author materials expose demographics (sex, age, activity, height, weight/BMI and
body composition/circumferences) and code for sex classification and age/weight
regression; this is not an established GaitSense speed benchmark. The README's
estimated-table descriptions do not by themselves authenticate measured labels.
[Author source](https://github.com/AVAuco/healthgait).

Published evaluation uses participant-separated four-fold splitting. Demographic
missingness and sensor missingness percentages are cell-level descriptions, not
counts of eligible speed/video pairs. Sensor speed and video-estimated speed must
never be mixed. The paper's 6 m measurement versus 4 m visual-estimation statements
need author reconciliation; neither supplies a GaitSense course default.
[Primary paper](https://pmc.ncbi.nlm.nih.gov/articles/PMC11724122/).

### Published disqualifiers and remaining questions

- **RGB availability:** the paper's Usage Notes explicitly state that raw recordings
  are not provided. Any separate access route requires provider confirmation;
  the current release cannot be assumed to support MediaPipe re-extraction.
- **Reference granularity:** a participant/pace row cannot be copied to each
  direction/jacket clip and called that clip's independent measured speed.
  The paper's Limitations state that measurements were obtained first, then videos.
  This is an established exact-passage mismatch, not a join-key problem alone.
  Ask only whether a separate paired release exists and how current rows aggregate.
  Otherwise define a separate aggregate task or decline trial-speed evaluation.
- **Timing qualification:** require sensor method/calibration, event definitions,
  uncertainty and mapping to the actual passage. Video FPS arithmetic in an
  estimation method does not qualify a physical speed reference.
- **Pose equivalence:** common joints can support a separate feature experiment;
  supplied COCO pose does not replicate MediaPipe visibility/presence semantics.
  Full mobile pipeline comparison needs licensed RGB and pinned re-extraction.
- **Missing pairs:** resolve actual eligible participants/trials, missing-speed
  units/column names and all exclusions before freezing splits. Never impute
  labels or replace absent measured values with estimates.
- **Rights:** the [DUA](https://github.com/AVAuco/healthgait/blob/main/DUA.txt)
  restricts use/distribution, while [Zenodo metadata](https://zenodo.org/api/records/14039922)
  declares CC BY. Treat that as an unresolved applicability conflict, not licence
  shopping. Ask the provider/institution to identify governing dataset terms and
  allowed derived features/results sharing; do not message them in this task.

S07 is therefore E for the proposed primary task: useful scale, but not a qualified
source of 1,564 independent clip-speed labels. Any separately approved aggregate
feature task must disclose the temporal mismatch. An external dataset used for development
cannot later be presented as untouched external validation.

## Alternative-specific assessment and next checks

**I is the strongest alternative to investigate for label correspondence.** Its
documented per-clip organization is potentially better than participant/pace labels.
However, GAITRite export presence alone does not establish the exact speed variable,
units, averaging zone, usable sample count or synchronized reference quality.
The release explains stable, intentionally noncontiguous IDs and participant quality
exclusions; P24 is not a participant count. Request the retained participant/clip
inventory, view/device/resolution, anonymization method, exclusion criteria/counts,
consent/reuse and export dictionary.
Metronome cadence is an instruction, not measured speed. `sync_auto.json` is metadata,
not proven clock qualification. The author tool link was reachable but its limited
README did not resolve those points. No companion peer-review claim is made.
[Release](https://zenodo.org/records/19662017), [tool](https://github.com/MarcosRM02/GaitScope).

**M is method-only.** Use documented depth/Xsens correspondence, if approved, for
coordinate/feature sensitivity rather than treating commanded walking speeds as
ground truth. Camera-relative projection is not a consumer RGB acquisition route;
the [processed description](https://physionet.org/content/multi-gait-posture/1.0.0/processed_data_description.txt)
defines pixel-space 2D and metre-space 3D outputs. Its [raw description](https://physionet.org/content/multi-gait-posture/1.0.0/raw_data_description.txt)
documents depth timestamps and trigger stamps, not a GaitSense speed-label acceptance.

**G supplies independent measurements but lacks the prediction modality.** Per-trial
light-barrier/mocap speed could support an isolated reference-analysis exercise;
it cannot validate MediaPipe prediction without paired video. A speed derived from
force signals as a separate task would be a different ML study. Subject IDs across
its constituent studies must be resolved before grouping; include missing-speed
studies in availability accounting, not as fabricated targets.
[Paper](https://pmc.ncbi.nlm.nih.gov/articles/PMC8413275/),
[trial-speed record](https://springernature.figshare.com/articles/dataset/GRF_walking_speed/14095849).

## Leakage and reference acceptance rules

For H, group all conditions/directions/jackets/frames/windows by PAXXX. For I,
group all conditions/clips by participant after ledger reconciliation. For M,
group all paths/locations/depth/skeleton derivatives by participant. For G, resolve
the unique-person mapping across DATASET_ID/SESSION_ID before freezing assignments;
composite source IDs alone may hide one person repeated across studies.

For every eligible use: immutable dataset version, source namespace and hash/lineage
ledger; person-exclusive train/validation/test; no random frame/window split;
re-encodes and derivatives inherit the source partition. Exact hashes catch byte
duplicates, not all same-content copies. Unknown person identity prevents primary
unseen-participant inclusion. Do not infer cross-dataset identity from appearance.
If overlap is unknown, disclose it and avoid claiming verified pooled independence.

Freeze split membership and use only training people to fit normalization, imputation
of **inputs**, feature selection and augmentations. Grouped development CV; untouched
person holdout for final evaluation. Avoid demographic/identity and reference-duration
proxies. Pace names and file paths may encode labels; remove them from model inputs.
Audit author splits against the intended target instead of blindly reusing demographic
task partitions. No test-set tuning or choosing datasets after seeing favorable errors.

Reference ranking for this target:

| Evidence type | Permitted conclusion |
| --- | --- |
| Independent measured distance/time or qualified reference-system speed | Potential label after trial correspondence, units, uncertainty and approval checks; H's current measurements do not correspond to the recorded passages; I/G need their task-specific checks. |
| Treadmill/walker set speed, self-report or pace category | Conditional instruction/context only; not measured person speed. |
| Same-pose/video estimate, unqualified model prediction, filename guess or nominal-FPS crossing | Ineligible independent speed ground truth. Never substitute for missing reference. |

Public data should preserve rejected/missing attempts where exposed; when the released
ledger is incomplete, report release-level coverage and unknown acquisition failures.
Do not claim full failure accounting or fabricate attempts. Participant-balanced MAE,
RMSE, coverage and participant-bootstrap intervals remain proposed evaluation outputs;
no model has been trained or evaluated in this audit.

## Strategy comparison

These are recommendations/inferences, not supervisor decisions.

| Strategy | Defensibility, leakage, compatibility, burden and thesis value |
| --- | --- |
| 1. Own cohort only | Closest deployment/reference control; recruitment, governance and qualified labels remain substantial work. Group people and seal holdout; no external-domain claim. Supervisor approval of protocol/scale needed. |
| 2. Public only | Currently unsupported for the proposed smartphone trial-speed claim. Could become defensible for a explicitly narrower approved public-domain task once H/I gates close; cannot establish deployment-domain validity by assertion. Lower recruitment burden, substantial mapping/licence risk. Panel acceptance of scope/scale unresolved. |
| 3. Own primary + public external | Preferred eventual structure if an untouched I domain has compatible independent labels and usable input; H's current release fails exact-passage/RGB conditions. Keep public data sealed until final test; do not also use it for tuning. Adds external-domain evidence at increased extraction/mapping cost. Supervisor approval required. |
| 4. Public development + own sealed evaluation | Potentially reduces development recruitment if I qualified; H would need additional paired data or a separately approved aggregate target. Domain shift may overwhelm transfer; freeze representation/tuning before touching own test people. Own development pilot must be distinguished from sealed cohort. Requires supervisor approval and own governance. |
| 5. Separate roles, no merge | Safest immediate planning strategy: H/I eligibility investigation; M/G optional method studies; own protocol primary. No artificial row-count inflation. Avoid many auxiliary tasks diluting the speed thesis; supervisor selects only those answering a necessary question. |

Practical recommendation is **Strategy 5 now, Strategy 3 conditionally later**.
If the supervisor instead chooses Strategy 4, reserve a different public domain
for external evaluation; never relabel development data as independent validation.

### Pooling decision

| Combination | Classification and reason |
| --- | --- |
| Repeats/derivatives within one verified release | POOL ONLY AFTER HARMONIZATION / SENSITIVITY ANALYSIS: unique-person mapping, equivalent label granularity, units and capture variants; repeats remain clustered. No unconditional SAFE TO POOL declaration yet. |
| Own cohort + H | BETTER KEPT AS SEPARATE DOMAINS; current H aggregate/earlier-passage references cannot become exact-clip trial labels. Any aggregate task needs separate approval plus rights resolution. m/s alone does not establish equivalence. |
| Own cohort + I, or H + I | BETTER KEPT AS SEPARATE DOMAINS initially; pooling only after verified reference-zone/averaging, units, population, view/pose and uncertainty harmonization, with dataset-held-out sensitivity analysis. |
| RGB speed study + M | INCOMPATIBLE as interchangeable raw RGB training; a separately approved common-joint method task may be possible. |
| RGB pose speed study + G | INCOMPATIBLE predictor modalities; labels without corresponding RGB cannot create training pairs. |

## What public data can and cannot solve

- **Recruitment burden:** potentially reduce development demand after I qualification;
  no evidence yet justifies reducing the proposed own-cohort target.
- **Replace own cohort:** not established for the present deployment-domain thesis.
  A supervisor-approved public-only reformulation is possible in principle, with narrower claims.
- **Increase development data while protecting own test:** conditional Strategy 4,
  with frozen decisions and participant/lineage separation.
- **External validation:** conditional I role; current H release is ineligible for exact-clip RGB trial-speed evaluation. Requires untouched domain, compatible
  trial references and deployed-input pipeline or explicitly labelled feature-only evaluation.
- **Cross-device/domain robustness:** camera/domain stress may be possible; sensor-only
  or depth results cannot prove smartphone RGB/device generalization. Public domains
  are not controlled paired-device experiments.
- **“Large dataset” panel expectation:** H has many people, whereas M has many frames
  from few people. Neither headline rows nor the sum of incompatible releases establishes
  independent-person scale, sufficient eligible speed labels or panel compliance.
  Report people, sessions, trials, clips, windows and frames separately, plus exclusions.

## Decisions this audit makes easier

The supervisor/institution still must decide: retain or reformulate the proposed
speed endpoint; own-cohort necessity; development versus untouched external role;
whether qualified public people count toward the panel's expected dataset scale;
acceptable domain/reference mismatch; permission/governance owner and permitted
derived-data sharing. Provider clarification is needed for H terms/aggregate-label
semantics/any separate paired release and I exports/camera/retained ledger.
No approvals or authors' answers are invented.

## Access verification and bounded next milestone

H paper PMC, author repo/DUA/licence and Zenodo HTML inspected successfully.
Nature publisher route returned an internal error. I official record and author
tool reached. M PhysioNet primary domain and descriptions reached; the www alias
was intermittent. G Figshare collection reached; PMC web route intermittently
presented reCAPTCHA, but a direct read-only HTML request returned methods text.
The G metadata-item HTML route failed; its official API supplied the needed record.
No challenge was bypassed. Repository API reads below returned metadata successfully
through PowerShell, although the browser tool rejected those API routes:

- Zenodo `/api/records/14039922`: `access_right=open`, `license.id=cc-by-4.0`.
- Zenodo `/api/records/19662017`: `access_right=open`, `license.id=cc-by-4.0`.
- Figshare `/v2/collections/5311538/articles`: item identities linked to collection.
- Figshare `/v2/articles/14095849` and `/14095847`: CC0, described trial/session
  counts and missing-speed datasets. No file content fetched.

The subsequent [eligibility decision brief](PUBLIC_GAIT_DATASET_ELIGIBILITY_DECISION_BRIEF.md)
records these evidence corrections, adoption gates and provider questions.
Next milestone: supervisor/steward eligibility decision for **H and I only**,
with specific provider questions and an approval-gated small-file inventory/reference
mapping plan. No acquisition now. Before any future download, all four gates must
close: verified governing terms, verified access route, supervisor intended-use approval,
and reference/label compatibility. Preserve retrieval dates, record DOI/version,
software revision and future source hashes for reproducibility; no copied dataset
assets in Git. No training until eligibility/splits/reference rules are approved.

This audit establishes no accuracy, clinical validity, generalization, novelty,
sample-size sufficiency, collection approval or ethics exemption. Existing protocols,
V1 checker, Android/TypeScript source and app thresholds are unchanged. No data
acquisition, recruitment or training occurred. The original audit was unstaged;
the subsequent two-document checkpoint is recorded in Git history.
