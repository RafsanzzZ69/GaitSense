# Saved-session continuity audit — Sprint 5 Task 8

## Existing contract

`candidate-motion-interval-input-1` accepts `detector-segments` or `unknown`.
The former identifies the source of segment indices and gaps: a freshly computed
`ankle-motion-extrema-1` result. It is not a persisted continuous-video assertion.
The session wrapper checks candidate-to-observation links, segment membership,
finite usable signal values, consecutive observation indices, increasing requested
times and differences no greater than the detector's unchanged 100 ms limit.
It uses `unknown` unless that mode is explicitly requested and the checks pass.

The interval engine separately requires matching recording ownership, side, direction
and nonnull segment identity, valid increasing times and no overlapping known gap.
It pairs adjacent same-polarity candidates only. Session identity is necessary but
does not establish usable temporal continuity. These checks do not prove physical
cycle completeness, actual decoded-frame continuity or image identity.

## Production evidence

| Evidence | Actual representation and limitation |
| --- | --- |
| Recording storage assignment | One native process builds a frame list, generates a UUID and atomically inserts its summary and frames with that `session_id`. No separate process/request ID is persisted. |
| Selected/read identity | Loader binds summary and frame reads to the selected ID and rejects obsolete requests. Native SQL filters frames by `session_id` and orders by timestamp. Frame JSON itself has no ownership ID; matching caller IDs do not independently authenticate it. |
| Sampling clock | Native loops requested times 0..duration at 100 ms spacing, stores the request timestamp when exactly one 33-point pose exists. `OPTION_CLOSEST` supplies no actual PTS or exact-image identity. |
| Completeness | Summary retains requested and saved-pose counts. Adapter requires every declared pose record to be loaded, validates ordering/duplicates and preserves extraction omissions separately. |
| Quality | Saved x/y/z, visibility and presence remain available even for low-quality poses. Detector quality rules produce null observations and split usable segments. |
| Omitted samples | Decode failure, no pose or multiple poses produce no saved frame. Internal requested-time gaps over 100 ms split segments and enter the detector's gap ledger. Causes are not reconstructed. |
| Diagnostics | No-pose/multi-pose counters and diagnostics are text; this integration never parses them as authoritative evidence. There is no persisted per-request outcome ledger. |
| Segments | No motion segment IDs are persisted. Segments, candidate links and gaps are computed from the validated loaded observations, then checked by the wrapper. |
| Assertions | Native geometry and metadata-v2 operator direction/upright remain separate from continuity. Version 1 remains unassessed. |

## Decision and limits

Existing data supports the contract's **requested-clock usable-motion continuity**.
The production persistence path assigns frames to one recording transaction; the
analysis relies on native SQL and caller-bound reads, not independent authentication.
It cannot prove there was no unknown decoded-frame loss, repeated decoded image,
unsampled physical event or missed extremum. Those are not requirements that this
contract claims to establish. It can detect missing requested observations between
eligible centers from spacing and unusable observations from stored quality fields.
Leading/trailing omissions and causes remain unavailable; detector boundary support
and repetition requirements still apply. Known-gap and unknown evidence are distinct.

History previously omitted the explicit mode request, so the wrapper deliberately
used `unknown` despite having freshly computable segment evidence. The screen binding
now requests `{continuity:'detector-segments'}` only when no caller setup was supplied.
This requests checking; it is not `continuous=true` or a same-video assumption.
Explicit caller setup is forwarded unchanged, including `unknown` or omitted continuity.
The pure loader/adapter defaults remain unknown. No new continuity algorithm exists.

Presentation retains requested mode separately from the interval result's used mode,
actual detector gaps, exclusions and nullable measurements. Supported intervals are
observed candidate-motion differences on the requested clock, not validated physical
event timings. Scientific status remains NOT_EVALUATED. Timestamp, geometry, direction,
upright, side, ownership, polarity and signal requirements are unchanged.

Historical sessions can use freshly checked segments without a migration or rewrite,
but absent direction/upright stays absent. Unsupported historical sessions therefore
remain unavailable. A legitimate existing caller setup can request checked segments
explicitly; this does not repair actual PTS or source evidence retrospectively.

No native/storage/schema/metadata-version/UI-control changes are required for this
engineering contract. A stronger decoded-image continuity claim would need a separately
defined capture contract and new recordings; it is outside this task. Physical-cycle
completeness cannot be inferred even from eligible intervals.

## Local verification

25 saved-analysis integration tests exercise the production binding, loader, adapter,
wrapper, detector, presenter and panel projection with mocked reads. The supported
100-sample waveform yields 11 intervals per polarity at 800 ms; an omitted sample
at 1200 ms produces a known 1100..1300 ms gap and null crossing intervals. Low
confidence at 1200 ms also splits the segment without inventing a decoder-gap cause.
Two unlike supported extrema never form a same-polarity interval. Explicit unknown
continuity, absent historical assertions, side-specific signal and direction conflict
retain their exclusions. Existing selection-generation and lifecycle tests still pass.

Other focused suites: saved UI 22, loader 34, presentation 27, saved adapter 56,
session wrapper 16, saved-session wrapper 24, interval unit 51 and detector mapping
19. Total 274/274 PASS with no failures/skips; TypeScript and whitespace checks pass.
No native code changed, so native checks were unnecessary. These synthetic checks
do not establish Android runtime acceptance or scientific validity.

Recommend a small selective checkpoint before the release APK build, then a phone
test using one fresh engineering recording with explicit direction/upright setup,
offline reload and interval exclusions visible. No research dataset is needed.
