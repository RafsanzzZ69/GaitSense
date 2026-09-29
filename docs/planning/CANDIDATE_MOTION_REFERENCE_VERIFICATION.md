# Candidate motion-extremum reference verification

Specification GS-MOTION-REF-0.1-draft. Design only; supervisor/institutional acceptance
required before research use. Baseline `52aa2017c09a5bf2fee13c8abee34b96df7ee3e8`.
Scientific validation: NOT COMPLETED. No reference data collected or evaluated here.

Reviewed against [motion-candidates.ts](../../frontend/src/offline/motion-candidates.ts),
[its method and sensitivity report](../../frontend/src/offline/MOTION_CANDIDATES.md),
[knee protocol](KNEE_FLEXION_VALIDATION_PROTOCOL.md) and
[exact-frame workflow](EXACT_FRAME_EVIDENCE_WORKFLOW.md). Existing synthetic checks
(37 tests and TypeScript PASS) are prior software evidence, not rerun for this document.
This specification neither changes the detector nor approves acquisition or retention.

## 1. Question and endpoint

For an independently selected upright, straight, side-view walking interval, how closely
do frozen candidate maxima/minima agree with extrema of an independently annotated
**sampled 2D ankle-to-pelvis displacement signal**, and what fraction of planned evidence
is evaluable? Assess maxima and minima separately, with side and direction recorded.

The reference signal is d*(x_ankle-(x_leftHip+x_rightHip)/2), with horizontal coordinates
normalized by inference-image width. d=+1 denotes travel toward increasing image x;
d=-1 denotes decreasing image x. Anatomical left/right does not determine d. The visible
selected ankle corresponds to index 27 or 28; both hip visual proxies are required.
Human points use a supervisor-approved illustrated placement guide, not MediaPipe output.

Primary endpoints are participant-balanced event recall and precision on reference-
evaluable regions, accompanied by evidence coverage and unmatched counts. Conditional
timing MAE/bias/P95 are additional co-primary engineering gates. A low timing error on
a few matches cannot establish success. The quantity is a sampled projected-signal
extremum, not a continuous anatomical-motion extremum or a biomechanical contact.

Three distinct claims must remain separate:

- Analytic synthetic agreement verifies the numerical algorithm and its sampled behaviour.
- Independent image annotation evaluates the landmark-derived signal and candidate set
  against the same engineered signal definition under the tested acquisition conditions.
- Contact-event agreement requires a different, independently defined reference. Neither
  of the preceding claims establishes heel strike, toe-off, a step count or cadence.

An ankle's horizontal position relative to the pelvis does not itself observe contact
between foot and ground. Future contact work must define the intended event (for example
initial contact versus heel contact) and use separately blinded high-time-resolution
video annotation or appropriately calibrated/synchronized force or pressure equipment.
Specify contact thresholds, sensor uncertainty, occlusion and synchronization before
evaluation. Do not rename extrema, infer contact from alternating polarity, or transfer
the present acceptance criteria to contact classification. No clinical claims follow.

## 2. Frozen algorithm and independent reference procedure

Baseline algorithm `ankle-motion-extrema-1`, configuration `ankle-motion-quality-1`:
both hips and selected ankle finite/in-frame, visibility AND presence >=.6; gap >100 ms
or invalid observation splits a segment; strict three-sample maxima/minima; support
at least 200 ms on each side using nearest qualifying stored observations; local
two-sided prominence >=.02 image widths; same-polarity separation >=400 ms, stronger
prominence first and earlier time on exact ties. No interpolation or FPS conversion.

Reference construction must not call the detector under evaluation:

1. Before viewing model results, an operator establishes upright geometry, anatomical
   side, explicit direction and one eligible straight-walking interval. Record objective
   exclusions (turn, camera movement, occlusion), operator and setup provenance. Reject
   mixed-direction intervals rather than infer direction from the algorithm.
2. Two trained observers independently annotate both hip proxies and the selected ankle
   on every required exact inference image. Preserve image order within a recording
   for temporal review, randomize recording order, and hide all model points, confidence,
   candidates and the other observer's decisions. This is a sequence-annotation variant
   requiring approval; isolated random-image annotation alone is insufficient here.
3. Lock both point sets, missingness/ambiguity decisions, tool versions, timestamps and
   hashes. Independently calculate each sampled signal and identify strict extrema with
   the frozen engineering support/prominence/separation rules above using a separately
   implemented, analytically tested reference routine. Human missingness, not model
   confidence, controls reference eligibility. Shared numerical definitions are deliberate:
   this tests the sampled-signal endpoint, not an independent physiological definition.
4. Before any adjudication report observer event-set agreement and timing differences.
   Any disagreement in event existence, polarity, selected sample or annotatability goes
   to a third reviewer, blinded to model results. The reviewer first supplies independent
   points/eligibility decisions for the disputed support, then records rationale. Recompute
   the locked reference sequence from the agreed or adjudicated points; do not average
   event timestamps. Agreed frames use mean corresponding point coordinates. Unresolved
   point/event ambiguity stays indeterminate and reduces reference coverage.
5. Repeat a seeded 20% of recording sequences after >=7 days, blinded to prior work.
   Freeze minimum paired/repeated workload and observer-readiness tolerances with the
   supervisor before evaluation. Knee-angle observer thresholds do not apply to motion
   timing. Until readiness is approved and met, overall acceptance remains inconclusive.

Exact plateaus are recorded as ambiguous candidate timing rather than assigned a midpoint.
Near-ties sensitive to annotation error require review; freeze any reference ambiguity
band from the pilot before held-out comparison. Do not alter the detector's strict
equality rule. Report exact plateaus and uncertainty-induced ambiguity separately.

## 3. Acquisition, time correspondence and interval selection

Retain the precise post-resize/post-conversion inference image, source recording hash,
source-frame identity method, canonical pixel digest, file digest, decoded/inference
dimensions, orientation, transformations, requested time and nullable actual PTS.
An immutable link connects each image, landmark sample, reference points and candidate
observation index. Hashes alone cannot prove authenticity or correct decoder provenance.
Screen recordings, approximate-time extraction and another camera's image are not substitutes.
Previously deleted recordings cannot be reconstructed; historical videos or speed labels
are not automatically authorized reference evidence.

Requested sample times remain the primary **sampling-index clock** for this endpoint.
The detector and independent sampled reference use the same requested-time mapping.
Never describe differences on that clock as true physical event latency. Actual decoded
PTS, when verified, is stored separately and can support a secondary PTS-clock comparison;
it must not silently replace timestamps passed to the frozen detector. Unknown PTS
precludes continuous-time or synchronized-contact timing claims, but not same-image
sample correspondence. Report request-to-PTS offsets, duplicate images and decoder
mapping uncertainty when available; never estimate PTS using FPS or sample ordinal.

Proposed bounded design: one 3-second scoring interval per attempted recording,
aligned to the nominal 100 ms request grid (30 planned center slots, start inclusive,
end exclusive), chosen from video before model results. The interval-selection rule,
including a deterministic tie-break between eligible intervals, must be frozen after
pilot review. No eligible interval is a failed attempt with 30 planned opportunities,
not invented images/timestamps. Preserve one permitted replacement as a separate attempt.

Acquire and independently annotate the full sampled recording surrounding that interval,
not only the 30 centers. This supplies boundary support and full-segment separation
context; stronger-first suppression can depend on candidates outside a short local
window. Run both frozen candidate procedures on their complete available sequences,
then score event centers in the preselected interval. Keep outside events/context in
the audit, but do not count them as primary detections. Initial pilot workload and this
retention expansion need supervisor approval. The knee protocol's 20 spaced slots cannot
support temporal extrema verification and are not repurposed as if they could.

Unknown or repeated source images require explicit correspondence adjudication. Do not
quietly deduplicate detector inputs, interpolate, or retime them. Keep repeated requests
in the sampling ledger; indeterminate source identity makes affected reference supports
unscorable. A separately reported duplicate-image stratum may follow an approved policy.
The existing synthetic knee comparison/evidence schemas are not real motion-event
schemas. Their content-only and partial-failure blockers remain unresolved; do not weaken
them or relabel real evidence synthetic to accommodate this protocol.

## 4. Sampling uncertainty and missing evidence

A candidate time is an observed requested instant, not a fitted continuous extremum.
Report adjacent sample times and reference ambiguity intervals. Do not assume a universal
half-sample error bound: irregular spacing, missing frames, plateaus, multiple local extrema
and unknown decoder selection can exceed it. The earlier 0–25 ms synthetic results are
specific fixture results, not a bound on real timing error.

Define reference-evaluable center slots before unblinding the model: exact correspondence,
independent points and temporal context must allow a definite reference event or definite
non-event decision under the frozen reference procedure. A lack of reference events in a
well-observed flat region is different from an unknown region. Indeterminate supports,
plateaus and boundaries lacking required context remain in planned coverage denominators.
If missing context could change stronger-first suppression, mark every affected decision
indeterminate; if extent cannot be bounded, mark the reference segment indeterminate.
Never let model confidence or model/reference disagreement determine reference eligibility.

Model nulls/gaps, boundary exclusions, low prominence, separation exclusions and session
statuses remain in the ledger. A reference event where the model abstains is a miss.
An isolated returned candidate under insufficient_evidence is still compared; do not
discard a session solely because its summary status is partial/insufficient_evidence.
No returned candidates in an unavailable attempt means no invented detections. Reference
unavailability is not evidence of no motion; failures remain visible through coverage.

## 5. Prespecified event matching and accounting

Match only within participant, attempt, anatomical side, polarity and a contiguous
reference-evaluable region. An eligible edge has absolute requested-time difference
<=100 ms (proposal: one nominal sampling interval). Do not match across an indeterminate
reference gap or outside the scoring interval. Missing model samples do not erase
reference events; matching never interpolates a candidate.

Choose a one-to-one, order-preserving assignment maximizing the number of matches,
then minimizing total absolute timing difference, then lexicographically earliest
(reference time/ID, candidate time/ID) pairs for exact ties. A greedy nearest-neighbour
implementation is not an equivalent specification. One candidate cannot satisfy two
references. Preserve candidate IDs and all unmatched records; no post-hoc tolerance tuning.

For each attempt and polarity report:

- S=30 planned center slots. Q=reference-evaluable center slots. V=Q slots with a valid
  model signal observation. Failed attempts with no usable evidence have Q=V=0.
- R=reference events with evaluable centers; D=returned candidates with evaluable centers;
  T=matched pairs. Misses=R-T; extras=D-T. Candidates in indeterminate regions are
  separately counted as unscorable, never silently declared correct or extra.
- Reference coverage Q/S; joint signal coverage V/S; conditional signal availability
  V/Q. Report null for zero denominators. These are motion-specific counts, not the knee
  protocol's S/R/M image-angle denominators.
- Recall T/R and precision T/D, null when their respective denominators are zero.
  With R>0,D=0 recall is zero and precision null; with R=0,D>0 precision is zero and
  recall null. R=D=0 is not a perfect detection score.
- Signed matched error=candidate requested time minus reference requested time, MAE,
  signed bias, median/P95 absolute error and maximum. Also report sampled-index agreement,
  statuses, missingness causes, all exclusions and unscorable candidate counts.

Primary cohort rates balance participants: for each person first average T,R,D across
all their attempts (failed attempts included), then recall=sum(mean T)/sum(mean R)
and precision=sum(mean T)/sum(mean D). Report both polarities separately; neither may
rescue the other. These rates are event-opportunity-weighted after equalizing attempts
per person; they are not means of individual recall/precision ratios. Give per-person
and pooled counts/rates alongside them. For coverage use the mean across participants
of Q_p/S_p and V_p/S_p, with conditional availability equal to their ratio when defined.
Any enrolled person with zero attempts makes full-cohort coverage undefined and blocks PASS.

Timing summaries average within matched attempt, then equally across matched attempts
within participant, then equally across matched participants. Weighted P95 uses weights
1/(matched participants * that person's matched attempts * that attempt's matched pairs),
inverse weighted empirical CDF. Report participants/attempts without matches explicitly.
Zero-match attempts do not acquire fabricated zero timing errors.

## 6. Separation, uncertainty and proposed acceptance

Propose a feasibility pilot of 3 adults and held-out evaluation of 10 different adults,
three planned recordings each, subject to supervisor workload/sample-size justification.
This echoes a planning scale in the knee protocol; it is not approved recruitment or a
power calculation. Keep every person's trials, aliases and hashes in one partition.
Any tuning of reference ambiguity, thresholds or acquisition uses pilot participants only.
Freeze protocol, versions, matching tolerance, side balance and interval selection before
unblinding held-out model comparisons. If changes follow evaluation, that evidence becomes
development evidence; a new held-out evaluation is needed.

Resample whole participants from the full enrolled evaluation cohort, retaining all attempts,
using 2,000 bootstrap draws, seed 20260929 and a recorded PRNG version. Repeated draws of
one person are separate cluster copies. Recompute the same rates/weights each draw; never
bootstrap frames as independent people. Use inverse empirical 2.5/97.5 percentile endpoints.
Log undefined replicates; any undefined replicate makes that endpoint's acceptance interval
unavailable and decision inconclusive. Small-cohort intervals remain unstable. Report
participant/trial strata and side/polarity, not just a pooled score. Observer disagreement
and timing-resolution uncertainty are separate from the participant bootstrap.

All numbers below are **provisional research-engineering proposals**, not validated
performance, clinical standards or inherited knee-angle tolerances. Freeze before results.

| Gate | Proposed target | Rationale / caveat |
| --- | --- | --- |
| Software | Existing focused tests/typecheck pass; future matching fixtures pass exact expected assignments | Computational correctness only |
| Reference readiness | Approved observer/repeat sample sizes, ambiguity policy and agreement tolerances met | Numeric readiness limits pending pilot/supervisor decision; cannot assume success |
| Recall and precision | Each >=.80 for each polarity | Initial feasibility target allowing <=20% misses/extras in their respective evaluable event denominators |
| Requested-clock timing | MAE <=50 ms; absolute bias <=25 ms; weighted P95 <=100 ms | Resolution-aware engineering budgets, not physical contact timing; P95 is conditional and bounded by matching tolerance, so cannot stand alone |
| Reference coverage | Participant-balanced Q/S >=.90 | Prevent unverifiable regions disappearing from analysis |
| Joint signal coverage | Participant-balanced V/S >=.75 | Penalize unavailable pipeline outputs; no implication of minimum event recall |
| Cohort | All planned participants and three trial records each; reference readiness complete | Failures count as trial records, not successful measurements; missing participants block PASS |

For a defined endpoint, a point outside target is NOT_MET; equality meets target.
Point meeting target with a 95% interval crossing its limit, or unavailable uncertainty,
is INCONCLUSIVE. PASS requires the point and interval: lower bound above/equal minimum
for rates, upper bound below/equal maximum for MAE/P95, bias interval within [-25,25] ms.
No usable evidence gives NOT_EVALUATED, never PASS. Overall: absent evaluation evidence
is NOT_EVALUATED; any defined primary failure is NOT_MET; all primary gates passing plus
cohort, software, reference readiness and approvals permits study-scoped PASS; otherwise
INCONCLUSIVE. No label changes the detector's not-validated field automatically.

## 7. Known limits and authorization gates

Frozen sensitivity evidence includes exact half-sample plateaus losing all five analytic
targets, 8 Hz (125 ms) samples splitting at every interval, and alternating 90/110 ms
jitter splitting support. Bounded 85–95 ms jitter retained targets with 20 ms error in
one fixture. Missing/low-confidence observations remove support; small amplitude fails
prominence; boundaries lose extrema. Near-equal floating values can break exact ties.
Do not adjust the 100/200/400 ms or .02 settings to improve this study retrospectively.
Signal amplitude depends on framing, both hips may be occluded, and perspective/model
jitter can create apparent extrema. No evidence here generalizes to contact or cadence.

A-02 institutional approval/exemption, A-03 endpoint/reference/cohort/threshold decisions,
A-04 explicit sequence-evidence consent/retention/withdrawal, and A-05 named access roles
remain prerequisites; A-01 scope decision remains separate. Approve expanded temporal
image retention, exact-frame source identity, failed/partial acquisition mapping and
research-harness equivalence before capture. Keep ordinary-app source deletion unchanged.
Existing local-development permission is not study consent. Store evidence encrypted,
access-controlled and outside Git, with separated identity/consent linkage and explicit
deletion deadlines covering originals, derived images and backups. No new retention
period or privacy certification is asserted. Contact studies need separate reference
equipment/annotation, calibration and synchronization approvals.

## 8. Exact next coding milestone

Implement a standalone **synthetic-only candidate/reference event-matching utility**,
with a versioned contract for side/polarity, requested-time provenance, evaluable regions,
candidate/reference IDs and unavailable/ambiguous regions. Implement the order-preserving
maximum-cardinality/minimum-error/lexicographic matching rule above and per-attempt
T/R/D, misses/extras/unscorable counts and matched timing errors only. Test exact assignments,
100 ms boundary equality, ambiguous competing matches, wrong side/polarity/attempt,
duplicate IDs, zero denominators, gaps, missing outputs and insufficient-evidence candidates
using hand-specified fixtures. Do not implement cohort bootstrap or acceptance decisions
in that first bounded task. Keep scientific status NOT_EVALUATED and no real evidence IO.
Do not modify the detector, knee utilities, native code, UI or clinical/temporal features;
run only new focused tests/typecheck, report, and stop without committing unless requested.

This specification was reviewed for consistency with the frozen sampled-time detector,
independent annotation principles, missingness accounting and pending acquisition gates.
It provides no authorization to collect data and reports no real-reference validation.
