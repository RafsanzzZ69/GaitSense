# Independent projected knee-flexion validation protocol

Protocol: GS-KNEE-2D-0.1-draft. Prepared 29 September 2026.
Status: DESIGN ONLY; supervisor/institutional review required before study use.
Scientific validation: NOT COMPLETED. No participant data were collected or evaluated.

This focused amendment accompanies [STUDY_PROTOCOL.md](STUDY_PROTOCOL.md),
[CONSENT_DRAFT.md](CONSENT_DRAFT.md) and [approvals.json](approvals.json).
It proposes knee-angle validation before gait-event work; it does not approve
recruitment, replace the broader study protocol, or change approval decisions.
Its portrait/720p capture variant must be explicitly accepted under A-03 because
the broader draft specifies landscape/1080p. Do not silently combine variants.

## 1. Question, endpoint and claim boundaries

Question: for eligible straight-walking side-view frames on the specified Samsung
setup, how closely does the frozen GaitSense projected knee-flexion estimate agree
with independently annotated 2D projected knee flexion on the SAME input image,
and how often is a matched measurement available?

Primary endpoint: participant-balanced mean absolute angular error (degrees)
against the independent 2D reference, accompanied by coverage. No standalone
accuracy claim is allowed without the denominator and unavailable-result rate.

| Layer | Evidence required | Permitted interpretation |
| --- | --- | --- |
| Mathematical correctness | Deterministic synthetic geometries, invariance and invalid-input tests | Formula/contract behaves as specified |
| Independent 2D agreement | Blinded manual points on matched images; independent angle calculation | Agreement with the stated projected visual reference under tested conditions |
| Anatomical agreement | Calibrated, synchronized reference system and defined anatomical coordinate model | Agreement with that reference, with its uncertainty; separate experiment |
| Repeatability | Separate recordings of the same participants, setup and conditions | Between-recording consistency, including biological and setup variability |

None of these implies diagnosis, clinical utility, population generalization or
fall-risk prediction. Rerunning identical inputs establishes determinism, not
between-recording repeatability. Manual visual landmarks are not true joint centers.

### Frozen implementation under evaluation

Baseline Git commit: `46298434990da7519435d152b25b46d2a3fc6769`.
Source: [knee-flexion.ts](../../frontend/src/offline/knee-flexion.ts).
Tests: [knee-flexion.test.mjs](../../frontend/tests/knee-flexion.test.mjs).
Previously verified: 16 focused synthetic tests and TypeScript checking PASS;
these checks were not rerun for this protocol.

- Feature `selected-side-2d-projected-knee-flexion`; algorithm `projected-knee-1`;
  configuration `knee-quality-1`; result `scientificValidation: not-validated`.
- Selected hip/knee/ankle: left 23/25/27; right 24/26/28. Both visibility and
  presence >=0.6, finite x/y/z and in-frame x/y are required for these points.
- Native `android-pose-0.1.1` resizes the decoded bitmap with
  s=min(1,768/max(W,H)), w=trunc(W*s), h=trunc(H*s). Normalized points become
  p=((w/h)*x,y). Flexion is 180 degrees minus the angle between hip-knee and
  ankle-knee vectors. A straight leg is 0 degrees. This unsigned result cannot
  characterize signed hyperextension.
- Dimensions come from one unambiguous decoded field in known-version diagnostics,
  not encoded dimensions or an assumed 16:9 ratio. The legacy record only supplies
  the last decoded size: constant dimensions across frames remain an assumption.
- No interpolation; invalid observations are null, and gaps >100 ms split segments.
  Duplicate/decreasing timestamps fail. Off-grid times are flagged. Available or
  partial computational status never means independently validated.
- Stored times use `requested-100ms-nearest-decoded-frame`; actual decoded-frame
  times remain explicitly unavailable. This limits which validation is possible.

## 2. Staged study and separation

Stage 0: freeze this protocol, annotation instructions, tooling, split manifest,
thresholds and software/model hashes. Synthetic checks qualify the tools only.

Stage 1: proposed feasibility pilot with 3 consenting adults, 3 separate trials
each. Use it to train annotators, assess workload, framing and reference precision.
Pilot participants and all their recordings stay outside final evaluation. It is
permissible to revise the draft using pilot findings, but issue a dated new version
and obtain A-03 acceptance BEFORE opening held-out algorithm/reference comparisons.

Stage 2: proposed held-out feasibility evaluation with 10 additional adults,
3 trials each, and 20 prespecified sample slots per trial. This is a practical
workload target (600 slots, two annotations each), not a power calculation or a
clinical sample-size justification. The broader 15-30-person study remains separate.
If fewer than 10 evaluation participants complete the prespecified evidence,
report descriptive feasibility results; do not declare this target achieved.

Keep all trials, aliases and identical content hashes for a person within one
partition. Freeze participant assignment and randomization seed before tuning.
No test-frame tuning of thresholds, smoothing, side choice, alignment or exclusion
rules. Algorithm changes after evaluation require a new version and fresh held-out
evidence; the examined partition becomes development evidence.

## 3. Capture standardization and safety

Use the Samsung Galaxy A25 5G SM-A256E/Android 16 as the initial device stratum.
Use the existing portrait, rear-camera, muted 720p mode with its actual encoded
and decoded dimensions recorded. Record actual FPS/PTS, lens and stabilization
settings; do not assume that 720p specifies constant 30 FPS. No 0.5x lens, zoom,
camera motion or stabilization-setting changes within the initial stratum.

Mount the phone on a stable stand approximately at knee-to-hip height, optical
axis perpendicular to the straight walkway. Log height, distance, lens, camera
roll and the setup diagram. Keep the participant near the central image region
with head/feet and selected-side hip/knee/ankle visible throughout the scored
interval. Check alignment with a level/plumb reference and floor direction marks;
freeze the practical positioning tolerances after the pilot, before evaluation.

Use a level, unobstructed path, even light and ordinary comfortable clothing/shoes.
Record 10-15 seconds, including settling time if needed; score only comfortable
straight walking, not standing, acceleration, turns or stopping. No forced limp,
weights or hazardous tasks. Stop for discomfort or participant request. No minors
or clinical cohorts under this draft. Rest between trials and repeat setup checks.

Use the same visible anatomical side and travel direction for all three trials
of a participant. Balance left/right across participants where feasible and report
each stratum separately; insufficient evidence for one side means no claim for it.
Do not confuse visible side with screen travel direction. Log failed takes; allow
at most one replacement per trial for an observed capture fault BEFORE viewing
algorithm results. Retain the failure in attempted-trial coverage statistics.

## 4. Reference evidence and frame correspondence: prerequisite

Previously deleted raw videos cannot be reconstructed. Existing saved sessions
without identifiable corresponding images cannot enter matched-frame validation.
The current release deletes the source before successful storage and does not
export reference frames or actual decoder PTS. DO NOT disable deletion, intercept
private cache files or introduce retention as an undocumented workaround.

Before new study capture, approve a separate research retention/acquisition route
and verify that it supplies source hashes, images and frame correspondence. This
route is not implemented or authorized by this document. Two claim scopes exist:

1. Preferred exact-image route: an explicitly approved research harness records
   the precise inference bitmap identity, requested time and source frame identity
   for each extraction attempt, including failures. Annotate that bitmap without
   model overlays. Constant per-frame dimensions must be verified. The harness
   must demonstrate extraction equivalence before claims about Android extraction.
2. A separately retained video with a desktop replay can support the same frozen
   TypeScript angle engine, but replay extraction is a distinct pipeline until
   matched-image/model equivalence is established. Do not assign Android provenance
   or fabricate native diagnostics merely to make desktop records pass its adapter.

A second phone filming the same walk is not a corresponding image from the Android
camera. It can only serve as a separately synchronized reference with its own
projection/calibration limits. A screen recording is not an exact inference frame.

`getFrameAtTime(..., OPTION_CLOSEST)` retrieves a nearby frame, not proof of the
requested instant [R1]. Never match by frameIndex/FPS alone, nearest requested
time alone, or by choosing the reference angle closest to the model output.

For each attempt preserve requested timestamp, decoder PTS/frame ID if established,
hash of the actual bitmap used, dimensions/rotation/resize transform and selection
method. Exact image identity makes 2D comparison simultaneous within that pair
even if its PTS is unknown; record unknown PTS as null. Anatomical synchronization
still requires real timing. Exclude unverifiable pairs from primary angular error,
retain them in coverage, and report why correspondence is unresolved.

Flag repeated selection of the same source image. Count it only once in primary
error summaries (first scheduled slot), with later duplicate slots reported in
coverage; duplicated frames are not independent observations. Keep any supplementary
all-requested-slot analysis clearly labeled. No nearest-frame substitution after
seeing results. Quantify decoder-time offsets where actual PTS becomes available.

## 5. Independent 2D annotation

Two trained observers independently annotate every scheduled image in randomized
order, blinded to MediaPipe points, confidence, feature values and each other's
annotations. A preparation operator chooses the straight-walking interval from
video without algorithm output. Require >=3 seconds of eligible straight walking;
otherwise record insufficient interval. No complete gait cycles are required for
this per-frame endpoint and no cycle/event algorithm is introduced.

From the expected 100 ms slots inside that interval, choose 20 evenly spaced slot
indices including first and last: round(j*(N-1)/19), j=0..19, N>=20. Freeze these
IDs before any model results. Keep unavailable/unmatched slots; never replace them
with favorable frames. Use the exact corresponding image evidence for annotation.

Reference points: selected-side visual hip-joint-center proxy, knee-joint-center
proxy, and ankle-joint-center proxy, with supervisor-reviewed illustrated anatomical
landmark definitions from pilot examples. Do not substitute clothing edges or the
contralateral limb. A biomechanics-informed reviewer must approve how the hidden hip
center is estimated; if it cannot be located reproducibly, mark reference unavailable.
No physical markers without an approved amendment, trained placement and an explicit
marker-based reference definition. Markers do not automatically identify joint centers.

Record H,K,A in the exact inference-image pixel coordinate system, without
anisotropic display stretching. If a larger source image is used for localization,
apply a documented, independently checked transform back to the inference bitmap;
keep both coordinates and transform. Observe square-pixel assumptions explicitly.

Calculate the reference angle independently using vector orientation:
alpha=atan2(Hy-Ky,Hx-Kx), beta=atan2(Ay-Ky,Ax-Kx);
interior=abs(wrapToMinusPiPi(alpha-beta)); reference=180-interior*180/pi.
Do not call GaitSense's angle routine to construct its own reference. Verify the
annotation tool with known-angle diagrams and non-square images before participant use.

Store each observer's coordinates, angle, visibility/ambiguity reason, tool version
and date. After independent files are locked, discrepancies >5 degrees or conflicting
annotatability decisions trigger a third blinded reviewer. Keep original values and
adjudication reason. For agreed pairs use the mean of the two independently calculated
angles; for adjudicated pairs use the third reviewer's independent angle. Unresolvable
anatomy stays unavailable, never adjusted toward the algorithm.

Re-annotate a seeded 20% subset after >=7 days, randomized and blinded to the first
annotation, to assess intra-observer agreement. Assess observer quality BEFORE
adjudication: agreement cannot be manufactured by averaging or deleting disagreements.

## 6. Optional anatomical reference and synchronization

This stage requires additional equipment/access and supervisor approval. Preferred:
calibrated multi-camera marker-based 3D motion capture operated by a trained lab,
with static calibration, anatomical segment definitions, joint-center estimation,
documented joint rotation convention and independent processing. Record calibration
residuals, sampling rate, filtering, marker placement and occlusion handling.

A calibrated dynamic electrogoniometer may be a narrower alternative if a qualified
supervisor approves axis alignment, attachment/slippage checks and its uncertainty.
A handheld goniometer at static poses only checks static agreement; it cannot validate
dynamic walking. An unvalidated IMU, another pose model or another uncalibrated camera
is not automatically anatomical ground truth. If equipment is unavailable, defer
anatomical claims and complete only the 2D study.

Acquire a common hardware trigger where possible; otherwise record shared visible
synchronization events before AND after the trial. Estimate time offset and drift
from those events, never by optimizing knee-waveform agreement. Map actual video PTS
to the reference clock; document clock residuals and exposure/readout uncertainty.
Reference interpolation onto verified image times is allowed only within valid
reference support, under a frozen method; never fill missing GaitSense samples.

Proposed timing gate: total alignment uncertainty <=10 ms AND independently estimated
angular uncertainty <=2 degrees over the corresponding reference-time window. This
is a chosen error-budget allocation, not a property of the current app or a clinical
standard. Use the maximum reference-angle deviation within the uncertainty window,
not just a convenient mean velocity. Include reference sample spacing/filter delay.
If unknown or exceeded, exclude from primary anatomical agreement, report coverage
and a timing sensitivity analysis. Current requested timestamps alone cannot meet it.

Compare separately (a) model 2D angle versus calibrated reference landmarks projected
into the same camera, and (b) model 2D angle versus the specified anatomical flexion.
Projection and anatomical definitions differ. No fitted test-set offset or post-hoc
sign reversal; prescribe neutral pose, axes and sign during pilot calibration.

## 7. Inclusion, missingness and denominators

Record all enrolled participants, attempted/failed recordings, prespecified slots,
image matches, reference availability, algorithm availability and exclusions in a
flow table. Exclude reference frames for blur, occluded/ambiguous points, incorrect
view, unverifiable image correspondence or unapproved use, independently of model error.
No exclusion merely because the algorithm-reference disagreement is large.

Engine thresholds remain frozen at 0.6/0.6 and its current geometry/vector checks.
Retain every null result and reason code. Full-session engine coverage uses all
expected session samples; calculate study-interval coverage separately. Do not
confuse session `partial` with invalidity of every individual available angle.

For each recording attempt define S=20 prescheduled slots, R=slots with a usable independent
reference on a unique corresponding image, M=R slots with an available model angle.
Report R/S (reference yield), M/R (model coverage on reference-eligible slots), M/S
(end-to-end yield), and (R-M)/R (model unavailable rate). Use null, not zero, for a
ratio with a zero denominator. Also report model availability on all study slots
and all session samples. Break missingness down by participant, trial, side and cause.

Thus 0<=M<=R<=S. A failed take or attempt without an eligible walking interval still
contributes S=20 planned opportunities and R=M=0; these are denominator entries,
not invented frames/timestamps. A permitted replacement is a separate attempt and
does not erase the failure. Analyze all available matches from all attempts without
choosing the best take. The nominal 600-slot workload excludes these extra attempts.
An entirely unattempted planned trial is recorded separately as incomplete cohort
evidence, never silently removed to permit a pass. Withdrawal follows approved data
deletion rules; retain only permitted aggregate accounting and mark cohort incompleteness.

Compute errors on all M pairs, even in trials below the completeness threshold;
flag those trials and show sensitivity summaries. Do not silently discard them.
Proposed trial completeness is M>=15/20. An insufficient participant/trial cannot
be replaced after results are inspected. Failed takes remain failures in attempted
trial yield even when an allowed replacement succeeds.

## 8. Prespecified metrics and provisional tolerances

For model a and reference r, signed error e=a-r (positive means more estimated
flexion); absolute error=abs(e); MAE=mean(abs(e)); bias=mean(e); RMSE=sqrt(mean(e^2)).
Report median, IQR, 5th/95th signed percentiles, 95th absolute percentile and maximum,
plus scatter, error-versus-reference-angle and error-versus-time plots. Correlation
is supplementary and is not an agreement acceptance test [R2].

Primary MAE/bias: average within trial, then equally across trials within participant,
then equally across participants. Error-distribution summaries use weights
1/(P*T_p*M_pt), where P is participants with matches, T_p their trials with matches
and M_pt matches per trial. Report absent trials/participants alongside this conditional
analysis. Here a trial in the error aggregation means a recording attempt, including
an allowed replacement; participants are the independent analysis units and frames
are repeated observations. Define each participant's totals S_p, R_p, M_p across
ALL their attempts, including failed ones. For coverage use the full enrolled
evaluation cohort of P_all participants, distinct from P with matched errors:

- Y = mean_p(R_p/S_p): participant-balanced reference yield.
- E = mean_p(M_p/S_p): participant-balanced end-to-end yield.
- C = E/Y: model coverage conditional on reference availability; equivalently
  sum_p(M_p/S_p)/sum_p(R_p/S_p). This is intentionally reference-yield-weighted,
  not an unweighted average of M/R values with undefined trials dropped.
- U = 1-C: conditional model-unavailable rate when Y>0.

Participants with S_p>0 and R_p=0 contribute zero to Y and E; their individual
M_p/R_p is null. If Y=0, C and U are null. If any enrolled participant has S_p=0,
cohort coverage is not fully estimable: report available-participant descriptive
figures with their denominator, mark the cohort incomplete, and prohibit a pass.
Report pooled sum(R)/sum(S), sum(M)/sum(R) and sum(M)/sum(S) separately as secondary
counts-based rates. Never mix pooled and participant-balanced rates in one gate.
The identity E=Y*C holds for the primary rates when Y>0. Y>=90% and C>=80% alone
only guarantee E>=72%, so the additional E>=75% requirement is stricter, not
contradictory. For example Y=90%, C=85%, E=76.5% satisfies all three targets.

The complete-attempt fraction F is the number of attempts with M>=15 divided by
all attempts, including failed takes as incomplete. It is a separate pooled
operational gate, not an angular-error metric. No claim of success if any of the
10 planned evaluation participants lacks the three planned trial records; a
documented failed trial counts as a record, not a successful measurement.

Use participant-cluster bootstrap (2,000 draws, seed 20260929) for 95% percentile
intervals, retaining each sampled participant's trials and frames together. Do not
treat hundreds of correlated frames as hundreds of independent people. Small-cohort
intervals remain unstable. Show participant/trial metrics, not only pooled numbers.
Resample from the full evaluation cohort, including participants with no matches;
recompute the same estimands and F in each draw, treating repeated sampled people
as distinct cluster copies. Record undefined replicates rather than silently
dropping/redrawing them. If any replicate is undefined for an endpoint, do not
issue an acceptance interval for that endpoint; its uncertainty decision remains
inconclusive pending a prespecified, supervisor-approved statistical amendment.
Use the inverse weighted empirical CDF (smallest value whose cumulative weight
reaches the requested probability) for weighted error quantiles. Use the same
inverse empirical CDF convention at 2.5%/97.5% for bootstrap interval endpoints.

Agreement plots may show descriptive signed-error quantiles. Conventional bias +/-
1.96 SD limits calculated from pooled frames are NOT valid independent-observation
limits for this design. Repeated-measure limits require a supervisor/statistician-
reviewed variance-components method; otherwise leave them descriptive [R2].

All numeric gates below are PRELIMINARY ENGINEERING PROPOSALS, not clinical standards.
Approve/freeze them under A-03 before held-out comparison; no result is known yet.

| Layer / criterion | Proposed rule | Basis and uncertainty |
| --- | --- | --- |
| Software math | All focused tests/typecheck pass; analytic angle fixtures within 1e-6 degrees; invalid fixtures return specified null/reasons | Numerical regression tolerance, not physical accuracy; current tests use this angular tolerance |
| Reference readiness | Before adjudication, participant-balanced observer MAE <=3 degrees and weighted P95 absolute disagreement <=7 degrees; same gates on repeated annotations | Deliberately tighter mean disagreement than model target; checks annotation reproducibility, not correctness of anatomical centers |
| 2D mean agreement | Participant-balanced MAE <=5 degrees and absolute signed bias <=3 degrees | Chosen coarse research resolution and systematic-error budget; requires supervisor acceptance |
| 2D error tail | Weighted P95 absolute error <=10 degrees | Limits large errors hidden by the mean; provisional twice the MAE target |
| Availability | Primary Y>=90%, C>=80%, E>=75%; F>=80% of attempts complete (M>=15) | Rates use the definitions above; practical yield goals prevent apparent accuracy through abstention/exclusion |
| Trial-to-trial error consistency | Within-participant SD of trial signed biases <=3 degrees as a secondary feasibility target | Tests consistency of measurement error across >=3 independently recorded trials, not gait waveform repeatability |
| Future anatomical comparison | Draft planning targets MAE <=5 degrees, absolute bias <=3 degrees, P95 absolute error <=10 degrees, plus timing gate above | NOT adopted acceptance criteria until equipment/model uncertainty and meaningful endpoint are reviewed; cannot inherit 2D acceptance |

For each primary 2D gate, equality meets the target. PASS requires the point target
and the corresponding 95% interval target: upper bounds <=5 degrees for MAE and
<=10 degrees for P95, the bias interval wholly within [-3,3], and lower bounds
>=90%/80%/75%/80% for Y/C/E/F respectively. A valid point estimate outside its
target is NOT MET even if its interval overlaps the target. A point target met
with an interval crossing a limit or unavailable is INCONCLUSIVE. An endpoint
with no usable evidence is NOT_EVALUATED; undefined rates never count as passes.

Overall primary 2D decision: no evaluation evidence means NOT_EVALUATED; otherwise
any valid primary gate NOT MET means NOT MET; all primary gates PASS plus completed
cohort, software/reference readiness and approval prerequisites permit PASS within
this study only. All other cases are INCONCLUSIVE. Report each gate and blocking
prerequisite, not just the aggregate label. Reference-readiness point thresholds
apply to pre-adjudication observer errors, with intervals reported; the minimum
paired/repeated annotation sample size and acceptable annotatability disagreement
rate remain A-03 decisions to freeze before evaluation. Until resolved, readiness
is pending and an overall PASS is prohibited. The repeatability target is secondary
and reported separately, not used to rescue failed primary agreement. No broad
validation claim and no change to the engine's `not-validated` field follow from
these study decision labels.

The 5-degree target is a practical proposal, not borrowed performance. Stenum et al.
reported 5.6-degree knee MAE for a different OpenPose/motion-capture workflow [R3];
this illustrates the importance of system-specific evidence, not a transferable
threshold or expected GaitSense result. None of these choices is a minimal clinically
important difference.

For repeat recordings report trial biases and per-participant sample SD, then
sqrt(mean(s_p^2)) as the within-participant error-consistency summary. Report the
same trial-level visual-reference angle summaries descriptively to show biological
variation. Do not match unrelated recordings frame by frame or invent gait phase.
ICC, if added, requires a frozen model/unit/absolute-agreement definition and adequate
participant variation; it is not a substitute for angular error. Device remounting or
another day is a separate repeatability stratum, not silently pooled with same-setup trials.

## 9. Data, metadata, provenance and privacy

Private study records must include:

- Pseudonymous participant/trial IDs, partition, approval and consent-version pointers,
  authorized purpose, operator/observer IDs, capture protocol/version and trial order.
- Device/OS/app/build/model hashes; feature algorithm/configuration versions; lens,
  orientation, dimensions, resize rule, setup measurements, footwear/lighting categories.
- Source hash; opaque image/sample ID; bitmap hash and dimensions; requested time;
  nullable verified PTS and frame ID; match method; duplicate flag; synchronization
  events/clock mapping/uncertainty; study-interval and scheduled-slot manifest.
- Both independent point sets/angles, reference availability and reasons, repeat
  annotations, adjudication and audit trail; independent reference-tool version.
- Frozen model outputs including nulls/reasons, inclusion/exclusion decisions,
  denominators, evaluation-script version, split/seed and output hashes.
- Retention deadlines and deletion logs for originals, extracted images, annotations,
  numerical outputs, consent/contact registry and backups.

No names, contact details or private media in Git. Store encrypted/access-controlled
private evidence with the designated data steward; separate identity linkage and
consent records. Limit extracted images to scheduled annotation/QC needs and approved
retention. Preserve an immutable original while authorized, then delete on the agreed
schedule, including derived identifiable images and backups. Do not promise that coded
landmarks are anonymous. No public upload or external annotation service by default.

The institution must determine approval/exemption (A-02); supervisor accepts protocol,
cohort and thresholds (A-03); consent must explicitly cover reference annotation,
any extra equipment/markers, retained source/images and exact withdrawal/deletion
deadlines (A-04); named team roles/access require A-05. A-01 scope/stack decision
remains independent. These entries are pending; this document changes none of them.

Previously authorized development clips may be used only within their documented
permission; authorization for extraction does not imply permission for retention,
new annotation, publication or recruitment. The eight historical originals and
frame-estimated speed labels are NOT independent knee-angle ground truth. The separate
one-row reference table is not evidence for these participants or this endpoint.

## 10. Execution checklist and unresolved approvals

- [ ] Supervisor approves endpoint definitions, visual joint proxies and capture variant.
- [ ] Institutional determination, consent, contacts, retention dates and team access complete.
- [ ] Pilot/evaluation participants, sample-size rationale and split manifest approved.
- [ ] Approved source-retention/frame-evidence route exists and its claim scope is explicit.
- [ ] Exact image matching, orientation/resize mapping and reference tool verified synthetically.
- [ ] Annotators trained; independent/repeat annotation workflow and adjudicator assigned.
- [ ] Pilot reference precision reviewed; protocol/thresholds frozen before evaluation.
- [ ] All scheduled slots, failed takes, unavailable values and exclusions logged.
- [ ] References locked before comparison; trial/participant-balanced metrics and uncertainty run.
- [ ] Optional anatomical equipment, calibration and synchronization separately approved.
- [ ] Report permitted claims, missing evidence and sensitivity analyses; apply retention schedule.

Open decisions: supervisor acceptance of 3 pilot +10 evaluation adults and workload;
portrait/720p variant; landmark-placement guide; actual source-retention workflow;
annotators/adjudicator; exact retention/withdrawal dates; statistical reviewer;
availability of anatomical reference equipment. These are study-start gates, not
permission to collect now. If unresolved, complete synthetic tooling only.

## 11. Exact recommended next implementation task

Build a standalone offline validation-manifest and comparison utility, outside the
Android runtime, with deterministic SYNTHETIC fixtures only. Define versioned records
for scheduled slots, participant/trial/split IDs, bitmap identity/geometry, time
provenance, two independent annotations, adjudication and frozen feature results.
Validate one-to-one joins, partition/hash separation, missingness, units, nulls and
reference status. Calculate independent atan2 reference angles, trial/participant
MAE/bias/error distribution and the explicit S/R/M coverage denominators. Produce a
machine-readable report with status NOT_EVALUATED for absence of real evidence.

Test known disagreements, unequal trial/frame counts, duplicate images, unmatched
frames, all-unavailable cases, wrong units/side/geometry and leakage. Keep the angle
engine and its scientific-validation field unchanged; do not fabricate native session
metadata. No UI/native/SQLite change, source retention, real-data import, participant
collection, event detection or ML in that task. Statistical interval tooling and
approved evidence acquisition can follow as separately bounded tasks before evaluation.

## References

[R1] Android Developers, [MediaMetadataRetriever](https://developer.android.com/reference/android/media/MediaMetadataRetriever):
nearest-frame retrieval is not a guarantee of the requested instant.

[R2] Bland JM, Altman DG (1986), [Statistical methods for assessing agreement between two methods of clinical measurement](https://www-users.york.ac.uk/~mb55/meas/ba.pdf).
Method agreement differs from correlation; repeated recordings also require explicit
repeatability analysis. The participant-cluster approach here is a design choice,
not a claim that this paper supplies the study's numerical thresholds.

[R3] Stenum J, Rossi C, Roemmich RT (2021), [Two-dimensional video-based analysis of human gait using pose estimation](https://journals.plos.org/ploscompbiol/article?id=10.1371/journal.pcbi.1008935).
Independent synchronized reference comparisons motivate the separate anatomical
stage; their results cannot validate this implementation.
