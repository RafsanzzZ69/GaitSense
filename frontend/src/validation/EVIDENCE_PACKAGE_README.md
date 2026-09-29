# Synthetic evidence-package preflight

`evidence-package.ts` implements `synthetic-evidence-1`, following
[the reviewed workflow](../../../docs/planning/EXACT_FRAME_EVIDENCE_WORKFLOW.md).
It has no file/network/media IO, native integration, data retention or evaluation logic.
The existing comparison utility and its thresholds are unchanged.

## Contract and API

`EvidencePackage` contains `schemaVersion`, `evidenceKind: synthetic`, the existing
`ValidationManifest` as `comparison`, and `records`. Each comparison slot requires
exactly one evidence record, including all 20 slots in failed attempts. Participant,
attempt, trial, partition, side, reference and model accounting come from the existing
manifest, validated with `parseValidationManifest`. No second coverage definition exists.
Records may be supplied in any order; joins use slot/image identities, never time proximity.

Each record contains participant/attempt/slot IDs, state/reason, requested time,
source-recording SHA-256, nullable decoded and inference images, transformation and
nullable exported-file SHA-256. Decoded and inference IDs are distinct even for an
identity transformation. Each pixel image records dimensions, canonical pixel digest,
format and upright orientation. Decoded metadata additionally records source `frameId`,
`decoder-frame` or `content-only` identity method, actual PTS/provenance, decoder version
and encoded rotation. Encoded rotation is metadata, not an instruction to rotate an
already oriented decoded image again.

`validateEvidencePackage(unknown, optionalByteFixtures)` returns a Promise of:

- `valid`: strict structure and internal correspondence checks succeeded.
- `compatible`: valid and no unresolved compatibility blockers. This is only synthetic
  contract compatibility, not study approval, reference readiness or actual acquisition.
- `issues`: first deterministic structural failure as `{code,path}`; no thrown exception
  for ordinary malformed JSON/fixtures. Existing manifest rejection is `invalid_comparison`.
- `blockers`: `content_identity_pending` or `partial_failed_evidence`, with record paths.
- `verifiedDigests`: number of supplied pixel/file fixtures successfully checked before
  any failure. A nonzero count does not override `valid=false`.
- Permanent `authenticity: not-established` and `scientificValidation: not-validated`.

Exact fields are required; unknown fields reject. Missing metadata uses `invalid_shape`.
Other stable reasons cover versions, IDs, hashes, geometry/orientation, time provenance,
states, transforms, slot completeness, ownership, immutable identity, joins and bytes.
Metadata-only validation checks assertions and digest syntax, not existence or authenticity.
An empty cohort remains representable, just as in the comparison contract; structural
compatibility never establishes cohort completion or a scientific PASS.

## Pixel and transformation rules

Canonical `rgba8-v1` bytes are ASCII `GS-RGBA8-v1\nW\nH\n` (decimal dimensions, no leading
zeros), followed by row-major unpremultiplied RGBA8 bytes, no row padding, upright
square pixels. `canonicalPixels` constructs this serialization; `sha256` uses Web Crypto
SHA-256. The host must provide TextEncoder and Web Crypto (the Node test runtime does).
No dependency/configuration changes or claim of current Android runtime integration.
Dimensions are limited to 1..16384 as a versioned tooling bound, not a study threshold.

`identity-v1` preserves dimensions/digest. `android-resize-768-v1` checks the native
min(1,768/max(W,H)) rule with integer truncation; decoded inputs are already oriented,
and inference pixels are represented in canonical RGBA after ARGB conversion. The resize
label declares native filtered scaling; it does not reimplement Android's pixel resampler.
No-op scaling must preserve the pixel digest. Crops, mirroring, extra rotation, unknown
formats or other transformations are unsupported and rejected, not silently approximated.

In-memory `ByteFixture` records use `{imageId,kind:'pixels'|'file',bytes:Uint8Array}`.
Pixel fixtures are raw RGBA payloads and are hashed with the canonical header. File
fixtures are hashed as supplied, separately from pixels. Byte fixtures are optional;
all supplied fixtures must match a known image and declared digest. Tests use an
independent Node SHA implementation and the standard SHA-256 `abc` vector.

Checking both file and pixel hashes does **not** prove that a PNG decodes to those pixels:
this module has no image decoder. Nor does it prove resized pixels derive from decoded
pixels, the source hash describes an actual video, or a decoder assertion is true.
Future acquisition tests must establish those relationships and color/alpha equivalence.
Resize rounding is checked numerically; pixel resampling/color transformations are not.

## Identity and incomplete evidence

All slot records are preserved. One attempt has one asserted source hash; sources/pixel
content cannot cross attempts/participants. Repeated IDs require consistent immutable
metadata, and one source frame/transform cannot silently produce conflicting inference
identities. The embedded parser also rejects bitmap aliases and incorrect reference,
observer or model joins. Exact duplicate images within an attempt remain scheduled
slots; comparison counting is delegated unchanged to the existing utility.

Actual PTS may be null only with `ptsMethod: unknown`; numeric PTS requires `decoder`
provenance and `decoder-frame` identity. Requested time may differ from actual PTS and
never establishes identity. These are synthetic assertions, not independently verified
decoder evidence. Content-only identities are valid metadata but block compatibility
pending the supervisor-approved identity/mapping decision; they are not relabeled as
verified decoder frames.

`present` requires inference evidence; `missing` requires no inference image; `excluded`
requires an excluded reference. Non-present states require a reason. Failed attempts
retain the comparison contract's 20 null image/time slots. Partial evidence can remain
in failed sidecar records but raises `partial_failed_evidence`; it is never silently
inserted into the comparison manifest or removed from attempted-trial accounting.
Preserving source hash without image/time on a failed record is allowed. The scope is
scheduled-slot metadata, not a complete acquisition log for all video samples.

## Research boundary and next step

No real-image import, consent certification, observer independence certification,
reference accuracy, clinical claim or scientific evaluation is provided. Research
acquisition equivalence, consent/ethics, retention/withdrawal, source-frame identity,
partial-failure mapping, annotation readiness and a real-evidence adapter remain pending.
Simulated manifest prerequisites cannot authorize research. Development permission
does not authorize collecting or retaining participant evidence.

Next bounded milestone: a synthetic-only offline annotation interchange/viewer with
known-image coordinate round trips, blinded independent submissions and immutable
adjudication/repeat provenance, after review of this contract. No acquisition harness yet.

From `frontend`:

```text
node --experimental-strip-types --test tests/evidence-package.test.mjs
npm run typecheck
```
