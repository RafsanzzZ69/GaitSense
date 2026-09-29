# Exact-frame evidence and independent annotation workflow

Design/source audit only — 29 September 2026. Baseline: `1afe9927f117eeb9e4cc5289943f039cec4572d8`.
No scientific validation, data collection, software modification or research authorization is established here.
Companion to [KNEE_FLEXION_VALIDATION_PROTOCOL.md](KNEE_FLEXION_VALIDATION_PROTOCOL.md),
whose endpoint, sampling, denominators and provisional criteria remain authoritative.

## 1. Audited pipeline and present limitations

Sources inspected: [OfflineCapture.tsx](../../frontend/src/offline/OfflineCapture.tsx),
[framing.ts](../../frontend/src/offline/framing.ts),
[GaitSensePoseModule.kt](../../frontend/modules/gaitsense-pose/android/src/main/java/expo/modules/gaitsensepose/GaitSensePoseModule.kt),
[PoseSampleDiagnostics.kt](../../frontend/modules/gaitsense-pose/android/src/main/java/expo/modules/gaitsensepose/PoseSampleDiagnostics.kt),
[contract.ts](../../frontend/src/offline/contract.ts),
[knee-flexion.ts](../../frontend/src/offline/knee-flexion.ts) and
[knee-comparison.ts](../../frontend/src/validation/knee-comparison.ts).
These are source observations, not new device-test results.

| Stage | Actual implementation and implication |
| --- | --- |
| Capture | Rear camera, muted video, requested 720p and 16:9; portrait guidance. `recordAsync` limits 15 seconds/140 MB. Preview layout points and `contentFit="contain"` do not define encoded pixels. Actual lens, FPS, stabilization and exposure are not recorded. |
| Input | Only local mp4/mov files under app Camera cache accepted; native size <=150 MB and duration 9500–16000 ms. Consent boolean is the local-processing notice, explicitly not study consent. |
| Decode | For requested `t=0,100,...<duration`, `getFrameAtTime(t*1000, OPTION_CLOSEST)` returns a bitmap or null. Neither decoded frame index nor actual PTS is returned/persisted by this code. |
| Transform | Let returned bitmap be W×H. Scale s=min(1,768/max(W,H)); resize with filtering to trunc(Ws)×trunc(Hs), then convert to ARGB_8888 if necessary. That final `bitmap` is passed to `BitmapImageBuilder` and `detectForVideo(image,t)`. No additional app crop, mirror or rotation is applied at this call. |
| Coordinate space | Landmarks are normalized to the inference image. Knee analysis reproduces the truncated inference dimensions and scales x by width/height. Encoded rotation is diagnostic metadata, not another rotation to apply to landmarks. Decoder orientation behavior must be verified using a labeled fixture; the source alone does not prove device-specific rotation/color behavior. |
| Inference | VIDEO mode, bundled model hash, two candidate poses, detection/presence/tracking thresholds .6. Full 100 ms processing sequence supplies tracking context. Only exactly one pose with 33 landmarks is retained; usable gate also checks selected shoulder/hip/knee/ankle. No-pose/multiple-pose samples remain only in aggregate diagnostics. |
| Save | Successful sessions require <=5% multi-pose samples and >=70% usable samples. SQLite stores summary JSON and per-frame requested timestamp plus 33 x/y/z/visibility/presence values. Failed attempts have no durable attempt record. |
| Metadata | Summary includes session UUID, creation time, duration, sampled/pose counts, usable ratio, side, model hash, extractor `android-pose-0.1.1`, notice version, `rawVideoRetained=false` and requested-time method. Diagnostics include encoded dimensions, rotation, **last** decoded size, processing duration and aggregate detection counts. No per-image geometry, source/image hash, image, actual PTS or study consent is stored. |
| Deletion | Source deleted before successful SQLite transaction. Native `finally` attempts deletion for errors/cancellation inside the processing try; validation/model checks before that try do not themselves have this cleanup guarantee. JS processing `finally` also calls discard. Preview discard, interrupted recording/unmount and explicit leftover cleanup provide additional paths. Force-close/crash or deletion failure can leave cache files; the UI discloses this. No secure-erasure guarantee follows. |

The requested timestamp is both a selection request and the MediaPipe VIDEO timestamp;
it is not evidence of the returned frame's presentation time. Android documents nearest
frame retrieval through [MediaMetadataRetriever](https://developer.android.com/reference/android/media/MediaMetadataRetriever).
Different requests can select the same image. Existing session data cannot establish
which pixels were processed. Deleted recordings cannot be recovered from landmarks;
screen recordings and second-camera views cannot supply the missing exact image.

## 2. Options and recommendation

| Option | Benefit | Cost / allowed claim |
| --- | --- | --- |
| A. Explicit research-only Android evidence harness | Can snapshot the very bitmap supplied to inference, with matching landmarks and native processing context | Future narrow native work and equivalence tests required. Keep isolated from ordinary recordings; not a hidden production retention toggle. |
| B. Controlled desktop replay and annotation | Easier acquisition tools and potentially verified decoder PTS; no production app change | Different decoding/preprocessing/inference pipeline until equivalence demonstrated. Cannot label desktop results as Android extraction validation or manufacture legacy diagnostics. |
| C. Manual export from current History/preview | No implementation effort | Insufficient: History has landmarks only; preview/screen capture does not identify inference pixels. Not a valid reference route. |

Recommend **A for evidence acquisition plus a separate offline annotation workflow**.
Use a separately identified research build/harness, default-disabled evidence capability,
explicit per-attempt authorization and separate evidence storage. Production capture,
SQLite and deletion behavior stay unchanged. Prefer reuse of the processing path through
a narrowly reviewed future evidence hook over a divergent copy. Its packaging and
equivalence must be reviewed before making claims about the release app.
Develop contracts and synthetic tooling first; no research capture is authorized now.

Minimum retained evidence is selected lossless inference images plus provenance and
all-attempt accounting, not a blanket archive of raw videos. A research operator must
review the temporary video **without model output**, select a >=3-second eligible straight
walking interval, and freeze 20 slots using protocol round(j*(N-1)/19). This occurs
before inference/results, in the controlled harness, while the source is still authorized
and available. If no interval qualifies, log a failed attempt with 20 null opportunities.
Each permitted replacement is a new attempt; it never overwrites its failure.

Process the complete original 100 ms sequence to preserve VIDEO tracking context;
export the final inference bitmap at the selected slots before it is recycled, including
images with unavailable model results. Never run inference only on the 20 selected frames.
Record all-sample outcomes/identities without retaining all images. Null decodes retain
their slots and failure reasons. Keep model outputs sealed from preparers/annotators.

Deleting the source after verified evidence capture allows re-annotation of retained
images but does **not** allow full decoder or temporal-inference replay. The supervisor
must approve this restricted reproducibility claim and amend the protocol's authorized
original-retention requirement if adopting this minimized route. If full replay is
required, use explicitly consented, time-limited encrypted originals for those research
attempts only, with a named deletion deadline. Do not silently extend ordinary retention.

## 3. Identity, geometry and evidence package

Proposed separate versioned evidence-package contract; not new fields injected into
the strict comparison manifest. Store package and file hashes, audit events and a
restricted index linking the following records:

- Pseudonymous participant, partition, planned trial, attempt and ordered slot IDs;
  operator, authorization/consent-version references, approved scope and retention deadline.
  Keep identifying linkage and signed consent outside the evidence package.
- Source SHA-256 computed before deletion; source bytes/duration, encoded dimensions,
  rotation metadata; app/commit/build, device/OS, model and dependency versions/hashes;
  camera settings actually known, with unknown fields explicit.
- Every requested sample's timestamp, decode/inference outcome, null reason, and content
  identity. Selected slots link immutable inference images and model output records.
- Per-image decoded and inference dimensions, resize/filter/truncation rule, pixel format,
  color-space/alpha handling, orientation/mirror/crop behavior and provenance confidence.
  Verify constant geometry before using the legacy knee adapter; reject incompatible
  records instead of fabricating session diagnostics or success metadata.
- Canonical pixel digest: proposed versioned header (dimensions and format) plus row-major
  RGBA8 bytes with explicit channel order and no memory padding. Define/freeze serialization
  in tooling. Store lossless PNG file digest separately; PNG-byte hash alone is not the
  canonical pixel identity. Reopened PNG pixels must reproduce the inference digest.
- Requested time and actual PTS are separate. PTS is null for the present retrieval path;
  an independently verified future decoder may supply it with method/timebase/uncertainty.
  Never fill it from requested time, FPS, wall clock or frame ordinal.

Hash the exact bitmap after resize/conversion; do not reconstruct it later. Export must
not mutate it, add overlays, rotate it again, stretch it or redact it before hashing.
Verify on synthetic images that the artifact reopened by the annotation tool reproduces
the same pixels and geometry used for inference. Hashes establish integrity, not consent,
authenticity or correct anatomical reference. A sealed package digest plus restricted,
append-only corrections establishes the practical audit trail; corrected records get new
versions and retain prior provenance while retention permits.

**Source-frame identity remains a design gate.** The current API cannot prove the original
decoder frame ordinal/PTS. A content-addressed ID can identify the inference image, but
must be labeled as such in the evidence sidecar, never as verified source-frame index.
Identical pixels may also occur at distinct times. Conservatively flag identical inference
content as duplicates, retain every scheduled slot, and count only its first occurrence
in R/M. The supervisor must approve this content-identity interpretation for `frameId`,
or require a future verified decoder mapping before real manifest conversion. Actual
frame IDs with identical pixels can conflict with the current utility's one-bitmap/one-ID
rule; fail closed and document the conflict rather than minting aliases to evade it.

Exact same-image 2D comparison is possible with unknown PTS once the correspondence
route is qualified. Unknown PTS precludes claims of verified anatomical synchronization.

## 4. Independent annotation procedure

1. Data steward verifies package hashes/geometry and creates two randomized, pseudonymous
   image sets without model points, angles, confidence, results or each other's annotations.
   Show the selected anatomical side and approved placement guide; screen direction alone
   does not determine left/right. No model-assisted prelabeling.
2. Each trained observer independently marks hip/knee/ankle visual proxies, or records
   missing/ambiguous/occluded reasons. Use the exact inference image with aspect-preserving
   display; map zoom/pan clicks back to original pixels. Bounds and degenerate vectors
   are validated. No unrecorded higher-resolution substitute or altered image.
3. Record observer/tool/version/time, image digest/ID, coordinates and reason. Lock and
   hash both submissions before revealing disagreement. Calculate reference angles with
   independent atan2 geometry, not the feature engine. Agreeing pairs use mean angles.
4. Difference >5 degrees or disagreement on annotatability triggers a third observer,
   initially blinded to both point sets and all model results. Retain original annotations,
   third independent annotation, adjudication rationale and exclusions. Use the third angle
   if resolved; otherwise reference unavailable. Never adjudicate toward model output.
5. Repeat a seeded 20% subset after >=7 days, independently randomized and blinded to first
   annotations. Keep repeats separate from primary reference records. Assess pre-adjudication
   inter-/intra-observer errors using participant-balanced summaries. Proposed readiness
   MAE <=3 degrees/P95 <=7 degrees comes from the protocol; minimum sample size and
   annotatability disagreement limits still need approval. Current utility does not establish readiness.
6. Freeze references before joining sealed model outputs. Preserve every missing/excluded
   slot, failed attempt and reason in flow/yield reporting. No replacement of difficult frames.

## 5. Privacy, permissions and retention

[approvals.json](approvals.json) currently marks A-01 through A-05 pending. Existing
local-processing consent and authorized development footage do not authorize research
retention, recruitment, annotation, sharing or publication. Historical eight-video data
and speed labels are not independent knee-angle ground truth.

Before capture, institutional determination and supervisor approval must specify purpose,
participants, exact images/raw-source policy, observer access, withdrawal process and
deadlines. Name a data steward; keep encrypted restricted storage, separate identity keys,
controlled transfer and access logs. No public upload, Git inclusion, general photo-library
export, cloud annotation service or automatic backup of identifiable evidence by default.
Images and coded landmarks can remain identifiable. Minimize faces/background by approved
capture setup; do not silently alter inference pixels for the primary reference. Any
redacted dissemination copy is a separate derivative requiring approved use.

Specify expiry for temporary source, selected images, annotations, outputs, linkage and
backups; delete derivatives/replicas according to the approved withdrawal rules and record
permitted audit receipts. No invented retention duration or claim of certified privacy.
Export failure/cancellation must not create an untracked retained bundle: mark incomplete,
restrict access and follow the authorized cleanup policy. Ordinary session deletion does
not automatically delete a separately exported package; research deletion must explicitly
cover both locations and backups. Verify copy integrity before any planned source removal.

## 6. Compatibility and decisions still required

The committed utility is **synthetic-only**: `evidenceKind=synthetic`, exact-field validation
and `simulatedPrerequisites`. Real evidence must never be relabeled synthetic or approved
by toggling simulation booleans. A separately reviewed real-evidence adapter/schema and
approval gate will be needed later; this document does not authorize that implementation.

Its identity/annotation fields are reusable design targets: one source per attempt,
source/bitmap hashes, image ID, frame ID, inference width/height, nullable actual PTS,
requested times, two annotations, optional third and explicit unavailable values.
Preserve side and partition separation. Keep extra capture/consent/transform/repeat records
in a versioned sidecar linked by digest. A failed attempt currently requires null image/time
slots; partial research evidence must remain in the sidecar rather than being discarded
or forced into contradictory manifest fields. Freeze a reviewed mapping for partial
failures before real evaluation. Session quality rejection cannot be bypassed by fabricating
a valid Session for the knee engine; unavailable pipeline outputs remain unavailable.

Carry forward protocol S=20, R=unique reference-eligible slots, M=matched available model
slots; failed attempts contribute S=20,R=M=0. Preserve participant-balanced Y and E,
C=E/Y, complete-attempt F and the existing uncertainty rules. Do not change acceptance
criteria while collecting evidence. Mathematical checks, 2D agreement, anatomical
agreement and between-recording repeatability remain separate claims.

Supervisor decisions: research harness packaging/equivalence scope; portrait/720p versus
broader landscape/1080p protocol; minimized-image versus original-retention route;
content identity versus verified source-frame identity; partial-failure mapping;
landmark placement guide, annotator/adjudicator roles and readiness requirements;
pilot/evaluation split and cohort feasibility; exact retention/withdrawal/access rules.
Anatomical validation additionally requires an approved calibrated reference system and
real synchronization; no extra anatomical equipment is needed for the proposed 2D endpoint.

## 7. Ordered implementation and verification gates

| Order | Bounded work | Required verification before proceeding |
| --- | --- | --- |
| 1 | Synthetic evidence-package contract and correspondence preflight | Fixed hash vectors, tamper/mismatch/missing-image detection, transform/identity/time rules, all slots preserved; no real import or scientific PASS |
| 2 | Offline annotation interchange/viewer using synthetic images only | Known-angle pixel fixtures, portrait/landscape/zoom coordinate round trips, blinded separate submissions, locked originals and adjudication/repeat audit |
| 3 | Resolve approvals and freeze acquisition/schema choices | Dated supervisor/institutional decisions and consent/retention plan; unresolved choices block study use |
| 4 | Separately authorized research harness acquisition | Synthetic clips verify exact exported/inference pixels, orientation, resize, complete VIDEO sequence, duplicates/nulls, cancellation/failure cleanup and ordinary-mode non-retention; production equivalence demonstrated before Android claims |
| 5 | Separately reviewed real-evidence adapter | Reject synthetic/real confusion, unapproved provenance, altered images and unresolved identities; explicit failed/partial attempt mapping and observer-readiness gate |
| 6 | Authorized pilot, freeze, then held-out evaluation | Only after prerequisites; no collection or comparison is part of this task |

### Next coding prompt (bounded; not started)

Implement a standalone TypeScript **synthetic-only evidence-package contract and
correspondence preflight validator** beside the existing validation utility. Use in-memory
synthetic RGBA images and fixed SHA-256 test vectors; define versioned canonical pixel
serialization and separate file/pixel digests. Validate source/image/slot links, dimensions,
transform provenance, nullable actual PTS, explicitly content-based versus verified frame
identity, duplicates, failed/partial attempts and sidecar-to-manifest compatibility.
Return structured incompatibility reasons without manufacturing manifest fields or
approval. Include synthetic tamper, wrong geometry, missing slot/image, repeated content,
timestamp/identity confusion and source-mixing tests. Run only focused tests and typecheck.
Do not change knee-comparison.ts, the feature engine, Android/native/SQLite or existing
protocol; no media/filesystem import, capture, annotation UI, real-data support, scientific
decision, commit or push. Keep unresolved research policies explicit configuration/design
gates rather than choosing an authoritative study rule.

## 8. Readiness checklist

- [ ] Approvals, consent, access roles and retention/withdrawal dates resolved.
- [ ] Exact-image acquisition and source/content identity semantics qualified.
- [ ] Geometry/color/orientation and exported pixel equality verified synthetically.
- [ ] Slot selection occurs before model access; all failures remain accounted for.
- [ ] Two blinded observers, adjudicator and repeated-annotation plan ready.
- [ ] Real-evidence schema/adapter independently reviewed; synthetic path stays synthetic.
- [ ] Pipeline equivalence/claim scope frozen before approved research capture.

All unchecked items remain prerequisites. This design reports no new physical-device,
reference-agreement or privacy-certification result.
