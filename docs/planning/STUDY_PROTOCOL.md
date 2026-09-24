# Dataset collection and endpoint protocol

Protocol: GS-SIDE-1.0-draft. REVIEW REQUIRED; do not recruit using this draft.
Owners: research lead, data steward, ML lead. Review: supervisor and appropriate
institutional ethics authority; clinical/statistical advice where available.

## Intended use and cohort

Non-diagnostic gait consistency research in consenting adults able to walk
independently and comfortably. Draft target: 15-30 adult volunteers, 3-5 trials
each (45-150 clips before exclusions); this is a feasibility target, NOT a
statistical power calculation or a claim of clinical adequacy. Reviewer must
agree sample size, analysis target and exclusions before collection.

No minors or patient/disease cohorts in this protocol. Do not proceed when a
volunteer reports pain, dizziness, injury, discomfort or unsafe walking; no need
to record diagnostic detail. Participation is voluntary. Stop on request or
discomfort. No ankle weights, forced limps, unfamiliar shoes, balance challenges,
speed pressure or intentionally hazardous walking. Optional self-selected pace
variations need explicit protocol review; default is comfortable walking only.

## Equipment and setup

- Ordinary RGB phone camera, stable stand, level unobstructed walkway, tape and
  visible floor markers. No wearable or extra sensor is required.
- Mark an independently measured 4 m timed zone with space before/after it.
  Keep start/finish markers visible; log measured distance and measurer code.
- Primary side view, camera approximately perpendicular to the walking path,
  around hip height; set distance by full-body framing through the entire zone,
  not one fixed distance for all lenses. Record height/distance/lens metadata.
- H.264 MP4, landscape, target 1080p/30 FPS; retain actual timestamps/FPS.
  A 60 FPS protocol variant must be recorded separately, not silently mixed.
- Even lighting, ordinary comfortable clothing/shoes, no bystanders in frame.
  Do not request clothing changes that compromise dignity or participation.
- A 10-15 s recording can include waiting; analyze ONLY the straight-walking
  interval. Do not slow a person artificially to make 4 m last 10-15 s.
  If too few steps are visible, adjust the approved protocol or add trials;
  never fabricate cycles or include turns in the measurement interval.

## Session checklist

1. Verify current institutional determination, protocol approval and signed
   consent before recording; assign P001-style code, never a name in filenames.
2. Explain stop/withdrawal rights; log device, setup, protocol and operator code.
3. Record one practice trial (not training data unless separately retained).
4. Record three comfortable side-view trials, same setup/direction. Permit rest.
   Optional two front-view trials use a distinct protocol/view label and are not
   mixed into side-view features. Do not relabel pace/view as disease.
5. Preview framing and quality; log failed takes and reason, not just successes.
6. Store originals only in approved access-controlled private storage. Separate
   consent/contact linkage from pseudonymous analysis records.
7. Annotate ground truth without seeing algorithm output; resolve disagreements.
8. Extract and QC features; apply consented retention/deletion schedule and log it.

## Ground truth and proposed acceptance gates

All thresholds below are provisional engineering study targets requiring A-03
approval BEFORE evaluating the final test partition.

| Endpoint | Independent reference / method | Proposed acceptance |
| --- | --- | --- |
| Step count / cadence (first primary measurements) | Two reviewers count events on original video over identical marked interval; cadence = 60 * steps / interval seconds with explicit boundary convention | Cadence relative error <=10% on >=90% of accepted evaluation clips; report coverage/rejection and absolute error too |
| Step timing, symmetry, variability | Frame/timestamp annotations of visible left/right candidate contacts; adjudicate uncertain events | Pilot defines achievable tolerance in seconds and ratio units; freeze before main evaluation |
| Knee range / arm swing (initial five-feature set with cadence, symmetry, variability) | Independent landmark/angle annotations on sampled frames; not MediaPipe output as its own reference | Report angular error, bias and repeatability; reviewer sets tolerances after annotation pilot |
| Hip angle, trunk sway, shoulder/hip symmetry | View-appropriate manual reference, fixed coordinate convention | Definitions and per-view tolerances reviewed before inclusion |
| Exploratory ML walking-speed target | Independently measured zone distance divided by elapsed crossing time; visible start/end markers and two reviewers, or synchronized independent timing | MAE/RMSE versus constant-mean and linear baseline, participant-grouped validation; not a clinical speed claim |
| Consistency sub-scores | Training/reference participants ONLY; held-out testing; explicit formula/percentile | Stability/repeatability and explanation review; no health interpretation |

Define the crossing landmark and boundary convention before annotations (e.g.
pelvis midpoint crossing each marker's image projection after setup review).
Record raw start/end timestamps and measured distance, not just calculated speed.
Perspective or obscured markers invalidate speed ground truth; visual guessed
boundaries and assumed 4 m are excluded from model targets.

Annotators use independent sheets and anonymous codes; retain both annotations
and adjudication, with timestamps, reviewed interval, method and uncertainty.
No automatic ground-truth generation from model features. A measurement target
computed from a model input is not independent evidence of predictive validity.

## Quality and failure policy

Proposed usable-frame threshold >=70% with required joints visible; complete body,
single person, stable camera, adequate light/sharpness. Require >=6 visible steps
for clip-level timing variability; log event count and abstain if insufficient.
Contact/swing/double-support timing remains unavailable until event validation.
Blur/brightness limits must be calibrated using good AND bad pilot clips.
Record all rejected clips/reasons and coverage; never hide exclusions to improve
metrics. Device, view and direction must not become accidental label shortcuts.

## Training and reporting plan

Use participant groups; never split frames or clips from one participant across
train/tune/test. Freeze split manifest before tuning; leave test data untouched.
Fit imputation, scaling, feature selection, reference distributions and score
thresholds inside training folds. Compare simple baseline and Random Forest
regression for independently measured speed. Classification only after a
separate valid non-clinical label specification; no fabricated disease labels.
Isolation Forest is a stretch typicality experiment, not diagnosis.

Report MAE/RMSE, R-squared only when meaningful, participant-level uncertainty,
failure/rejection rates, per-view/device robustness and repeated-trial stability.
Do not interpret many clips as many independent participants. A model that fails
to beat baseline is still a reportable research result, not grounds to hide data.

## Legacy data

Existing eight videos/four participants are engineering fixtures pending consent
and provenance audit, not automatically approved dataset v1. Current five-row
feature table, unknown views/conditions, estimated speed targets and stale
summaries must be repaired/versioned separately. Never overwrite originals.
