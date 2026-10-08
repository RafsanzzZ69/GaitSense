# ML benchmark implementation readiness

9 October 2026 · Sprint 6 · Audit + isolated synthetic safety checkpoint · **NOT_EVALUATED**.
Model: GPT-6.1 Sol; reasoning effort: High. Android phone: no; engineering video:
no; research dataset: no. Reviewed `main` and independently checked remote:
`d84a069bb15d0ff94fe8df2cfc2f2ef4008944fa`.

Working endpoint: **proposed, not approved**, trial-average walking-speed regression
for previously unseen participants. No endpoint, model count, temporal-model
requirement or dataset is approved here. Both reliable application engineering and
defensible ML research remain equally required. This document specifies gaps and
one software slice; it creates no trainer, scientific experiment, schema migration
or scientific result. Section 14 records the subsequent isolated synthetic implementation.

## 1. Readiness estimates and audit boundary

**A. Benchmark software/infrastructure: approximately 20%**, judgment range 15–25%.
Rubric: the 15 components in section 10 have equal weight; 1 means integrated and
qualified for benchmark use, 0.5 means useful but incomplete implementation, 0
means missing, unsafe or proposal-only in the benchmark. Six components receive
0.5 (grouping, split, preprocessing, models, metrics, artifacts); nine receive 0.
Thus 3/15 = 20%. This is an explicit planning heuristic, not a measured probability,
statistical confidence interval, effort forecast or approved project completion score.
Standalone synthetic concepts do not receive full benchmark credit.

**B. Approved scientific ML benchmark completion: 0%.** Historical exploratory
fits exist; they do not complete an approved, independently labelled,
participant-separated scientific benchmark. No claim that all prior research work
was zero follows. Status remains NOT_EVALUATED, not a numerical performance result.

Scope: source, documentation and synthetic-test definitions only. No private CSV,
manifest records, media, historical model binaries or numerical result files were
opened or executed. No pipeline/trainer was run. The historical limitations below
come from repository documentation, not a new analysis of participant data.

The current checkout includes **pre-existing uncommitted reconciliation** in
`common.py`, `metadata_io.py`, `validate_metadata.py`, tests and documentation.
Its safer explicit-metadata behavior is present locally but is not in the reviewed
remote snapshot. `git show HEAD:research/gaitsense_poc/scripts/common.py` still
shows filename-based participant/condition fallback. Preserve that work; do not
claim the remote trainers already benefit from the local correction.
Some E06–E08 links point to those local, uncommitted files; they resolve in this
working tree and are intentionally excluded from this checkpoint.

## 2. Repository evidence register

IDs below identify actual inspected source; negative implementation findings are
bounded to the trainers, research scripts and relevant app/validation search.

| ID | Evidence | Observed responsibility |
| --- | --- | --- |
| E01 | [Classifier](../../research/gaitsense_poc/scripts/10_train_model.py) | Feature availability, complete-case filtering, binary condition mapping, one grouped holdout, RF fit/metrics/joblib |
| E02 | [Regressor](../../research/gaitsense_poc/scripts/12_train_regression.py) | Video-target merge, label guards, global feature selection, train-fitted pipelines, three fixed regressors, aggregate metrics/joblib/JSON |
| E03 | [Feature extraction](../../research/gaitsense_poc/scripts/07_feature_extraction.py) | Per-video pose/event proxies, metadata join, quality exclusion, one feature row per retained video |
| E04 | [Pose extraction](../../research/gaitsense_poc/scripts/02_pose_extraction.py), [quality](../../research/gaitsense_poc/scripts/03_quality_check.py) | Nominal frame/FPS clock; single-pose 0.5 inference settings; required bilateral x-coordinate availability gate |
| E05 | [Smoothing](../../research/gaitsense_poc/scripts/05_smoothing.py), [events](../../research/gaitsense_poc/scripts/06_gait_events.py) | Within-video interpolation/filtering, ankle peaks, missing-signal filling and FPS fallback |
| E06 | [Local common helper](../../research/gaitsense_poc/scripts/common.py), [local metadata helper](../../research/gaitsense_poc/scripts/metadata_io.py) | Explicit metadata locally; unknown sentinel retained; HEAD behavior differs as described above |
| E07 | [Local inventory validator](../../research/gaitsense_poc/scripts/validate_metadata.py), [local synthetic tests](../../research/gaitsense_poc/tests/test_metadata.py) | Canonical/alias hashes, ownership/count/view checks; historical inventory, not scientific acceptance |
| E08 | [Historical reconciliation](../../research/gaitsense_poc/REPRODUCIBILITY.md), [README](../../research/gaitsense_poc/README.md), [legacy instructions](../../research/gaitsense_poc/POC_README.md) | Small exploratory cohort, stale outputs, estimated labels, imported/default path mismatch |
| E09 | [Speed tool](../../research/gaitsense_poc/scripts/measure_walking_speed.py), [relative index](../../research/gaitsense_poc/scripts/13_compute_pattern_index.py) | Hard-coded 4 m/nominal-FPS reference estimates; whole-table percentile indicator |
| E10 | [Runner](../../research/gaitsense_poc/run_pipeline.py), [requirements](../../research/gaitsense_poc/requirements.txt), [summary generator](../../research/gaitsense_poc/scripts/11_generate_report.py) | Runner includes classifier training; unpinned dependencies; summary records Python version but not full run provenance |
| E11 | [Motion cohort](../../frontend/src/validation/motion-cohort.ts), [validation scope](../../frontend/src/validation/README.md) | Synthetic event-error accounting, participant weighting, failures/replacements and cluster bootstrap; not speed-model evaluation |
| E12 | [V2 synthetic validator](../../research/study/check_v2_proposal.py), [V2 invariants](RESEARCH_MANIFEST_V2_INVARIANTS.md) | Fixed fake fixtures, ownership/partition/input-name/run checks; does not observe actual fitted transforms |
| E13 | [Backend pipeline](../../backend/app/pipeline.py), [offline session analysis](../../frontend/src/offline/SESSION_ANALYSIS.md) | Backend speed unavailable without validated model/calibration; offline deterministic analysis, not imported PoC regressor |
| E14 | [ML roadmap](ML_THESIS_READINESS_AND_EXPERIMENT_PLAN.md), [supervisor brief](ML_SUPERVISOR_DECISION_BRIEF.md), [V2 proposal](RESEARCH_MANIFEST_V2_PROPOSAL.md) | Draft endpoint/benchmark, frozen participants, reference/prediction separation and governance requirements |
| E15 | [Public-data audit](PUBLIC_GAIT_DATASET_SUITABILITY_AUDIT.md), [eligibility brief](PUBLIC_GAIT_DATASET_ELIGIBILITY_DECISION_BRIEF.md) | H published raw/pairing route fails current task; I conditional; own cohort remains planned, no public adoption |

## 3. Exact current splits and leakage findings

**Classifier (E01):** load feature CSV → select allowlisted columns with at least
50% nonmissing values across the whole table → drop rows missing selected features,
participant or condition → map only `controlled_variation` to 1, everything else
to 0 → require at least four rows/two people/two labels → one GroupShuffleSplit
(`n_splits=1`, `test_size=.2`, seed 42) → train RF and report the same holdout.

**Regression (E02):** load features/targets → discard feature-table copy of target
and left-join on `video` → stop if any feature row lacks a target → require positive,
nonconstant labels → choose allowlisted columns using whole-table 50% availability
→ drop missing participant/target rows → require four rows/three people → optionally
warn about estimates → one GroupShuffleSplit (`test_size=.25`, seed 42) → fit each
imputer/scaler/model on training rows → predict/report holdout. No separate validation.
The .2/.25 values are historical code settings, **not future split recommendations**.
GroupShuffleSplit allocates groups, not a guaranteed fraction of trial rows.

| Finding | Classification | Evidence and required change |
| --- | --- | --- |
| Repeats carrying the same truthful participant ID remain in one current split | **SAFE**, conditional on ID integrity | E01/E02 pass `participant` as groups. Preserve grouping, add explicit disjointness assertions. |
| Feature availability selected before split | **UNSAFE FOR SCIENTIFIC BENCHMARK** | E01/E02 global `.notna().mean() >= .5` lets held-out input distribution affect feature choice. Fit selector within each training fold. |
| Unknown/missing identities and conflicting ownership | **UNSAFE FOR SCIENTIFIC BENCHMARK** | `dropna` does not reject `unknown`, blank strings or conflicting IDs. E06 lacks scientific registry checks; HEAD additionally guesses IDs. Fail closed and audit ownership. |
| Target join cardinality/alias lineage | **UNSAFE FOR SCIENTIFIC BENCHMARK** | E02 joins `video` without uniqueness or merge validation; duplicates can multiply rows. No trainer calls E07 or checks same-content copies across partitions. |
| Reference eligibility | **UNSAFE FOR SCIENTIFIC BENCHMARK** | E02 permits absent measurement file/method field; estimate warning does not stop fit or attest accepted timing/governance. Numeric positivity is not provenance. |
| Condition labels | **UNSAFE FOR SCIENTIFIC BENCHMARK** | E01 can map `unknown` to class 0 if other rows supply both classes. No approved condition taxonomy. This classifier is not a speed comparator. |
| Regression fitted median/scaler | **SAFE** for current fitting scope | E02 pipelines receive only `data.iloc[train]` in `.fit`; predictions apply stored transforms. Retain this property in every inner fold. |
| Complete-case/quality exclusions before splitting | **NEEDS REFACTOR** | E01 drops feature-missing rows; E03 excludes POOR videos. No full failure ledger or denominators. Fixed eligibility rules can be applied consistently, but membership must not be chosen after discovering which people succeed. |
| No validation/tuning boundary or sealed final test | **NEEDS REFACTOR** | E01/E02 only train/test. No programmed test-based search found; choosing a winner after inspecting their holdout would consume it for model selection. |
| Partition viability / class support | **NEEDS REFACTOR** | E01 checks two labels only before splitting and does not stratify groups or check per-partition class support. E02 checks global target diversity, not training diversity/test variance. Report fold support and undefined metrics; do not move held-out people to improve scores. |
| Shared split/inputs across three regressors | **SAFE** comparison scaffold | E02 uses one split and ordered feature list for all three, but this does not repair label/selection problems. |
| Global missingness count and target-diversity inspection | **NEEDS REFACTOR** | E02 reports imputed counts across filtered cohort and inspects whole-table target uniqueness. These are not imputer fit statistics; keep sealed-test diagnostics out of development decisions. Training viability checks should use training targets. |
| Accepted-reference/research identity mapping | **BLOCKED ON FINAL DATA SCHEMA** | E14 requires participant→session→trial→attempt and accepted reference versions; flat PoC CSV cannot attest them. Generic synthetic guards can precede final schema. |
| Windows, augmentations, re-encodes and public-domain mixing | **BLOCKED ON FINAL DATA SCHEMA** | E12 provides fake ownership checks only. Real lineage needs reviewed registry; every descendant inherits participant outer partition. No random window/frame split. |

No observed high score is attributed to a specific leakage mechanism here: source
shows risks, not which historical run used them. Correct grouping alone does not
authenticate identity, targets, feature selection or final-test independence.

## 4. Preprocessing audit: learnable versus deterministic

| Stage | Learns from data? Current scope | Readiness / required rule |
| --- | --- | --- |
| Median feature imputation | Yes; training rows only in regression E02 | Safe scope; add empty-column, finite-type and stable feature-order guards. Missing indicator/strategy remains candidate configuration. Classifier currently drops missing rows instead. |
| Standard scaling | Yes; training rows only for linear/MLP E02; absent RF | Safe scope; every CV fold gets a fresh fitted pipeline. Never fit once on full development before inner CV. |
| Coordinate normalization | E04 supplies image-normalized coordinates; E03 uses them directly | Fixed representation, not population fitting. No body-centred/height normalization or image-aspect correction in these features. Any learned centering parameters must remain training-only. |
| Smoothing/interpolation | E05 per-video; fixed window 7, polynomial 2, interpolation limit 3 | No cross-participant fit, but uses later observations within a clip and sample-index filtering across gaps. Suitable only for a documented offline input policy; no realtime equivalence. Parameter selection belongs to development. |
| Event missing-value filling | E05 median from that video's ankle samples | Test-clip input-only statistic, not evidence of training/test mixing. May fabricate smooth motion across missing regions; require masks/gap policy and feature-version tests. |
| Event peak parameters | E05 fixed .4-second peak separation, .01 prominence, configurable x/y signal | Deterministic defaults, not empirically qualified. Any selection of values/signal must use development people; preserve masks/clock semantics. |
| Feature selection | Fixed ten-name allowlist plus learned full-table availability | Fixed names alone safe; availability fit is unsafe. Future variance/correlation/importance selection fits inner training only. No such additional selector currently implemented. |
| Dimensionality reduction | No PCA or equivalent in inspected trainers | Not implemented; if justified later, fit within training folds. Not an automatic requirement. |
| Outlier thresholds | No learned cohort outlier filter in trainers; E03 interval range .25–3 seconds is fixed | Current fixed filter is an unvalidated feature heuristic, not calibrated physiology. Freeze or tune on development; never target/test-dependent exclusion. |
| Pose/quality thresholds | E04 inference 0.5; PoC quality GOOD≥90%, ACCEPTABLE≥70%, based on bilateral required x availability | Deterministic, not learned. Does not enforce Android selected-side confidence/presence/bounds/multiple-person semantics. Do not equate similarly named 70% gates or alter app thresholds. |
| Temporal window/duration | E03 uses observed timestamp span, not a qualified zone; E05 default FPS from long landmark-row differences may fall back to 30 | No approved fixed-window policy. Choose input windows independently of reference crossings, freeze via pilot/development, retain gaps and clock class. |
| Relative index | E09 percentile ranks across complete feature table | Cross-cohort learned distribution; current regressors exclude index/components. Do not reuse as ground truth or silently add as feature; if ever justified, train-fit reference distribution required. |

E04 timestamps use frame number/nominal FPS, not actual decoded PTS. E05 long-table
timestamp differences include repeated joints at identical times; median zero can
trigger fallback 30. E03 event/knee/arm/sway values are deterministic projected
proxies, not validated events or biomechanics. Synthetic clock/gap tests can expose
algorithm behavior; approved reference data is needed to establish feature validity.
[Official leakage guidance](https://scikit-learn.org/stable/common_pitfalls.html)
supports training-only transforms and pipeline-contained selection; it does not
certify this project or its labels.

## 5. Target leakage boundary for the working speed proposal

**Observed protection:** both trainers use the same ten-name feature allowlist.
Reference distance, crossing duration, speed, participant IDs, condition/view,
filenames, step count and `duration_seconds` are not selected. E02 explicitly
excludes index/component columns and replaces a feature-table target through a
separate join. This is useful, but a blacklist is not complete provenance protection.

**Never predictor inputs:** reference distance/duration/start/end, reference-system
speed, reference steps, observer decisions/uncertainty encodings that expose the
answer, participant/session/trial/attempt IDs, partition labels, path/filename
target encodings or model predictions copied into labels. IDs remain join/group
metadata. Physically distinct optional calibration/anthropometric inputs require
an approved extra-input experiment; do not relabel target-defining distance as calibration.

Two evidenced conditional risks:

- E02 accepts arbitrary `--target`. If it names an allowlisted feature such as
  `cadence`, the merged target column can also be selected into predictors. This
  is a configuration defect, **not proof the default walking-speed fit leaked its target**.
  Generic code must reject target-feature collision and independently validate units.
- E03 cadence uses video-observed duration. It is not currently the independently
  measured crossing duration; no direct target leak is established. If future input
  cropping uses accepted crossing boundaries, cadence/window length could expose
  target duration indirectly. Store input-window provenance and reject reference-derived cropping.

The historical 4 m/nominal-FPS tool (E09) does not supply an approved reference.
H measured person/pace values cannot label exact videos; I exports remain conditional
(E15). No missing label may be imputed, predicted, guessed or replaced with a
candidate-event quantity. Report reference unavailability separately from prediction failure.

## 6. Partition roles and model selection

1. **Development/training people:** eligible pilot/development pool under approved
   rules; fit models and transformations only on designated training subsets.
2. **Validation / inner model-selection people:** participant-grouped folds inside
   development, for features, preprocessing, quality policies, hyperparameters,
   early stopping and model-family selection. They are not final test people.
3. **Final held-out people:** frozen/versioned membership before development choices;
   target values and diagnostic scores sealed from model designers until the
   feature/model/quality/availability policy is frozen. Pilot people used to design
   policy cannot become this final holdout.

No final percentages/fold counts chosen. Use GroupKFold or equivalent explicit
participant folds when cohort size permits. Nested grouped CV inside development
is justified if substantial family/feature/tuning search needs an unbiased development
estimate; it does not replace the sealed final holdout. Outer development folds
contain inner tuning folds; clone/refit preprocessing per fold. If data are too small,
reduce search/claims or wait for more participants rather than selecting on final test.

Current E02 settings are fixed, with other estimator defaults implicit; no search
spaces or grouped tuning runner exist. MLP `early_stopping=False` creates no hidden
early-stopping validation in the current fit. Future early stopping must obey explicit
grouped roles. Choosing among three reported test errors is model selection, even
without GridSearch code. Seeds and widths do not constitute additional model families.

## 7. Model implementation inventory

IMPLEMENTED below means executable exploratory trainer source, **not benchmark-ready,
approved, trained in this audit or deployment-qualified**.

| Regressor | Status | Current evidence / missing work |
| --- | --- | --- |
| Training-set mean/constant | **NOT IMPLEMENTED** | No DummyRegressor/constant fit in E02. Essential gap: fit only training-target mean; same held-out trials and availability rules. Linear regression is not the trivial baseline. |
| Linear regression | **IMPLEMENTED** | E02 `linear_baseline`: median→scaler→LinearRegression; name does not make it a constant baseline. |
| Ridge | **NOT IMPLEMENTED** | No Ridge trainer; proposed regularized linear comparator, approval of benchmark scope pending. |
| ElasticNet | **NOT IMPLEMENTED** | No ElasticNet trainer; grouping/tuning first. Not automatically counted separately from linear family. |
| k-NN regression | **NOT IMPLEMENTED** | No KNeighborsRegressor trainer. |
| SVR | **NOT IMPLEMENTED** | No SVR trainer. |
| Random Forest | **IMPLEMENTED** | E02 median→RF, 300 trees, leaf minimum 2, seed 42; depth/runtime unbounded by explicit configuration. |
| Gradient-boosted trees | **NOT IMPLEMENTED** | No boosted-tree trainer; choose one justified implementation after scope decision. |
| Shallow MLP | **IMPLEMENTED** | E02 median→scaler→MLP(32,16), max 2000 iterations, seed 42; convergence reporting absent. |

Separate **RandomForestClassifier** exists (E01), 200 trees, balanced class weights;
its condition endpoint is not a speed regression model. No listed regressor receives
PARTIALLY IMPLEMENTED: the three have complete exploratory fit paths; the remainder
have planning descriptions, not partial code.

1D CNN, TCN, GRU, LSTM and small Transformer: each **CONDITIONAL ON SUPERVISOR + DATA
ADEQUACY**; no matching temporal trainer found in inspected source. Do not implement
them to satisfy the unconfirmed ~10-model rumor. Approve input representation,
scientific comparison/counting rules and independent-person data adequacy first.

## 8. Metrics, repeated trials, uncertainty and failures

E01 separately implements classification accuracy, precision, recall, F1 and
confusion matrix, with zero-division handling. These are not speed-regression
endpoints and do not establish a valid condition classification experiment.

| Endpoint/accounting | Current implementation | Research-side requirement |
| --- | --- | --- |
| MAE / RMSE | E02 pooled held-out rows | Retain descriptive pooled errors; primary equal-participant summaries below. |
| Bias / signed error | Absent regression; E11 synthetic event bias in ms | Implement speed signed error `prediction-reference` in target units. |
| R² | E02 only guards `len(actual)>1` | Report sample/participant count, target variance and undefined reason. Constant test targets/tiny samples make interpretation invalid; no universal count threshold invented. Use null, not JSON NaN or forced-success interpretation. |
| Participant-balanced / per-person errors | Absent E02; E11 has event accounting | Python speed metrics with trial/person provenance; no direct reuse of event-matching numerators. |
| Reference availability | E02 stops on any missing target; no accepted-reference denominator | Keep all planned trials/actual attempts and unavailable references. Train on approved eligible subset; do not erase rejected rows to make loader succeed. |
| Prediction availability / failures / coverage | E02 in-memory predictions only; no row statuses; E03 removes poor inputs | Record every expected prediction outcome/reason and stage denominator, including exceptions/unsupported input. |
| Confidence intervals | Absent E02; E11 fixed synthetic participant bootstrap | Equivalent independently tested Python cluster bootstrap for speed metrics; CI unavailable when data/endpoint undefined. No row/window bootstrap. |

Proposed equal-participant trial evaluation on eligible paired trials: for person i,
`MAE_i = mean_j(abs(error_ij))`; headline `mean_i(MAE_i)`.
Participant-balanced RMSE is `sqrt(mean_i(mean_j(error_ij²)))`, **not** the mean
of participant RMSEs; signed bias is `mean_i(mean_j(error_ij))`. Publish per-person
trial counts/errors and pooled descriptive values alongside these. Hierarchies with
multiple sessions/attempts require a frozen aggregation rule; do not arbitrarily
pick the replacement with lowest error or count several attempts as new planned trials.
Training-row imbalance is a separate issue: if approved, use training-only
participant weights or a prespecified sampling strategy supported fairly across
families. Equal-person reporting does not itself balance model fitting; do not
silently change the learning objective after inspecting test participants.

Resample participants with replacement, retaining all their eligible trials;
duplicate draws retain multiplicity. Store bootstrap seed/draw count/method and
undefined draws. Distinguish finite-cohort descriptive uncertainty from wider-domain
generalization; bootstrap cannot fix biased labels or too few people.

Denominators must identify: enrolled/eligible people, planned trials, attempted
trials, all attempts, captured sources, accepted references, available predictions,
paired outcomes and exclusions. Report reference yield, prediction availability
and paired coverage with explicit denominators; aggregate each participant's rate
equally where approved. No-attempt/no-reference people remain visible; the policy
for undefined population rates stays pending. E11's 30-second opportunity denominator
and event recall/precision must **not** be copied to speed trials. E12 eligibility
lists are synthetic structure checks, not measured accuracy or real availability.

## 9. Reproducibility, prediction contract and deployment

### Run provenance inventory

| Required record | Status | Evidence / gap |
| --- | --- | --- |
| Dataset/manifest version | **BLOCKED ON V2 RESEARCH IMPLEMENTATION** | E14 proposal; trainers load paths without accepted-manifest digest. Generic run-envelope fields can be built now. |
| Feature/preprocessing version | **MISSING** | Feature list stored, algorithm version/hash/order/units and fitted-transform identity absent. |
| Split version/frozen membership | **BLOCKED ON V2 RESEARCH IMPLEMENTATION** | No persistent split manifest; E12 fake version/membership checks only. Generic split format need not wait for production V2. |
| Model family | **AVAILABLE** | E01 classifier name; E02 named model keys/artifact filenames. Stable family ID/version still needed. |
| Hyperparameters | **PARTIAL** | Explicit settings in code and fitted estimator object; no complete serialized config/get_params snapshot. Defaults depend on unpinned libraries. |
| Random seeds | **PARTIAL** | Hard-coded 42 for splitter/RF/MLP; not a complete run seed registry/report. |
| Runtime/library versions | **PARTIAL** | E10 summary has Python version; unpinned requirements, no full environment lock/run snapshot. |
| Training participant IDs | **AVAILABLE** | E01/E02 reports list train IDs; real identity authenticity not established. |
| Validation participant IDs | **MISSING** | No validation partition. |
| Held-out participant IDs | **PARTIAL** | Current test IDs recorded; not a sealed/versioned final cohort. |
| Metrics | **PARTIAL** | Pooled scores, no row-level paired outcomes or participant aggregation. |
| Failure/coverage denominators | **MISSING** | Quality drops/missing-label stop do not account for full cohort. |
| Model checksum/artifact identity | **PARTIAL** | joblib persistence at fixed names; no run ID/checksum/content manifest. Repeated runs can overwrite. |
| Code/input hashes and logs | **MISSING** | Console output/pose logging exist, but no complete structured benchmark run log/config/hash chain. |

Persist future immutable run directory + configuration, code revision/dirty-work
digest, environment lock, data/annotation/feature/split versions and checksums,
explicit fit/tune/test memberships, seeds, full parameters, fitted preprocessing,
per-row predictions, metrics/denominators, exceptions/convergence warnings and
model/export digests. Do not overwrite historical outputs. Separate inference
entry point is not present in inspected PoC scripts; `.predict` exists only inside
trainer evaluation. E02 JSON may contain nonstandard NaN through `json.dumps` defaults.
Use validated finite numbers/null reasons in the future contract.

### Future prediction record — proposed, not a V2 amendment

One row per `(model_run_id, attempt_id, prediction_revision)` with immutable links:
`participant_id`, `session_id`, `trial_id`, `attempt_id`, source/feature artifact ID
and digest; dataset/annotation/feature/preprocessing/quality-policy/split versions;
outer partition plus CV fold role; model family/version/run ID and artifact digest;
input-window/clock provenance; prediction status/value/unit and unavailable/failure
reason; separately linked reference status/version/eligibility/value/unit, paired
eligibility and exclusion reason. Reference value is null when not accepted;
prediction value is null when unavailable. No identifying consent contents.

Predictions may exist without an accepted reference and accepted references may
exist without a prediction. Neither supplies the other. Prediction writers get
no authority to edit reference records; enforce schema/namespace and immutable
reference-hash tests. Role metadata never enters feature tensors. Working unit
would be m/s for speed; generic infrastructure stores explicit target/unit without
requiring this endpoint. Existing V2 and V1 contracts/checkers remain unchanged.

### Mobile deployment readiness: NOT READY

| Existing model | Realistic future route | Missing qualification |
| --- | --- | --- |
| Linear | Portable coefficients/intercept plus median/scaler, or converted ONNX | Frozen feature semantics/order/types, explicit preprocessing export and parity |
| RF regressor/classifier | Tree export/evaluator or supported ONNX conversion | Operator/runtime compatibility, bounded size, exact thresholds/leaf logic; classifier endpoint separate |
| Shallow MLP | Dense weights/activations plus preprocessing, or converted tensor graph | Conversion version/opset, numerical tolerance, missing-data behavior and device measurements |

[Official sklearn-onnx support](https://onnx.ai/sklearn-onnx/supported.html) lists
these estimators and imputer/scaler converters; [ONNX Runtime mobile](https://onnxruntime.ai/docs/tutorials/mobile/)
documents Android execution. These are **candidate routes**, not verified project
exports or a runtime choice. Python joblib is not an Android deployment artifact.
No export, converter pin, canonical downstream golden-input/output format or
Python/mobile learned-prediction parity suite was found in the inspected project paths.
Existing synthetic deterministic-analysis comparisons are not learned-model parity.

Scalar imputer/scaler parameters can be exported, but the whole feature chain must
also match: PoC clocks, interpolation, angles, quality rules and bilateral features
differ from current Android contracts. Equivalent tabular inputs alone prove model
parity, not video→feature parity. Future golden cases need feature names/order/units,
missing mask, preprocessing/model hashes, transformed values, outputs/statuses and
approved absolute/relative tolerances; include missing/all-missing/boundary cases.
Then separately qualify feature extraction on matched supported inputs, followed by
physical runtime/memory/thermal/offline multi-device acceptance after model selection.

## 10. Implementation readiness matrix

Score is the section 1 heuristic. “Safe now” authorizes a recommendation, not code
changes in this audit. Synthetic scaffolds do not approve real ingestion.

| Component | Current status / score | Evidence | Scientific risk | Safe before supervisor? | Needs supervisor decision? | Needs real dataset? | Recommended action |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Participant grouping | Partial .5 | E01/E02/E06/E07 | False/unknown IDs, aliases | Yes, fake ownership guards | Registry/governance rules | Real identity/lineage qualification | Explicit IDs; fail closed, assert disjointness |
| Train/validation/test split | Partial .5 | E01/E02/E12 | Single exposed holdout | Yes, fake deterministic memberships | Allocation/role policy | Freeze adequate real groups | Version outer split and inner folds |
| Preprocessing | Partial .5 | E02/E04/E05 | Safe scaler scope; weak feature semantics | Yes, fit-membership tests | Final feature/clock policy | Feature validity | Clone fit-only-training transforms |
| Feature selection | Unsafe 0 | E01/E02 | Full-table availability | Yes, synthetic fold selector | Final allowlist/threshold | Scientific feature choice | Train-fold selection only |
| Trivial baseline | Missing 0 | E02 | No no-skill comparator | Yes, generic train-mean scaffold later | Approved target/unit | Evaluate benefit | Same folds and eligible outcomes |
| Model families | Partial .5 | E01/E02/E14 | Three exploratory regressors ≠ benchmark | Registry only | Families/count/temporal scope | Compare candidates | Approve scope; no count-driven additions |
| Tuning | Missing 0 | E02 | Selection can consume test | Generic role guards | Search budget/criterion | Adequate inner groups | Development-only grouped selection |
| Metrics | Partial .5 | E02/E11 | Row dominance, fragile R² | Yes, synthetic arithmetic | Primary endpoints/policies | Actual results | Speed-unit participant metrics |
| Participant balancing | Missing in Python benchmark 0 | E11 | Many-trial people dominate | Yes, analytical fake examples | Session/attempt hierarchy | Real distribution | Equal-person headline; pooled descriptive |
| Uncertainty | Missing in Python benchmark 0 | E11 | False precision | Yes, fake cluster tests | Reporting/undefined policy | Enough independent people | Participant bootstrap; retain failures |
| Failure/coverage accounting | Not integrated 0 | E03/E12/E14 | Silent quality selection | Yes, fake lifecycle ledger | Denominators/replacements | Real attempts/references | Separate capture/reference/prediction axes |
| Artifacts/versioning | Partial .5 | E02/E08/E10 | Overwrites, unpinned replay | Yes, immutable synthetic run envelope | Retention/governance | Actual provenance qualification | Hash/version config and all artifacts |
| Prediction schema | Proposal-only 0 | E12/E14 | Prediction becomes reference | Yes, separate fake namespaces | Target/reference schema | Real linkage | No reference mutation; explicit statuses |
| Mobile export | Not implemented 0 | E13/E14 | Python/app mismatch | Contract design only | Selected model/runtime/budget | Trained final model | Export chain after selection |
| Parity testing | Not implemented for learned model 0 | E11/E13 | Incorrect deployment output | Generic golden format later | Tolerances/model policy | Final model + later phone | Tabular then end-to-end parity |

Highest risks: unqualified labels/identity; pre-split selection and unchecked joins;
consuming final participants during model choice; undefined feature semantics and
quality exclusions; insufficient independent people; incomplete reproduction and
deployment provenance. Model-family breadth alone repairs none of these.

## 11. Decisions and real-data dependencies

**Safe infrastructure now:** fake participant ownership/lineage assertions, explicit
partition roles, deterministic split provenance, train-only preprocessing/selection
guards, immutable generic prediction/reference separation, analytical metrics tests
and run-envelope design. Do not change existing exploratory paths incidentally.

**Supervisor-dependent freeze:** primary target and reference method; model-family
and count expectations; temporal/deep/backbone scope; pilot/main-cohort scale and
split allocation; public-data role; feature/window/quality/denominator policies and
institutional governance. This is a category list; the full question package remains
in the existing supervisor brief for separate later presentation.

**Real-data-dependent qualification:** authentic identity/consent/source/reference
linkage, label uncertainty/coverage, feature validity and representativeness,
learning curves, grouped model/tuning comparison, final held-out evaluation,
robustness and empirical export/performance. No collection begins before protocol,
qualified reference/governance and stable capture gates. H/I remain as E15 documents;
no own-cohort size or public-only replacement is approved.

## 12. One bounded next implementation slice

**Participant-grouped split + preprocessing leakage guards on synthetic fixtures.**
Initially proposed isolated location: `research/benchmark_synthetic/`; now created
as the bounded synthetic package described in section 14. The cases below remain
the original recommendation; section 14 distinguishes delivered scope and limits.
Use fake SYN IDs/lineage, abstract numeric target/features and a discriminator
rejecting real evidence. No ingestion adapter, historical data paths, scientific
model training, model export or modifications to existing trainers/V1/V2 checkers.

Implement a small pure ownership/partition projection with explicit caller-supplied
synthetic allocation; freeze sorted memberships, seed and fixture digest. Test
train-fitted missingness selection, imputation and scaling with instrumented fit
membership, using transformation `.fit` on fake numbers only; no estimator fit or
scientific score. Exact pass/fail cases:

1. All repeats/windows of each fake person remain in one outer partition; unknown,
   missing/conflicting person ownership is rejected.
2. Duplicate hash or declared re-encoded lineage across partitions is rejected;
   same-lineage aliases do not create extra independent trials.
3. Identical fixture/config reproduces memberships and digest regardless of row
   order; changed config/version produces separately identified output.
4. Holdout-only outliers/missingness mutations cannot alter training selector,
   imputer medians or scaler statistics; instrumentation proves fit receives only
   designated training IDs. Include validation rows in this adversarial test.
5. Each simulated inner fold creates fresh transforms and sees only its own train
   people, never inner-validation or outer-test people.
6. Empty/all-missing training features, nonfinite values, unexpected columns and
   target-feature collision fail closed with explicit reasons; held-out values
   cannot rescue an unavailable training column.
7. Duplicate join keys/mismatched trial ownership and train/tune use of test IDs
   are rejected before transformations.
8. Prediction serialization cannot modify immutable reference bytes/digest;
   unavailable prediction is null with reason, never fabricated reference/zero.

Exit: documented synthetic case count with all expected passes/failures matched;
no trainer changes, real-input path, approved split percentage or endpoint/model-count
commitment. Use existing E12/E07 concepts with explicit limits, not a claim that
metadata lists prove runtime fitting. Phone: **no**; engineering video: **no**;
research dataset: **no**; supervisor confirmation: **not needed for this generic
synthetic slice**, still required for scientific benchmark freeze and real use.

## 13. Original audit verification boundary

Original audit verification on 9 October 2026: **30 internal links/30 unique targets resolved;
zero trailing-whitespace lines; `git diff --check` passed** (nonfatal CRLF notices
on pre-existing unrelated files). All **337 starting files remained byte-identical**,
including protected APK/verification helper and unrelated local work; this document
was the only added file. Index remained empty and HEAD unchanged.
No tests or code were added during that audit, no scientific runs were performed,
no model artifacts were generated, and no files were staged/committed/pushed.
Existing trainer behavior, V1/V2 contracts/checkers, Android/TypeScript source and
quality thresholds were preserved.

## 14. Implemented synthetic safety infrastructure

**IMPLEMENTED SYNTHETIC SAFETY INFRASTRUCTURE** — **NOT YET INTEGRATED INTO FINAL
TRAINER** — **NOT SCIENTIFICALLY VALIDATED**.

The [technical contract and verification](../../research/study/BENCHMARK_SPLIT_AND_LEAKAGE_GUARDS.md)
documents the isolated standard-library package: explicit fake ownership and
canonical lineage; fail-closed missing/unknown identity; deterministic grouped
allocation with optional fixed test participants; actual feature-read traces for
train-only selection/imputation/scaling; held-out transforms; immutable, separate
prediction/reference records. **40 synthetic test methods PASS**, covering all
18 requested scenario categories plus adversarial boundary cases. No estimator,
historical trainer, metadata helper or V1/V2 code is invoked or modified.

Scope limits relative to section 12: lineage uses explicit tokens, not media-byte
hashing or perceptual matching; row/hierarchical ownership checks do not implement
CSV joins; generic `fN` fields cannot detect labels disguised as feature values.
The reference digest is an in-process mutation guard, not authenticated storage.
The interface records actual reads by this toy fit harness, not by historical
sklearn pipelines. Final ingestion, feature semantics, real fold/test freeze,
trainer integration, scientific evaluation and complete run provenance remain open.

**Software estimate before/after: approximately 20% / 20%; scientific completion:
0% / 0%.** Section 10's integrated-benchmark scores are retained: standalone
guards do not repair the historical trainer or qualify the final benchmark.
Recommendation **C now / B later**: retain standalone validation until supervisor
decisions, then construct a clean runner with explicitly qualified adapters and
instrumented library fits; do not absorb unrelated historical-helper work (A).
Phone: no; engineering video: no; research dataset: no. Supervisor approval is
still required for scientific endpoint/reference/governance/split decisions.
