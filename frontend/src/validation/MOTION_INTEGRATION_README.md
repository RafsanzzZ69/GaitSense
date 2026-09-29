# Synthetic motion pipeline integration regressions

`tests/motion-integration.test.mjs` exercises the exported production detector, matcher
and cohort evaluator together. No production adapter or algorithm is added or changed.
Fixtures and the small mapping helper are local to the test file and synthetic-only.

The independent waveform repeats every 800 ms. In the frozen [0,3000) scoring interval,
maxima are 400,1200,2000,2800 ms and minima 800,1600,2400 ms. Reference arrays are written
independently, never extracted from detector output. A 10-second, 100-request Session
satisfies the existing duration contract and supplies full support context. The matcher
receives only scoring-interval centers; the test sidecar keeps the full detector result.

## Boundary mapping

Participant/attempt/side are explicit fixture inputs. Direction is an explicit caller
assertion, never inferred from side. Candidate kind maps to reference polarity. Requested
times pass unchanged. Nominal slot masks come from detector observations: absent is
missing, null value is invalid, finite signal is valid. Model status and reasons remain
separate from recording completion. Empty input deliberately contradicts a Session with
one declared saved pose frame and exercises the detector's no_observations guard; it is
not a claim that an ordinary persisted Session permits poseFrames=0.

Model quality segment indices are not reference-region identifiers. Independently defined
reference regions determine scoring joins. Detector segment indices, quality reasons,
exclusions, configuration and direction stay in the in-memory sidecar because matching
has no fields for them. They are not claimed to survive inside the cohort schema itself.

Image IDs are explicit synthetic assertions: candidate image IDs come from the synthetic
frame ledger, and independent reference image IDs are separately declared. Equal/nearby
times do not establish image identity or authenticity. Actual PTS defaults to null/unknown;
a separate fixture supplies asserted synthetic decoder PTS offsets and verifies they do
not replace requested times. The cohort report retains requested-clock provenance, but
matched-pair summaries do not carry individual image IDs/PTS; the input ledger remains
necessary for that audit. No image bytes or real evidence are loaded or authenticated.

## Numerical expectations

- Clean motion: maximum R=D=T=4, minimum R=D=T=3; zero misses/extras/errors.
- References shifted +50 ms for maxima and -50 ms for minima: biases -50/+50 ms.
  Floating mean comparisons allow 1e-12 ms arithmetic roundoff; timestamp pairs remain exact.
- Missing/low-confidence observation at 300 ms: maximum D=T=3,R=4, recall .75,
  joint coverage 29/30; two detector quality segments, one reference region.
- Removing one reference maximum leaves one extra candidate, precision .75.
- Reversed direction exchanges polarity counts independently of anatomical side.
- Ambiguous [1000,1400) reference region: one unscorable maximum in each role,
  three matched maxima, no misses/extras, reference coverage 26/30.
- Failed recording: 30 additional planned opportunities but no fabricated events.
  An enrolled zero-attempt person nulls full-cohort rates; descriptive rates remain.
- Two successful attempts for one person and one unavailable attempt with known references
  for another: balanced recall .5 versus pooled 2/3, joint coverage .5.
- Empty/all-invalid model observations yield unavailable status and four reference misses;
  a flat valid signal is insufficient_evidence with full signal coverage.
- Region boundary between a nearby reference/candidate prevents that pair: three maximum
  matches, one miss, one extra. Metadata ownership/side/version inconsistencies reject.

Pilot/evaluation isolation, incomplete planned trials, ordered-input invariance at the
ledger/matching boundary and deterministic bootstrap output are also checked. Detector
input frames intentionally remain chronological; reversing them is not supported.

Run from frontend:

```text
node --experimental-strip-types --test tests/motion-integration.test.mjs
npm run typecheck
```

This is engineering compatibility evidence only. Scientific status remains NOT_EVALUATED.
Source-image authenticity, approved acquisition, independent annotation, supervisor/ethics
approval, consent/retention and the provisional zero-attempt research policy remain pending.
No contact timing, heel strikes, steps, cadence or clinical accuracy is established.

## Independent review checkpoint

29 integration tests and TypeScript checking pass. Hand-written exact pair IDs and
signed errors supplement the independent waveform and cohort expectations. For the
unequal-attempt fixture, personal mean counts are (T=4,R=4) and (T=0,R=4), giving
4/8=.5; pooled counts are T=8,R=12, giving 2/3. Neither is a detector-generated target.

The test-only sidecar guard now requires explicit participant/attempt ownership and checks
session/view/direction, candidate image mappings, observation indices and detector segment
membership. It checks a one-to-one mapping of every scoring-window candidate. Missing or
misassociated sidecars fail assertions; this is internal synthetic consistency, not an
exact-frame evidence validator. Production schemas remain unchanged. A bare cohort report
still cannot establish complete provenance, image authenticity or collection completeness.

Mutation cases demonstrate detection of missing sidecars, wrong owners/segments/images,
shifted timestamps, changed polarity and dropped candidates. An independently specified
collection inventory catches removal of a failed attempt or an unattempted participant,
even when the reduced ledger would otherwise parse. The production evaluator cannot know
about enrollment records omitted from its input; the external enrollment ledger is essential.

Review found no production defect or fundamental matching-policy conflict. Next bounded
work should define a synthetic evidence-completeness audit contract before any real
acquisition or production integration; this checkpoint does not implement that contract.
