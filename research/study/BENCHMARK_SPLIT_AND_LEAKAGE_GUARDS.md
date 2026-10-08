# Synthetic benchmark split and leakage guards

9 October 2026 · Sprint 6 · **NOT_EVALUATED**. Model: GPT-6.1 Sol;
reasoning effort: High. Phone, engineering video and research dataset: **none**.

**IMPLEMENTED SYNTHETIC SAFETY INFRASTRUCTURE** — **NOT YET INTEGRATED INTO FINAL
TRAINER** — **NOT SCIENTIFICALLY VALIDATED**. These guards do **not** establish
scientific validity or an approved study split. Application engineering and ML
research remain equally required; this package changes neither app behavior nor
research collection authorization.

## Purpose and boundary

The isolated standard-library [guard module](../benchmark_synthetic/guards.py),
[invented fixtures](../benchmark_synthetic/fixtures.py) and
[tests](../benchmark_synthetic/test_guards.py) demonstrate ownership, fit-access
and reference separation without an ingestion adapter, estimator or media access.
No historical trainer, metadata helper, V1/V2 contract or checker is modified.
See the [readiness audit](../../docs/planning/ML_BENCHMARK_IMPLEMENTATION_READINESS.md)
and [V2 invariants](../../docs/planning/RESEARCH_MANIFEST_V2_INVARIANTS.md) for their
separate scopes. The synthetic contract is not Research Manifest V2.

`SyntheticRow` is an immutable record with explicit `row_id`, `participant_id`,
`session_id`, `trial_id`, `attempt_id`, `media_id`, `canonical_source_id`, features,
reference and protected role. IDs must match `SYN-[A-Z0-9-]+`. Feature names are
abstract `f0`, `f1`, etc.; values are finite numbers or missing. Reference values
are opaque finite numbers or nonempty labels. `eligible` requires a value;
`pending`, `unavailable` and `rejected` require null. These are testing eligibility
flags, not evidence of qualified real labels. Records require `synthetic` and
`NOT_EVALUATED` markers. Markers/ID syntax cannot authenticate an input's origin;
there is deliberately no real-data loader.

## Ownership and missing identity

`validate_rows` rejects before splitting/fitting when required identity is missing,
blank, malformed or the literal `unknown`. It never derives identity from a path.
Only three roles exist: `development`, `validation`, `final_test`. A participant's
repeated sessions, trials, attempts and feature rows must have one role. Row IDs
are unique. A session has one participant owner, a trial one participant/session
owner, and an attempt one participant/session/trial owner. Conflicts raise explicit
`SafetyError` codes rather than filtering the row out silently.

Media ownership binds `media_id` to participant/role/canonical source;
`canonical_source_id` binds the underlying source to participant/role. Thus a
duplicate media token or declared alias crossing roles fails. Aliases within the
same owner/role may remain as rows: this does **not** count them as independent
trials or remove duplicate sampling weights. A caller must supply truthful lineage.
The package does not compute media hashes, open bytes, detect unlinked re-encodes
or perform perceptual duplicate detection. Future ingestion must establish exact
hash/alias lineage independently and retain failure/replacement accounting.

## Deterministic grouped splitting

`grouped_split` requires an integer seed and explicit counts for all three roles,
summing to the number of distinct participants, not rows. No percentages/default
study allocation are supplied. It first validates incoming ownership, ranks
participants by SHA-256 of canonical JSON `[version, seed, participant_id]`, then
allocates in development/validation/final-test order. Participant ID breaks ties.
Sorted output rows and assignments are stable under input row reordering.

Optional `fixed_final_test` membership must be distinct, known and exactly match
the requested test count. Supplying it keeps those participants sealed while a
different seed may change development/validation membership. Without it, changing
the seed may also change test membership: this is a synthetic allocation primitive,
not an enforcement mechanism for an approved final test. Real use requires an
externally frozen, versioned policy that prohibits repeated test selection.

`SplitPlan.serialize()` returns canonical JSON with schema/version, seed, counts,
fixed membership, sorted assignments and an input ownership digest. The digest
covers explicit row/identity/lineage fields; it is **not** a content hash, full
dataset checksum, consent proof or completed run provenance. Features/references
do not drive assignment. No allocation here is a real-world recommendation.

## Actual preprocessing fit access

The toy harness performs training-only availability selection, median imputation
and population-standard-deviation scaling. Constant columns have scale 1. The
availability fraction is explicit caller policy; the fixture's 0.5 is illustrative.
All rows must conform to one fixed feature schema; schema/value validation may
inspect held-out records, but held-out observations do not learn fitted state.

`FitReader` authorizes only development participants verified against row ownership.
An optional participant subset supports a fresh inner-development fit; a caller
cannot authorize validation or final-test participants by listing them. Each fit
stage obtains feature values through `read()` and records an immutable `FitRead`
at the successful access, including stage, row ID and feature names. Denied reads
return no values and produce no successful trace entry. References are never
returned by this fit interface. No developer-supplied membership log substitutes
for the executed reads.

Each fit constructs a new reader/state. Tests assert the actual nine successful
reads (three rows for each of selector/imputer/scaler), and actively attempt
forbidden reads in all three stages. The returned fitted state is immutable;
`transform` can use held-out rows without changing it or adding fit reads.
Python private attributes are not a malicious-code sandbox: a future trainer that
bypasses this interface is unprotected. The test harness is not proof that sklearn
or either historical trainer currently obeys these guards.

The six-row/five-person fixture makes leakage visible: `f1` is missing in all
three development rows but present in all three held-out rows. Whole-table
availability would be 3/6 = 50%; training availability is 0/3 = 0%. The selector
rejects `f1`. For `f0`, development values 2/missing/6 give median 4, filled mean 4
and scale sqrt(8/3). Held-out values 100/200/300 cannot change these statistics.
Mutating held-out features and opaque references leaves the entire fitted state
and read trace equal. No predictive model is fitted and no scientific score exists.

## Prediction/reference separation

Rows, feature tuples, references and prediction records are immutable scalar
structures. `attach_predictions` accepts a separate strict namespace containing
row/model IDs, status, value and failure reason; reference fields are rejected.
It defensively copies payload values, validates row membership/model IDs and rejects
duplicate row/model predictions. Available predictions require a value;
unavailable/failed predictions require null and a reason. Predictions can accompany
missing references, which remain missing with unchanged eligibility.

Reference digests are checked across attachment; `assert_references_unchanged`
detects a replacement record that changes the reference. Ordinary in-place field
assignment fails. These are in-process invariants, not authenticated persistent
storage or authorization controls. The framework cannot detect a caller encoding
a reference in a numeric feature; final ingestion needs a semantic feature allowlist,
independent reference provenance and leakage review.

## Verification and future integration

Run from the repository root, without writing Python bytecode:

```text
python -B -m unittest research.benchmark_synthetic.test_guards -v
```

**40 test methods PASS**, including all 18 requested scenario categories and
additional invalid-identity/schema/ownership/policy/reference cases. Expected
ownership, medians, scales, read IDs and null references are literal or analytical;
none are filled by calling the implementation to generate an expected fixture.
Serialization has a forced one-participant allocation oracle; its ownership digest
is checked structurally and for row-order stability, not asserted as independent
authentication. Adversarial rejection cases are successful tests, not failed runs.
All four new Python files pass syntax/import checks. No existing tests are directly
affected: this module imports no historical trainer, helper or V1/V2 checker.

Recommendation: **C now**, keep standalone until supervisor/reference/governance
decisions; **B later**, build a clean benchmark runner with a deliberate ingestion
adapter and fit interface after approval. Do not retrofit the historical trainers
incidentally (A): global selection, legacy endpoint handling, join/identity risks
and incomplete provenance need a coordinated migration.

Before real integration: approve endpoint/reference eligibility, participant
registry and lineage, partition/fold policy and sealed-test ownership; validate
feature semantics and train-only fitting in the actual chosen library; add
participant-balanced metrics, coverage/failure accounting and versioned artifacts;
prove references remain separate through output serialization. Final model choice,
mobile export/parity and physical runtime testing remain later work. No specific
endpoint, family count, cohort size or split percentage is decided here.

The benchmark software estimate remains **approximately 20%** under the audit's
integration rubric; scientific benchmark completion remains **0%** and status
**NOT_EVALUATED**. This infrastructure is bounded synthetic evidence only.
