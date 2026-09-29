# Synthetic knee validation comparison utility

This pure TypeScript library implements the numerical definitions in
[GS-KNEE-2D-0.1-draft](../../../docs/planning/KNEE_FLEXION_VALIDATION_PROTOCOL.md)
at commit `c8fcfec2282702e9ab0bd9e819306d49241a641a`. It has no filesystem, video,
network, inference or app-UI dependencies. No real-reference evaluation has occurred.

## API and versioned manifest

`knee-comparison.ts` exports the JSON-serializable `ValidationManifest` type and
`parseValidationManifest(unknown)` runtime validator. This is the authoritative
schema: exact fields, versions, types and identity constraints are checked; unknown
fields and contradictory records throw an error before any report is calculated.
Use `evaluateSyntheticManifest(input)` as the validated public entry point.

| Level | Fields / meaning |
| --- | --- |
| Manifest | `schemaVersion=knee-validation-manifest-1`, `evidenceKind=synthetic`, `units=degrees`, evaluation/algorithm/configuration versions, simulated prerequisites, participants |
| Participant | Unique ID, pilot/evaluation partition, three unique planned-trial IDs, zero or more attempts |
| Attempt | Unique ID, planned-trial link, recorded/failed status and reason, selected side/device/capture-protocol/timestamp-method metadata, exactly 20 ordered slots |
| Slot | Unique ID, ordinal, nullable requested time, nullable image record, reference and model records |
| Image | ID, source SHA-256, source-frame ID, exact bitmap SHA-256, inference-image width/height, nullable actual PTS |
| Reference | available/missing/excluded, angle or null, image link, reason, two independent annotations and optional third-observer adjudication |
| Annotation | Unique ID, observer/tool provenance, image link, pixel hip/knee/ankle points or null and missing reason |
| Model | available/unavailable, angle or null, exact image link, reason; frozen algorithm/configuration comes from the manifest |

All fixtures must explicitly identify themselves as synthetic. The parser rejects
real evidence labels. Hashes in synthetic fixtures are dummy identity tokens, not
evidence that a file exists. There is no raw-video requirement. Identity checks
validate manifest consistency, not the truth of an asserted real-world provenance.
Requested times and nullable actual PTS are distinct and never used to infer image
matches. Camera side is inherited by both measurements from the attempt.

The independent reference uses `atan2` vector orientations in isotropic pixel
coordinates, not the knee engine's dot-product code. Available angles must agree
with the independent annotations (within 1e-6 degrees for serialization arithmetic).
Two valid observer angles differing by at most 5 degrees use their mean; larger
disagreement or conflicting availability requires a third, distinct observer.
Annotation readiness is NOT established simply by passing this structural check.
Reference/excluded status is preserved independently of model availability.

IDs for participants/trials/attempts/slots/annotations are globally unique. Image
IDs form a separate namespace with immutable metadata. A repeated exact image is
permitted within its original attempt: the first scheduled slot counts; subsequent
occurrences retain S but add a duplicate reason and contribute neither R nor M.
Conflicting image IDs, bitmap aliases, changed geometry, cross-attempt source reuse,
cross-participant/partition source or bitmap sharing, and incorrect joins reject.
Each recording attempt must also use a single source-recording hash; images from
different recordings cannot be combined into one attempt.
At most one replacement per planned trial is permitted; each is a distinct attempt.
Actual approval of replacements before seeing results is not verified by software.

A failed attempt contains 20 explicit unavailable/missing slots with no fabricated
image or timestamp. An unattempted planned trial has no attempt record and blocks
cohort completion. Every failure, exclusion, duplicate and unavailable value stays
in per-attempt accounting; reason counts may overlap and are not additive partitions.

## Computation and uncertainty

`summarizeParticipants` operates on a validated manifest, excludes pilot participants
from metrics, and supplies individual signed/absolute errors and attempt summaries.
`computeMetrics` and `clusterUncertainty` accept those validated summaries. These
lower-level functions are calculation primitives, not input-validation boundaries.

Signed error is model minus independent 2D reference, in degrees. Attempt means
are equally weighted within each participant with matches, then participant means
are equally weighted. Weighted absolute-error P95 uses weights
`1/(matchedParticipants * matchedAttemptsForParticipant * matchesInAttempt)` and
the inverse empirical CDF. Empty attempts/participants do not have invented errors;
they still count toward coverage and remain visible in the output.

For each attempt S=20, R=usable unique-image references, M=matched available model
angles. Each participant's totals include failed attempts. Primary Y is the mean
of participant R/S, E the mean of participant M/S, and C=E/Y. Thus E=Y*C, and
the separate E>=75% gate remains stricter than 90%*80%=72%. F is the pooled fraction
of all attempts with M>=15. Pooled S/R/M rates are reported separately. A participant
with no attempts makes cohort Y/E/C null; available-participant coverage is separately
labeled descriptive. Zero-reference participants contribute zero to Y/E; Y=0 makes
C null. No matches makes angular summaries null, not zero.

Uncertainty uses 2,000 participant-cluster draws with replacement, seed 20260929,
Mulberry32-v1. Each copy includes all the participant's attempts and observations;
duplicate cluster copies retain their multiplicity. No frame-level bootstrap.
The 2.5th/97.5th inverse empirical quantiles define intervals. An undefined replicate
is counted and makes that endpoint's acceptance interval null; it is never dropped
or redrawn. Generator/version/seed/thresholds are exported in frozen `EVALUATION`.

## Decisions and claim boundary

`decideMetrics` separately applies point and interval criteria. Threshold equality
passes: MAE<=5, |bias|<=3, P95<=10 degrees; Y>=.90, E>=.75, C>=.80, F>=.80.
Valid failing points are NOT_MET; passing points with absent/crossing intervals
are INCONCLUSIVE; undefined endpoints are NOT_EVALUATED. Overall PASS additionally
requires the protocol's ten evaluation participants with three planned-trial records
each, and complete simulated approval/software/reference prerequisites.

`simulatedPrerequisites` are scenario inputs for exercising decision logic; they
cannot grant approval or resolve pending research decisions. The report therefore
separates `simulatedDecision` (all four categories can be tested) from permanent
`scientificDecision=NOT_EVALUATED` and `scientificValidation=not-validated`.
It also explicitly states that actual study prerequisites remain pending. A perfect
synthetic cohort cannot become real validation evidence.

Supervisor decisions still include observer-readiness sample size/disagreement
limits, cohort feasibility, capture variant, exact-frame acquisition, consent and
retention; optional anatomical reference needs additional equipment and review.
This utility computes no clinical, 3D, gait-cycle or repeatability claim. It does
not automatically establish observer consistency or legitimate image provenance.

## Focused use and verification

From `frontend`, run only:

```text
node --experimental-strip-types --test tests/knee-comparison.test.mjs
npm run typecheck
```

For library use, pass an in-memory synthetic manifest to
`evaluateSyntheticManifest(manifest)` and serialize the returned report if needed.
The focused test file contains the executable synthetic manifest factory, analytical
expected results, missingness examples, deterministic intervals and decision scenarios.
No runner automatically loads project research folders or writes evaluation evidence.
