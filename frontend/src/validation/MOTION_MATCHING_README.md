# Synthetic candidate/reference motion matching

`motion-matching.ts` implements the per-attempt numerical portion of
[GS-MOTION-REF-0.1-draft](../../../docs/planning/CANDIDATE_MOTION_REFERENCE_VERIFICATION.md).
It does not invoke/change the motion detector, infer reference events, import media,
certify exact images or perform real-reference evaluation. No contact or cadence output.

## Versioned input

`MatchingManifest` uses `synthetic-motion-matching-1`, evidenceKind `synthetic`,
algorithm `motion-matching-1` and configuration `motion-match-100ms-1`. Exact fields
are checked at runtime. `parseMatchingManifest(unknown)` and
`matchSyntheticMotionEvents(unknown)` throw `MatchingInputError` with stable `code`
and `path` for invalid inputs. Unsupported versions/provenance, duplicate IDs/events,
wrong ownership/side, conflicting image assertions, invalid regions and contradictory
statuses reject. No events are silently dropped as input repair.

Each attempt has participant/attempt IDs, supported view and matching anatomical side,
recorded/failed status and reason, detector status/reason, requested-time provenance,
an asserted exact-image correspondence label, reference regions, 30 center slots and
separate candidate/reference arrays. These are already scoped scoring-interval records;
outside-interval context/events must remain in the upstream evidence audit. No cohort
enrollment/completion decision is inferred from this list of attempts.

Recorded attempts specify a nominal-grid scoring start and a 3-second half-open interval.
Regions must partition it completely without overlap or holes. They may be evaluable,
ambiguous or unavailable; non-evaluable regions require reasons. Region IDs are the
**shared reference-evaluable segment identity**, not the detector's model-quality segment
index. Explicit reference gaps prevent matching across them. Missing model observations
do not erase reference events or define reference eligibility.

The 30 ordered slots correspond to start+100*i, i=0..29. Model observations are valid,
missing or invalid, with reasons for the latter two. They measure coverage on this nominal
schedule, not a reconstruction of actual decoder timing. Model `available` requires valid
center observations; other statuses can retain valid observations. An unavailable model
cannot claim candidates, while insufficient_evidence candidates are retained for matching.
A candidate at a scheduled center cannot contradict a missing/invalid model observation.
Off-grid events are allowed for synthetic nonuniform-time scenarios, but are not silently
mapped onto center slots or used to infer their validity.

Failed attempts retain 30 missing/invalid slots with null requested times, no scoring
interval, regions or events, and an unavailable model. This is the no-usable-evidence
failure representation, not a resolver for partial acquisition failures. Preserve partial
failed acquisition in the upstream sidecar until its approved mapping is defined; do not
discard it to fit this input. The earlier evidence validator's blockers are unchanged.

Events identify participant, attempt, region, side, maximum/minimum polarity, requested
time, image ID and nullable decoder PTS with explicit unknown/decoder provenance.
Reference and candidate IDs share the record-ID namespace with attempts/regions; image
IDs are a separate immutable namespace. Reused image IDs cannot change ownership or PTS
assertions. Repeated requested selections of the same asserted image are representable;
this does not settle the research duplicate-image policy. Two events of one role/polarity
at the same requested instant reject as duplicate events, even under different IDs.

An event must fall inside its declared region. Evaluable regions permit scorable events;
ambiguous/unavailable regions require the corresponding status and a reason. Known-time
ambiguous observations can be retained there without becoming misses. A reference with
no identifiable time is represented by an unavailable region, not an invented event time.
Region eligibility must be established independently before using real model results.
Arrays may be reordered except for the explicitly ordered 30 slots. No input is mutated.
The 160-event-per-role limit and 0..16000 ms requested range bound this prototype's work;
they are software limits, not clinical rules. No 400 ms detector spacing is imposed on
independently supplied synthetic sets: close competitors must remain testable.

## Assignment and numerical outputs

Within each attempt/side/polarity/reference region, sort events by requested time then
ASCII ID. Dynamic programming selects an order-preserving one-to-one assignment:

1. Maximum matched pair count.
2. Minimum total absolute requested-time error.
3. Lexicographically earliest sequence of (reference time, reference ID, candidate time,
   candidate ID) pairs.

An edge is eligible at absolute difference <=100 ms, including equality. A nearest-first
greedy match can sacrifice cardinality; tests include references 100/200 and candidates
20/110, where the correct two pairs have errors -80/-90 ms. Candidate-reference time
proximity is a numerical matching rule, never proof of same-image correspondence.
Different events legitimately have different images; image IDs do not need to equal
across matched events. Exact image provenance must be independently verified upstream.

For each polarity output pairs, signed/absolute errors, missed scorable references,
extra scorable candidates, and separately unscorable references/candidates with reasons.
Counts are S=30, Q=evaluable center slots, V=Q slots with valid model observations,
R=scorable references, D=scorable candidates, T=matches, misses=R-T and extras=D-T.
Q/V are shared signal coverage duplicated in each polarity report, not to be summed
across polarities. Coverage is Q/S, V/S and V/Q; recall T/R and precision T/D. Zero
denominators return null, never perfect scores. Failed attempts contribute S=30,Q=V=0.

Matched timing includes signed bias (candidate minus reference), MAE, inverse empirical
CDF median/P95 absolute error and maximum. These are **per-attempt conditional** summaries,
not cohort-balanced results. Empty matches produce null timing, not zero. Polarity status
is unavailable when Q=0, insufficient_evidence when Q>0 but no matches, otherwise available.
This is numerical output availability, not acceptance; source detector status is separately
preserved. Regions and center-slot reasons remain in the result.

Actual PTS is never used for matching or error calculations; output declares the requested
clock and `actualPtsUsedForMatching: false`. No interpolation, synchronization estimate,
uncertainty interval, sample-index/FPS fallback, cohort bootstrap or acceptance gates.
The constant output is scientificDecision `NOT_EVALUATED`, scientificValidation
`not-validated`, authenticity `not-established`, even for perfect synthetic matches.

## Verification and remaining decisions

Tests assert hand-calculated assignments, cardinality/cost/tie priorities, 100 ms boundaries,
signed errors, counts, null rates, region gaps, side/polarity/ownership, malformed metadata,
unscorable observations, insufficient-evidence candidates and input-order invariance.

From frontend:

```text
node --experimental-strip-types --test tests/motion-matching.test.mjs
npm run typecheck
```

This utility does not establish annotation independence, image authenticity, physical
timing accuracy or actual foot contacts. Observer readiness, reference ambiguity rules,
sequence retention, source-frame/duplicate-image identity, partial-failure mapping,
approved acquisition equivalence and consent/ethics remain research prerequisites.
The committed matching policy itself is resolved; none of these pending decisions is
treated as approved by successful parsing. A real-evidence adapter is out of scope.

Independent mathematical review completed: the committed specification explicitly
requires chronological order preservation. A brute-force oracle enumerates equal-size
subset pairs, pairs them chronologically, filters edges at <=100 ms and ranks complete
objective tuples; it neither calls the matcher for expected values nor copies its DP.
All 3,969 pairs of zero-to-five-event subsets of [0,49,100,101,200,251] ms agree,
including 7,938 production comparisons with reversed input order. Exact pair identities,
cardinality, total error, signed errors, misses/extras and null-safe metrics are checked.
Equal timestamps across roles are included; repeated times within one role/polarity
remain invalid and are tested as such. Separate targeted tests cover side/polarity,
ownership, region gaps and unscorable observations. This is exhaustive on that finite
grid only, not a proof for every possible input or a scientific-validation result.
Final verification: 42/42 focused tests and TypeScript checking PASS. No production
matching changes were required by the review.

Next bounded coding milestone: synthetic-only participant-level aggregation with an
explicit enrolled-cohort ledger, preserving failed/unattempted trials and calculating
the protocol's participant-balanced rates. Keep bootstrap, acceptance decisions,
real-evidence IO and new gait features out of that first aggregation task.
