# Candidate ankle-motion extrema

`detectMotionCandidates(session, frames, {direction: 1|-1, upright: true})` is a
pure TypeScript, deterministic engineering primitive. It does not identify foot contact,
heel strike, toe-off, steps, gait cycles or cadence. Scientific status stays not-validated.
It does not verify periodic walking merely because multiple extrema exist.

Signal: direction × (selected ankle x − (left hip x + right hip x)/2), in normalized
image-width units. The selected ankle is 27 for side_left and 28 for side_right;
both hips 23/24 are required. Direction +1 means increasing image x, -1 decreasing x.
It is a caller-supplied assertion, never inferred from anatomical side. Upright image
orientation and one straight travel direction must be independently established;
turns, camera movement and mixed directions are outside this implementation's support.
The saved Session does not certify these properties. No aspect correction is needed
for this horizontal-only signal, but normalized amplitudes depend on framing/distance.

Session parsing reuses the Android contract. Structural corruption, duplicate/decreasing
or invalid timestamps fail closed. Numeric quality is checked per required landmark:
finite x/y/z, valid confidence ranges, both visibility and presence >=.6 and x/y in
[0,1]. A valid session gate does not establish far-side hip quality. Invalid observations
remain null with per-landmark reasons; no interpolation, filling, sorting or FPS fallback.
The opposite ankle is not required. Missing saved frames are counted against the session's
expected 100 ms requests; absent images/PTS cannot be reconstructed.

Time is stored requested sampling time only. Differences are calculated directly;
gaps >100 ms or any invalid observation split segments. Irregular times <=100 ms apart
can be processed and are flagged; no inference of actual decoded presentation times.
The historical Python `06_gait_events.py` estimates FPS from a long landmark table,
whose repeated timestamps can produce a zero median difference and a 30 FPS fallback.
Its sample-count separation, interpolation and median filling are not reused here.
The earlier audit report was not found in versioned docs; the committed knee-quality
implementation and timestamp/validation protocol were used as the established foundation.

## Frozen method: ankle-motion-extrema-1 / ankle-motion-quality-1

1. Within each contiguous quality-valid segment, find strict three-observation maxima
   and minima. Equal adjacent values are ambiguous plateaus, not arbitrarily timed peaks.
2. Require support on both sides extending at least 200 ms. Use the nearest stored
   observation reaching that duration on each side; support may extend by up to one
   valid sampling gap beyond 200 ms. No interpolation. Segment endpoints and truncated
   supports are excluded explicitly, even if they visually appear to be extrema.
3. For maxima, local prominence is the smaller of the drops to the minimum on each
   support side. For minima, apply the same rule to the negated signal. Require >=.02
   normalized image widths. This bounded two-sided excursion is not SciPy's global
   prominence definition and does not establish periodicity or a completed gait cycle.
4. Within a segment and polarity, prefer greater prominence, then earlier timestamp
   on exact ties. Suppress candidates less than 400 ms from an already retained
   same-polarity candidate. Equality at 400 ms is allowed. Opposite polarities are
   separate motion extrema, never two validated steps. Return retained candidates
   chronologically. These are provisional engineering parameters, not physiological limits.

Each candidate includes stored timestamp, side, kind, signal value, prominence,
observation/segment index, support time range and minimum required-landmark confidence
over its support. Result-level configuration/version and timestamp provenance apply to
all candidates. Exclusions include boundary support, plateaus, low prominence and
separation; ordinary monotonic interior samples are not extrema and need no exclusion.
Invalid samples carry their own reasons. Gaps and segment index lists are retained.

Status is unavailable for fatal input/setup errors or no valid signal; insufficient_evidence
when no segment contains at least two same-polarity retained extrema; otherwise partial
if quality/missingness/irregular-time reasons exist, or available. Isolated candidates
are still returned with insufficient_evidence for inspection. Repetition is only a minimal
evidence flag, not a periodicity test. Expected boundary exclusions do not alone downgrade
status. Coverage reports expected/observed/valid/missing counts and valid fractions;
invalid observed samples differ from absent samples. No temporal summary is calculated.

## Verification and limits

Run from frontend:

```
node --experimental-strip-types --test tests/motion-candidates.test.mjs
npm run typecheck
```

Synthetic tests assert exact sampled extrema times, direction/side independence,
irregular intervals, time-based separation, invalid quality and gap/boundary behaviour.
They establish software behaviour only. At nominal 10 Hz requests, extrema can be missed
or aliased; timing is limited to observed requested instants. Repeated decoded images
cannot be identified from this legacy contract. Both-hip visibility, camera perspective,
pose jitter and framing sensitivity limit real use; a .02 threshold cannot imply a
physical distance. No real-reference event validation has occurred.

Keep contact labels/cadence disabled until their separate definitions, reference
procedures and validation are established. The bounded sensitivity review is recorded below.

## Completed bounded sensitivity verification

37 focused tests and TypeScript checking passed. No detector parameters or implementation
were changed for this verification. Analytic triangular signals use minima at kT and
maxima at (k+1/2)T, generally T=800 ms and amplitude .125 normalized image widths.
The fixed primary comparison set is 400,800,1200,1600,2000 ms, excluding the recording
endpoints at 0/2400 ms. Timestamp lists, tolerances and missing counts are specified
independently in the tests; they are not generated from detector output. Timing errors
below are maximum absolute deviations for retained matches; an empty set has null error.

| Scenario | Retained / analytic targets | Max deviation | Observed limitation / exclusions |
| --- | --- | --- | --- |
| 100 ms sampling, phase 0 | 5/5 | 0 ms | 2 endpoint exclusions |
| Phase 25 or 75 ms | 5/5 | 25 ms | 2 or 3 boundary-support exclusions |
| Phase 50 ms | 0/5 | null | Exact equal-height neighbours; 11 plateau and 2 boundary exclusions |
| 80 ms sampling (12.5 Hz) | 5/5 | 0 ms | 2 endpoint exclusions |
| 125 ms sampling (8 Hz) | 0/5 | null | 19 gaps, 20 singleton boundary exclusions |
| 85–95 ms jitter, offset 20 ms, T=720 ms | 5/5 | 20 ms | 2 boundary exclusions; actual requested intervals retained |
| Alternating 90/110 ms intervals | 0/5 | null | 12 gaps, 25 boundary exclusions |
| Missing sample at 400 ms | 4/5 | 0 ms | 4 boundary exclusions; no invented observation |
| Missing interval 300–900 ms | 3/5 | 0 ms | 4 boundary exclusions |
| Low hip confidence at 400 ms | 4/5 | 0 ms | 1 null observation and 4 boundary exclusions |
| Period 600 ms / 1200 ms | 7/7 / 3/3 | 0 ms | 2 endpoint exclusions each |
| Amplitude .005 | 0/5 | null | 5 low-prominence and 2 endpoint exclusions |
| Reversed explicit direction | 5/5 | 0 ms | Polarity reverses; times unchanged |
| Truncated interval 300–1700 ms | 2/4 | 0 ms | 4 boundary exclusions; insufficient same-polarity repetition |
| All ankle observations low confidence | 0/5 | null | All 25 observations null; unavailable |

All these fixtures had zero extra candidates under their prespecified one-to-one
matching tolerances. Retained partial-recording scenarios report partial, because the
short fixtures retain the existing 10-second Session contract and omit other session
samples. Empty candidate sets with valid signal report insufficient_evidence; all-invalid
signal reports unavailable. Short-fixture missing counts are session-level accounting,
not evidence that these artificial sampling rates are produced by the current Android app.

The original regression cases also verify flat and alternating +/- .005 noise yield
zero candidates; same-polarity maxima at 400/700/1000 ms retain 400/1000 and exclude
700 for separation at both 50 ms and 100 ms sampling. Exactly 400 ms separation passes.
Those checks assert exact timestamp lists and explicit rejection reasons.

These results characterize the frozen algorithm, not walking accuracy. The hard 100 ms
gap rule intentionally cannot support a slower stream or positive jitter around 100 ms;
changing it would require a separately reviewed configuration and new verification.
Exact plateaus have no unique observed extremum, so none is assigned. Near-equal floating
point peaks are not classified by an epsilon rule; tiny noise can break a tie and move a
candidate. Phase/amplitude tests are illustrative, not exhaustive robustness guarantees.
No interpolation, timing calibration, contact labels or threshold tuning was introduced.

Next core task: a bounded design of the independent reference-verification procedure
for these candidate extrema, including observable motion definitions, sampled-time
uncertainty, plateau handling and eligibility/coverage criteria. Resolve approved
exact-frame acquisition before real-reference evaluation; defer cadence/contact claims.
