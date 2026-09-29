# Synthetic participant-level motion evaluation

`motion-cohort.ts` exports `evaluateSyntheticMotionCohort(unknown)` and the
`synthetic-motion-cohort-1` ledger contract. This is synthetic numerical infrastructure,
not real-reference evaluation. Scientific decision is always `NOT_EVALUATED`, validation
`not-validated`, and authenticity `not-established`.

## Input and provenance

The ledger contains `schemaVersion`, `evidenceKind: synthetic`, `participants`, and
`matching` (the existing MatchingManifest). Each enrolled participant has a unique ID,
a pilot/evaluation partition, and a nonempty list of planned trials. Each trial has an
ID, status, reason and zero to two attempt links. Each link identifies an actual matching
attempt, nullable `replaces`, and nullable `approval`. Participant/trial IDs share a
ledger namespace; matching IDs retain their existing namespace. The same participant
cannot occur in both partitions. Real-world aliases cannot be inferred from metadata.

The existing matcher validates the embedded manifest and generates reports in memory;
the aggregation consumes those reports without reimplementing assignment. Caller-supplied
unchecked report totals are not accepted. Existing version/configuration checks, regions,
image assertions, requested timestamps and PTS provenance remain unchanged. Output retains
matching configuration, timestamp provenance, full per-attempt reports, region reasons,
slots, unmatched/unscorable events and all trial links. Time proximity does not prove
image identity. No media or filesystem IO occurs in the module.

An attempt must be linked exactly once to its owning participant's planned trial. Orphan
reports, missing reports, duplicate links, malformed shapes, contradictory statuses and
invalid replacement links reject with error code/path. Matcher errors propagate with
matcher paths; ledger errors use ledger paths.

## Completion and replacements

- Unattempted: zero actual attempts; reason required. No synthetic failed attempt,
  opportunities, misses, extras or timestamps are manufactured.
- Failed: at least one attempt, all failed; reason required. Actual failed attempts
  retain the matcher's S=30,Q=V=R=D=T=0 representation.
- Completed: at least one recorded attempt; reason null. This means recording completion,
  not usable references, successful detection, or scientific acceptance.
- One original and at most one replacement per trial. A replacement explicitly links to
  that trial's original and has a nonempty synthetic authorization reference. Both remain
  in all-attempt denominators. This asserts authorization; it does not verify consent.

Collection is incomplete if any planned trial is unattempted, complete otherwise; an empty
partition is labelled empty. Failed trial counts and successful recording counts remain
separate. Trial count and cohort size are explicit inputs, not forced to the protocol's
unapproved proposed recruitment scale. Complete collection is not study eligibility/PASS.
Partial-acquisition failures remain subject to the existing matching-contract blocker;
never discard partial evidence to force a failed-attempt representation.

## Aggregation

Pilot and evaluation results are separate. Maxima and minima are explicitly labelled
at participant and partition level and never rescue each other. S/Q/V coverage is shared
signal evidence repeated in the two polarity reports, never additive across polarities.
Per-attempt side/view and trial strata remain available in retained reports; no side-
stratified scientific estimates or side-balance eligibility decisions are inferred.

For each participant average T,R,D across all actual attempts, including failures.
Full-cohort recall = sum(mean T)/sum(mean R); precision = sum(mean T)/sum(mean D).
These are not averages of personal ratios. Counts are pooled actual counts; the separately
labelled pooledDescriptive rates use total T/R and T/D. Zero denominators return null.

**Approved provisional engineering interpretation:** if any enrolled evaluation person
has zero attempts, full-cohort recall/precision are null. The same conservative rule is
used for pilot summaries. attemptedParticipantDescriptive rates retain only attempted
people and are explicitly not full-cohort estimates. Supervisor approval is required
before research use. Unattempted trials of a person who has other attempts mark collection
incomplete but do not manufacture additional attempt denominators.

Coverage is mean over people of Q_p/S_p and V_p/S_p, with conditional availability equal
to joint/reference coverage. Empty cohorts or any zero-attempt participant make full-
cohort coverage null. A recorded flat sequence can have full coverage and no reference
events; it differs from missing evidence, failed acquisition and unattempted collection.

Timing is conditional on matches: equal matched-person weight, equal matched-attempt
weight within person, equal matched-pair weight within attempt. Bias uses candidate minus
reference requested milliseconds. MAE/bias are weighted means, median/P95 inverse weighted
empirical CDF, maximum is over matched errors. No-match people/attempts are counted but
receive no fabricated zero timing errors. Unscorable observations and regions are counted
separately and retained in attempt reports; they do not become misses/extras.

## Uncertainty and boundaries

Evaluation only: 2,000 whole-participant bootstrap draws, seed 20260929, mulberry32-v1.
Canonical ID ordering makes input order irrelevant. Repeated participant draws are distinct
cluster copies, retaining every trial/attempt; metrics and timing weights are recomputed.
Intervals use inverse empirical 2.5/97.5 percentiles. Each endpoint logs undefined draws;
any undefined draw makes its interval null, with no redraw or deletion. Endpoints are
recall, precision, reference/joint coverage, MAE, signed bias and P95. Pilot uncertainty
is null. Small samples, observer disagreement and decoder uncertainty are not solved by
bootstrap. No acceptance thresholds or PASS decisions are implemented.

Source identity, observer readiness, replacement eligibility, partial-failure mapping,
cohort/side balance, the provisional zero-attempt interpretation, ethics/consent, approved
acquisition and retention still require supervisor/institutional decisions for research.
Requested-clock errors are not actual PTS latency, foot-contact accuracy, steps or cadence.

## Verification and next task

From frontend:

```text
node --experimental-strip-types --test tests/motion-cohort.test.mjs
npm run typecheck
```

Tests use hand-derived counts, balanced-versus-pooled rates, timing weights and simple
bootstrap endpoint bounds; fixtures are synthetic. They cover failed/unattempted trials,
empty denominators, replacements, partitions, ownership, malformed records, ordering and
polarity isolation. Recovery after shutdown found source/tests intact; this README had
not yet been written. No implementation reconstruction was needed.

Independent numerical review: 32/32 focused tests and TypeScript checking PASS. Added
hand-derived cases distinguishing ratios of mean counts from mean personal ratios and
pooled counts. A separate unsigned BigInt PRNG formulation supplies cluster selections
to closed-form, three-person bootstrap expectations; every endpoint interval and exact
undefined-draw count is checked, including repeated clusters and a zero-attempt person.
No expected aggregate is obtained by calling the production aggregation function.

The review exposed a floating-point CDF boundary defect: six zero errors among twelve
equally weighted pairs incorrectly returned the next error as the median. Quantiles now
compare exact reciprocal weights using BigInt common-denominator integer masses. Median
half-mass and P95 exact-19/20/below-19/20 regression cases pass. MAE/bias remain ordinary
floating-point weighted means. This is numerical software evidence, not scientific validation.

Next bounded task: synthetic-only detector-to-matching-to-cohort integration regression
fixtures, with independently specified reference events and explicit provenance. Preserve
all current algorithms and scientific boundaries; no temporal features or real-evidence IO.
