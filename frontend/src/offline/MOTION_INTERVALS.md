# Candidate motion intervals

`calculateCandidateMotionIntervals(unknown)` in `motion-intervals.ts` is a pure,
standalone requested-clock interval engine. Input schema is
`candidate-motion-interval-input-1`; algorithm is `candidate-motion-interval-1`,
configuration `same-polarity-contiguous-1`. Scientific status is always NOT_EVALUATED.

## Input mapping and trust boundary

The candidate type reuses the detector's timestampMs, side and kind fields. The caller
adds stable candidate IDs, participantId/attemptId/sessionId (explicit null when unknown),
and the detector result's caller-asserted direction to every candidate. segmentIndex is
copied from the detector or null if unavailable. The detector itself does not supply
candidate IDs or ownership; this module does not invent them. IDs must be unique within
one invocation. At least attemptId or sessionId must be known for an eligible interval.
A missing participant ID may stay null when the recording identity is known; changing
known/unknown ownership within a sequence excludes the interval.

Copy source algorithm/configuration versions, status/reasons and timestampProvenance
from the detector result. Only ankle-motion-extrema-1 / ankle-motion-quality-1 and
requested-100ms-nearest-decoded-frame with actualDecodedFrameTimes=false and
usesStoredDifferences=true are supported. Direction source is caller-asserted.
No PTS or FPS is inferred. Unsupported/contradictory provenance makes all intervals
unavailable; malformed structural input throws IntervalInputError with code/path.
Numeric invalid timestamps remain in candidates and invalidCandidates diagnostics.

`continuity: detector-segments` declares that segment indices and gaps came from the
associated detector result. Copy its gaps verbatim; same segment labels alone are not
independently verified continuity. If this evidence is missing, use continuity=unknown
and gaps=[]; intervals are excluded with continuity_unknown. The module does not
revalidate raw landmark observations or certify the caller's metadata assertions.
Prefer one invocation per recording: gap records are recording-local, not globally
identified. Mixed-recording input is guarded against cross-recording pairs but should
not be used to merge unrelated gap ledgers.

## Eligibility and order

Input order is meaningful and is never sorted or repaired. Validate global chronology,
then pair adjacent supplied candidates of each polarity separately. Other-polarity
candidates do not create an interval; intervening invalid timestamps or changes in
ownership, side, direction or segment still block continuity. Consecutive same-polarity
candidates must have increasing nonnegative safe-integer timestamps, matching ownership,
side, direction and nonnull segment identity. Known open gaps overlapping the interval
exclude it. Duplicate/decreasing timestamps are explicit exclusions, not FPS fallbacks.
A rejected candidate remains a boundary: it is not removed to connect its neighbours.
No alternative pairs or missing candidates are synthesized. For recordings with clocks
restarting at zero, use separate calls; concatenation is not sorted into apparent order.

Every proposed pair retains start/end candidate records, reasons and nullable elapsedMs.
Eligible elapsedMs is exactly end.timestampMs-start.timestampMs. Unknown continuity or
direction/ownership never becomes a valid duration. Unavailable source output blocks
all intervals, even if contradictory candidates were supplied. Partial source evidence
remains partial. Insufficient-evidence source status does not discard supplied candidates;
its original reasons remain visible. Recording boundaries create no extra candidates.

## Descriptive output

Each polarity has individual eligible/excluded intervals and count, arithmetic mean,
median (average of central two for even counts), minimum and maximum. No eligible
intervals gives null summaries and insufficient_evidence, or unavailable for globally
unsupported provenance/source status. With some excluded pairs status is partial.
Original candidates, invalid-candidate diagnostics, source status/reasons, direction
source, gaps and provenance remain visible. Summary counts refer to intervals, not cycles.
If callers mix compatible runs from different recordings/sides, summaries pool eligible
intervals within polarity only; they are not participant-balanced or clinical estimates.

Same-segment extrema do not prove every physical cycle was observed. Missed extrema,
plateaus, boundary exclusions, sampling resolution and pose error can lengthen intervals.
physicalCycleCompleteness is always unknown. These are candidate-motion periodicity
estimates, never step/stride time, heel-strike timing, contact validity or cadence.

## Verification

From frontend:

```text
node --experimental-strip-types --test tests/motion-intervals.test.mjs
npm run typecheck
```

Independent examples: times 100,900,1700 produce 800,800 ms. Times
17,628,1605,3000,3501 produce 611,977,1395,501 ms: mean 871, median 794,
minimum 501 and maximum 1395. Tests cover empty/single inputs, polarity interleaving,
side/direction/ownership transitions, gaps, unknown continuity, invalid order/provenance,
unavailable/boundary-truncated sources and immutability. No detector changes are needed.

No new scientific policy is assumed. Conservative exclusion of unknown continuity and
recording identity is an explicit engineering choice; accepting uncertain intervals as
valid would require a separately reviewed contract change. Next bounded task: independent
interval-contract review and synthetic mapping tests using actual MotionResult outputs,
including partial segments and omitted extrema. No UI/native integration is included.

## Sprint 3 detector mapping review

Independent arithmetic: 611+977+1395+501=3484; 3484/4=871 ms. Sorted values
501,611,977,1395 have median (611+977)/2=794 ms. Review found no demonstrated
production defect in same-polarity adjacency, chronology, ownership, gap exclusion or
null-safe summaries. No detector thresholds or production algorithms were changed.

`tests/motion-interval-integration.test.mjs` exercises both actual exported functions.
The small helper is test-only: participant/attempt/session identities and candidate IDs
are explicitly synthetic caller inputs; timestamp, side, kind, direction, version,
source status/reasons, segment indices and gaps come from MotionResult. It never assigns
an image identity. It verifies supplied segment membership, observation-index linkage,
finite nonnull signal values without quality reasons, consecutiveness and increasing
observation times within the detector's maximum gap. Missing or contradictory support
maps to unknown continuity and null segment indices, excluding intervals conservatively.
This is consistency checking of an in-memory detector result, not provenance authentication.
Raw landmark/video evidence and real ownership are not independently validated.

Independent integration expectations: maxima 400,1200,2000 and minima 800,1600 produce
800,800 and 800 ms intervals. Nonuniform requested times with a 720 ms synthetic period
produce 720,720 and 720 ms. Removing or invalidating the 1200 ms observation leaves
400,800,1600,2000 candidate centers in two segments; both proposed same-polarity pairs
are excluded. Truncating observations to 300..1700 leaves unlike extrema 800 and 1200,
so neither polarity has an interval. Reversing direction exchanges polarity counts;
left/right side does not determine direction. Short fixtures retain the valid 10-second
Session contract and explicitly report omitted observations through partial source status.

Verification: 29 interval unit tests and 17 detector-mapping integration tests pass
(46 total), plus TypeScript checking. Run both suites from frontend with:

```text
node --experimental-strip-types --test tests/motion-intervals.test.mjs tests/motion-interval-integration.test.mjs
```

Recommended third task for this batch: bounded interval sensitivity regressions for
omitted extrema and sampling-phase/plateau effects, demonstrating how otherwise eligible
intervals can span unobserved candidate cycles. Keep thresholds frozen, no imputation,
no clinical/contact/cadence labels and no production UI integration.

## Completed Sprint 3 sensitivity study

16 new deterministic tests use the production detector and interval engine. Reference
centers follow an independently defined 800 ms triangular signal; a 720 ms signal is
used for bounded jitter. Thresholds remain confidence .6, maximum gap 100 ms, support
200 ms, prominence .02 and same-polarity separation 400 ms. No production corrections
were needed. These are finite synthetic cases, not general error bounds.

| Scenario | Detected centers (ms) | Maximum / minimum intervals (ms) |
| --- | --- | --- |
| 10 Hz, phase 0 | 400,800,1200,1600,2000 | 800,800 / 800 |
| Phase 25 | 425,825,1225,1625,2025 | 800,800 / 800 |
| Phase 75 | 375,775,1175,1575,1975 | 800,800 / 800 |
| Exact phase 50 | None; equal-height plateaus | None; insufficient evidence |
| 12.5 Hz (80 ms spacing) | 400,800,1200,1600,2000 | 800,800 / 800 |
| 8 Hz (125 ms spacing) | None; 19 gaps | None; insufficient evidence |
| 85-95 ms jitter, period 720 | 380,740,1100,1460,1820 | 720,720 / 720 |
| 90/110 ms jitter | None; 12 gaps | None; insufficient evidence |
| Flattened peak near 1200, observations intact | 400,800,1600,2000 | 1600 / 800 |
| Missing or low-confidence observation at 1200 | 400,800,1600,2000 | Both proposed pairs excluded across segments |
| Unknown continuity | 400,800,1200,1600,2000 | All three proposed intervals excluded |
| Truncated 300..1700 support | 800,1200 | No same-polarity pair |
| All ankle observations invalid | None | Unavailable |

The flattened-peak fixture distorts the supplied landmark signal around an intended
1200 ms peak into an exact plateau. There is no missing observation or quality gap:
the detector reports one segment and excludes the plateau. The engine correctly reports
1600 ms between observed maxima without knowing a peak was lost. No new ground-truth-
dependent exclusion was added. physicalCycleCompleteness remains unknown, even for an
eligible interval. Constant phase shifts can leave intervals unchanged despite shifted
candidate timestamps; preserved intervals do not imply correct physical timing.

Final batch verification: 29 interval unit tests + 17 detector-mapping tests + 16
sensitivity tests = 62/62 PASS; TypeScript PASS. Run the three named suites together:

```text
node --experimental-strip-types --test tests/motion-intervals.test.mjs tests/motion-interval-integration.test.mjs tests/motion-interval-sensitivity.test.mjs
npm run typecheck
```

Next core milestone: a bounded analysis-result wrapper combining existing knee-flexion,
candidate motion and interval outputs for a supplied Session/PoseFrame sequence, with
explicit ownership/setup, unchanged algorithms and no UI/native/database integration.
First review how the wrapper will retain exclusions and unknown physical-cycle completeness.
Scientific validation and research acquisition approvals remain outstanding.
