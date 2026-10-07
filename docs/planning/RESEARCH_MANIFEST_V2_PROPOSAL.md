# GaitSense — Research Manifest V2 Proposal

**SCHEMA PROPOSAL ONLY — NOT IMPLEMENTED — NOT APPROVED FOR RESEARCH COLLECTION**

Proposed discriminator `gaitsense-research-manifest-2-proposal-0.1` · 8 October 2026 · Sprint 6 Task 2.

Scientific status: **NOT_EVALUATED**. This document creates no dataset, validator, migration, consent or approval. The [current v1 contract](DATASET_CONTRACT.md), [approval register](approvals.json) and [study checker](../../research/study/check.py) remain unchanged. Do not pass this proposal to that checker or add fields to v1 expecting acceptance. Design review and a separate implementation/qualification task must precede real use.

Read with the [supervisor brief](ML_SUPERVISOR_DECISION_BRIEF.md), [speed reference SOP](WALKING_SPEED_REFERENCE_SOP_DRAFT.md), [Sprint 6 audit](ML_THESIS_READINESS_AND_EXPERIMENT_PLAN.md) and [repository data policy](../REPOSITORY_DATA_POLICY.md).

## 1. Design boundaries and private storage

Model the study as **participant → study session → planned trial → actual attempts**. Captured sources, independent references, extracted features and model-run predictions attach to the appropriate attempt/version. An unattempted trial has zero attempts; a failed actual attempt still has an attempt record. Windows/frames are derived children, not new people/trials.

Use pseudonymous opaque codes only: no real names, emails, phone numbers, signatures, contact details, device serials or personally identifying original filenames in the ML manifest. Keep the participant/contact/consent linkage in a separately restricted registry. Pseudonymous movement records and device/date combinations can still be sensitive. Real manifests, raw/derived data and annotation submissions belong in approved private storage, not Git. Access control, encryption, retention and permitted-use review are required; `.gitignore` does not supply them.

Proposed types: `ID` = nonempty bounded pseudonymous code under a future frozen namespace; `Hash` = SHA-256 lowercase 64 hexadecimal characters; numbers finite, units explicit; absent facts null with status/reason. IDs are never inferred from filenames. Exact identifier patterns/resource bounds remain schema-review decisions; P001-style examples do not establish real participant identity.

## 2. Proposed logical entities

The following describes a future structured JSON manifest or equivalent linked private tables. Exact serialization and a machine-readable JSON Schema are **future implementation**, not delivered here. Entity arrays link by explicit IDs, with uniqueness and foreign-key/ownership checks; no unchecked duplicated "truth" fields.

| Entity | Key and proposed purpose |
| --- | --- |
| Manifest header | `schema_version`, `dataset_version`, `protocol_version`, `reference_policy_version`, `annotation_version`, `scientific_status`, private decision/audit references; `evidence_kind=research` only for genuinely authorized research, never relabeled synthetic evidence |
| Participants | `participant_id`, governance pointers, `cohort_role` (`pilot`, `main`, `external`), one scientific partition assignment |
| Study sessions | `session_id`, `participant_id`, coded visit/setup, course/setup references and known device stratum |
| Planned trials | `trial_id`, `session_id`, planned condition/order, lifecycle/closure and linked actual attempt IDs |
| Actual attempts | `attempt_id`, `trial_id`, capture/processing/reference/analysis status axes, replacement relationship, app-session mapping if genuinely known |
| Source assets | `source_file_id`, attempt ownership, hashes, alias/transcode/derivative relationships and retention/deletion facts |
| Capture/evidence records | Attempt/asset link, device/build/setup/native-geometry/time provenance, all requested sample outcomes if the qualified route supplies them |
| Independent reference records | Attempt/source/course link, independent A/B annotations, disagreement/adjudication, accepted speed label or unavailable/rejected status |
| Feature artifacts / model runs / predictions | Immutable versions/input digests/lineage, run configuration, partition/fold roles and separate predicted values/status |
| Split, governance and audit sidecars | Versioned outer membership/fold manifests and indirect authorization/access/deletion/correction records, linked by ID/hash where permitted |

Research `session_id` denotes a study visit/setup. `app_session_uuid` is a distinct optional mapping. A failure can have no app UUID. Do not copy an app UUID into participant/session/trial fields as proof of research ownership.

## 3. Grouping identity and trial lifecycle

| Field | Proposal / invariant |
| --- | --- |
| `participant_id` | Stable pseudonymous research person key, assigned through the private registry; unknown identity goes to quarantine, not a fabricated "unknown person" group |
| `session_id` | Unique study session linked to exactly one participant; repeated visits remain in the same participant cluster |
| `trial_id` | Unique planned passage linked to exactly one session; a replacement is not a new planned trial |
| `attempt_id` | Unique actual capture-attempt key linked to exactly one trial; exists even when no video or app session was saved |
| `planned_status` | `planned` = scheduled/open; `unattempted` = closed with no actual attempt and a reason; `attempted` = one or more actual attempts. This records acquisition, not scientific validity |
| `attempt_status` | `in_progress`, `completed`, `interrupted`; means lifecycle closure only. A completed failed-capture record is allowed; completed does not mean successful inference |
| `replacement_of_attempt_id` | Null for original; previous attempt ID within the same trial/participant for a replacement. No self-link, cycle, cross-trial substitution or loss of original record |
| `replacement_decision_reference` | Private approval/decision pointer and reason when a replacement exists; maximum/count/authority policy remains pending |
| `failure_reason` | Null or structured reason(s) with stage/code/detail; terminal failed stages require a reason. Use coded descriptions, not sensitive free-text identity/health details |
| `capture_status` | `in_progress`, `captured`, `partial`, `failed`, `cancelled`; create an actual-attempt record at capture initiation, even if capture then fails before producing bytes. A merely scheduled passage stays a planned trial; captured requires actual completed source evidence, not a placeholder hash |
| `processing_status` | `not_requested`, `pending`, `processing`, `succeeded`, `partial`, `failed`, `cancelled`; captures pose/feature execution independently of reference success |
| `reference_status` | `not_requested`, `pending`, `unavailable`, `rejected`, `accepted`; accepted is a reference decision, not a model/study PASS |
| `exclusion_reason` | Stage-scoped reason and policy/version: governance, reference, features or evaluation. Exclusion does not erase the acquisition ledger |

Do not store `capture_failed`/`processing_failed`/`reference_unavailable` as interchangeable aggregate status values. They map to their respective axes. `replacement_attempt` is represented by the relationship, not a mutually exclusive outcome. A usable independent reference may coexist with failed pose processing: preserve accepted label facts, unavailable predictions and coverage consequences separately.

Partial capture/extraction/annotation evidence stays partial; no successful-session fabrication or zero-filled measurements. Unattempted trials have no source/observer values. Final speed labels are null unless the reference is accepted. Completion/availability/eligibility should be derived from these axes and genuine policy decisions, not an all-purpose `accepted=true` flag.

## 4. Capture, device and assertion provenance

| Group / fields | Semantics and required distinction |
| --- | --- |
| Device | `device_manufacturer`, `device_model`, `os_name`, `os_version`, optional known API level, private `device_stratum_id`; no serial/advertising identifier |
| Build | `app_version`, `app_build_identifier`, `source_commit`, nullable `apk_sha256`, signing-certificate reference/hash if relevant; record build actually used, not assumed newest output |
| Protocol/setup | `protocol_version`, `course_setup_id`, `camera_view` (`side`, `front`, `oblique`, `unknown`), `anatomical_visible_side` (`left`, `right`, `unknown`), lens/mode and operator-code pointer if approved |
| Direction | `image_x_travel_direction` = +1 increasing x, -1 decreasing x or null; `direction_status`, `direction_source` and assertion record/reference. Does not follow from anatomical side |
| Upright | `upright_image_assertion` true/false/null with `upright_status` and `upright_source`; false is an explicit assessment, null is unassessed. Current app unchecked fields map to unassessed, not false |
| Encoded/source geometry | `source_width_px`, `source_height_px`, encoded rotation metadata and provenance; unknown remains null |
| Inference geometry | `inference_width_px`, `inference_height_px`, geometry status/source, constancy scope and observed-call count; per-sample geometry if the future qualified route supplies it |
| Transform | Application rotation/mirror/crop/resize rule, pixel format and decoder-orientation provenance; application `mirror=false` does not prove the camera/decoder never mirrored the image |
| Pose inference | Pose-model name/version/hash, extractor/configuration version, threshold/config record and known runtime/delegate settings |
| Sampling/evidence | Requested sample time, decode/inference outcome, nullable actual PTS, qualified timebase/frame identity, image digests and missing/repeated evidence status where available |

Keep `operator-recording-setup`, `caller-asserted`, native inference bitmap geometry and independently qualified observation evidence as different sources. An assertion-source tag does not identify the person who made it or authenticate image content. Unknown direction/upright/geometry remains unknown; conflict records preserve both assertions and the fail-closed result. Historical metadata-v1/unassessed setup is not silently upgraded.

Study sessions can group repeated device setups, but each actual attempt must retain the configuration used. For cross-device experiments, capture paired-person strata separately from unseen-person/withheld-device tests; preserve participant partitions in both.

## 5. Source integrity, lineage and retention

| Proposed field | Meaning |
| --- | --- |
| `source_file_id` | Opaque private asset key, with safe storage pointer in a restricted index; no identifying raw filename |
| `file_sha256` | Byte digest of that actual file, null if no bytes existed or were available for hashing; never a dummy research hash |
| `representation_kind` | `original`, `reencoded`, `derived`; role separate from actual attempt identity |
| `alias_of_source_file_id` | Same-byte asset alias, not a new recording/attempt |
| `duplicate_of_source_file_id` | Reviewed duplicate identity relationship; retain detection method and decision reference |
| `reencoded_from_source_file_id` | Explicit transformation parent; record transform/tool/version and reviewed source-to-derived timing relation |
| `content_lineage_id` | Reviewed common-origin grouping, permitting duplicate/transcoded lineage checks beyond byte hashes |
| `evidence_retention_status` | `unknown`, `retained_authorized`, `deletion_due`, `deleted`, `partial`; known authorization/expiry pointers required for retained research evidence |
| `deletion_status` | `not_due`, `due`, `in_progress`, `completed`, `failed`, `unknown`; receipts identify asset/derivatives/replicas/backups covered |

A file hash establishes **byte identity/integrity only** when compared with actual evidence. It does not prove consent, participant identity, anatomical correctness or scientific validity. Different hashes do not prove independent recordings: re-encoding changes bytes. Image-file hashes and canonical inference-pixel hashes are separate fields; content identity does not establish source PTS/frame ordinal. Identical pixels can occur at different presentation times.

Each physical recording has one actual attempt lineage. Renames, re-encodings, overlays or repeated sampled images do not add trials. Asset ownership must agree with the participant/session/trial/attempt chain; contradictory ownership is a validation blocker, not fixed by inventing a new ID. Retain observed partial evidence and lineage while policy permits. Any withdrawal/deletion must cover permitted derivatives and replicas; do not retain disallowed evidence merely to satisfy reproducibility.

## 6. Independent speed-reference record

| Field / type | Proposal |
| --- | --- |
| `reference_id`, `attempt_id`, `source_file_id`, `course_setup_id` | Unique record and explicit source/attempt/course ownership |
| `reference_method`, `reference_policy_version`, `crossing_rule_version` | Reviewed measured-zone timing route and fixed landmark/boundary rule; not cadence/extrema/model-derived |
| `measured_distance_m` | Positive independently measured distance plus measurement instrument/method/verification and uncertainty; no hard-coded final 4 m |
| `observer_a_start`, `observer_a_end` | Structured independent observation or null, with observer code/status/reason, boundary ID, source-frame ID/ordinal if known, raw PTS ticks/timebase and normalized seconds/bracket if qualified |
| `observer_b_start`, `observer_b_end` | Same structure, separate observer/submission; initially blinded to A and model predictions |
| `timing_source` | Reference-clock method, qualification status/decision reference, timebase/origin/conversion and uncertainty. Requested pose clock stored elsewhere |
| `observer_disagreement` | Signed/absolute start/end/duration differences and annotatability agreement on common qualified clock; null where not computable |
| `adjudication_status` | `pending`, `not_required`, `resolved`, `unresolved`; not_required only under an approved agreement rule; third independent submission/rationale links if applicable |
| `adjudicated_start`, `adjudicated_end` | Final boundary records under the frozen approved combination/adjudication rule; null until reference accepted, including when disagreement remains unresolved |
| `reference_uncertainty` | Distance/boundary/duration/speed uncertainty, units, representation/method and approved policy reference; never fabricated zero |
| `reference_rejection_reason` | Required when rejected; separate unavailable/pending reasons; no rejection because model error is large |
| `final_speed_mps`, `crossing_duration_seconds` | Accepted-only finite values, with `end > start` and `distance/duration` consistency; null for pending/unavailable/rejected reference |
| `annotation_version`, `reference_revision`, submission/artifact digests | Immutable submissions and corrections; preserve prior version/history subject to approved retention |

Raw observer submissions may have values despite rejected/unavailable reference status, because they preserve actual observations. **Only final accepted label fields** may populate the supervised target. Accepted agreement is not chosen by closeness to predictions. Confidence/tolerance/adjudication/uncertainty rules and numeric serialization tolerances remain reviewer/pilot decisions; the knee/motion thresholds are not speed thresholds.

Raw PTS may use its source clock origin and signed tick representation; any normalized reference seconds require a qualified conversion/origin record. Do not impose a invented frame clock or fill absent PTS from ordinal/FPS. Without qualified PTS, reference timing is unavailable unless another independently approved timing route has explicit evidence. Nominal timing may remain diagnostic in its own namespace.

Predictions, pose-derived speed, cadence and candidate intervals belong in model/analysis records and **never** in this reference object.

## 7. ML partitions, artifact lineage and reproduction

| Proposed field/group | Meaning |
| --- | --- |
| `dataset_version`, `annotation_version` | Frozen eligible acquisition/reference snapshot and locked annotation specification |
| `feature_version`, `preprocessing_version` | Feature definitions/units/order plus training-fitted transformations and their artifact hashes |
| `split_version`, `partition` | Participant-owned `train`, `validation` or `test` assignment; null means intake/unassigned, never scientifically evaluable under a frozen split |
| `split_frozen`, split-manifest digest/decision reference | Outer held-out membership frozen/versioned before tuning; never edited in place after inspection |
| `model_run_id`, `model_run_version` | Immutable experiment key/config, family/hyperparameters/seeds, environment/code/model/input hashes, train/tune memberships and output artifacts; null before a run exists |
| `feature_generation_status` | `not_requested`, `pending`, `succeeded`, `partial`, `failed`, `excluded`; masks/missingness and availability retained |
| `prediction_status` | `not_requested`, `pending`, `available`, `unavailable`, `failed`; predicted speed null unless an actual valid output exists; reason retained |
| `quality_flags`, `availability_flags`, `exclusion_reason` | Stage-specific findings, thresholds/policy versions, counts and denominators; no single quality flag substituting for consent/reference validity |
| Derived windows/frames | Artifact IDs/hashes and source attempt/samples, requested/decoded-clock semantics, geometry/missingness masks; inherited grouping and partition |

A model-run collection can contain many runs/predictions per attempt; do not overwrite reference or predictions with only a chosen best run. CV fold roles are separate versioned training/tuning assignments **inside the declared development pool**, not changes to the frozen outer participant partition or permission to use final test people. Preprocessing fit membership, early stopping, threshold selection and model selection must be auditable from training/validation-only run provenance.

Unknown identity, unqualified label, unsupported input or invalid governance blocks eligibility. A missing partition during approved intake need not erase the acquisition record; it blocks modeling/evaluation until assigned under reviewed rules. Pilot participants used for policy/model design cannot become final held-out test people. Whether pilot data may enter development training remains a recorded decision.

## 8. Governance pointers and deletion accounting

| Proposed field | Meaning / gate |
| --- | --- |
| `consent_record_reference`, `consent_version` | Restricted registry pointer, no signed contents/contact data; actual permitted purpose/access must be verified |
| `governance_eligibility`, review/decision reference | `pending`, `eligible`, `ineligible`, `withdrawn`; actual permitted-use review, not a field inferred from an app notice. Pending/ineligible/withdrawn blocks research use; eligible is not a scientific PASS |
| `institutional_approval_reference`, protocol/scope decision pointers | Actual documented institutional determination (approval/exemption as applicable), supervisor scope and authorized protocol version; pointer alone is not proof |
| `withdrawal_status` | `not_requested`, `requested`, `resolved`, `unknown`; requested/unknown must block use pending authorized resolution rather than assume eligibility |
| `retention_state`, expiry/policy pointers | `pending_policy`, `authorized_active`, `due`, `completed`, `unknown`; approved dates by asset class, no invented duration |
| `deletion_state` | Asset-linked status/receipts including derivatives and backups; failure is visible, not a false completed state |
| `access_classification`, permitted-purpose reference | Proposed `restricted_research` or `restricted_linkage` sidecar classification; no automatic public sharing |

Linkage/consent contents remain in the restricted registry, not in ML exports. Withdrawal logs may need irreversible de-identification or permitted aggregate receipts; exact permissible retention is an institutional decision. Data deleted under consent cannot remain retrievable through an old "immutable" export. Versioning must respect deletion/withdrawal rather than promise permanent evidence retention. Public use/release or external dataset secondary use requires verified permissions; no public dataset is selected here.

## 9. Proposed validator requirements — not implemented

1. Reject duplicate keys/IDs, nonfinite numbers, invalid types/versions, bad references and contradictory statuses. Preserve missing facts as null/reason, not zero/default success. Freeze exact schema bounds and arithmetic tolerances in later review.
2. Enforce one participant per study session, one session per trial, one trial per attempt, one actual attempt per physical recording lineage. Research identity must be known/authentically mapped for scientific use; quarantine unresolved ownership.
3. Enforce one outer scientific partition per person; every session/trial/attempt/window/frame/augmentation inherits it. **Random frame-level train/test splitting is prohibited** for primary unseen-participant evaluation.
4. Resolve aliases, exact duplicates and reviewed re-encoded/derived lineage before allocation. No shared source lineage across partitions. Contradictory cross-participant content ownership blocks use; different digests do not waive the check.
5. Require same-trial, acyclic replacements and decision pointers; preserve original outcomes and all-attempt coverage. Unattempted trials have zero attempts and a closure reason; do not create fake failed videos.
6. Require accepted references to satisfy authentic governance review, measured distance, qualified independent timing, fixed crossing rule, locked observer submissions, reviewed adjudication and final formula/uncertainty checks. Unavailable/rejected/pending final label fields must be null.
7. Validate source/time/image mappings without treating assertions/hashes as anatomical or physical-time truth. A requested timestamp cannot occupy a decoded-PTS/reference-clock field. PTS/tool qualification requires evidence beyond shape checks.
8. Validate separate reference versus model-output namespaces; training transforms, early stopping and selection may not see final test evidence. Verify versioned run/feature/split lineage and documented fold fit sets.
9. Retain completed failed/partial attempts, reference/prediction availability and exclusions for full-ledger reporting. Provide strict modeling-eligible views without dropping failures from the study record.
10. Check frozen-membership/annotation changes against append-only revisions, approved decision references and permitted deletion rules. Validation success never confers ethics approval, consent authenticity, scientific PASS or Android acceptance.

## 10. Existing application metadata versus proposed research metadata

| Information | Ordinary application today | Proposed research handling |
| --- | --- | --- |
| App/native session UUID and History | Saved successful extraction summary/frames | Optional genuine `app_session_uuid` mapping; separate participant/session/trial/attempt IDs |
| Pose/confidence and sampled times | 33 indexed normalized landmarks, visibility/presence, requested sample timestamps | Versioned feature inputs/masks/time semantics; no reference timing inferred |
| Side/direction/upright | Side setup; setup-aware metadata-v2 direction/upright assertions; older records absent/unassessed | Preserve anatomical side separately from direction, assertion provenance/unknowns/conflicts |
| Native geometry/transforms | Structured inference dimensions/constancy and known app transforms where available | Preserve native evidence; actual source geometry/PTS/image links require the chosen research route |
| Analysis provenance | Algorithm/configuration/model/extractor evidence and component reasons | Link analysis artifacts; keep `NOT_EVALUATED` and unsupported measurements explicit |
| Research grouping/failures | No durable research participant/visit/trial/attempt/failure ledger in ordinary saved sessions | New private acquisition ledger, including trials without successful app sessions |
| Consent | Local processing notice/version | Separate institutional/consent/withdrawal registry references and authentic use review |
| Independent speed/observer submissions | Not supplied | Blinded source-based measured-zone reference SOP; final accepted labels separately stored |
| Qualified reference timebase | Not supplied by stored requested times | Future qualified source timing or independently approved route; otherwise unavailable |
| Scientific partition/retention governance | Not supplied by ordinary History | Versioned person splits; evidence/backup retention/deletion/accountability |

Evidence: [session contract](../../frontend/src/offline/contract.ts), [native inference/storage](../../frontend/modules/gaitsense-pose/android/src/main/java/expo/modules/gaitsensepose/GaitSensePoseModule.kt), [metadata](../../frontend/src/offline/ANALYSIS_METADATA.md), [recording setup](../../frontend/src/offline/RECORDING_ANALYSIS_SETUP.md), [continuity](../../frontend/src/offline/SAVED_CONTINUITY.md). Optional caller participant/attempt IDs in analytical adapters are not durable research registry linkage. Native structured geometry improves engineering provenance; it supplies neither authentic images nor decoded PTS.

## 11. Conflict register and migration decisions

| Existing state | V2/newer proposal | Owner | Resolution gate |
| --- | --- | --- | --- |
| [Study](STUDY_PROTOCOL.md) 15–30 people/3–5 trials; knee/motion feasibility counts separate | Speed pilot 8–12, thesis aim 40–60, expansion 80–120+ with reviewed repeats | Supervisor/research/reference leads | Pilot planning; main target after pilot, before main capture |
| Landscape/1080p versus portrait/720p variants | Capture/protocol strata and actual properties explicitly versioned | Supervisor/engineering lead | Before pilot |
| Ordinary source deletion; minimized still-image knee workflow | Authorized speed-crossing source evidence and required replay scope, with independent retention/deletion policy | Institution/data steward + reference/engineering leads | Before research acquisition |
| v1 exact root/record/ground-truth keys; successful accepted clips only | Linked participant/session/trial/attempt/reference/assets/run entities, failures/partial evidence included | Schema owner/data steward/ML lead | Separate design approval, validator and migration qualification before intake |
| v1 fixed draft protocol, numeric duration/FPS/coverage/manual-step gates | Task/version-specific rules; reference and model availability separated | Supervisor/reference/schema leads | Review pilot readiness; freeze before main evaluation |
| PoC nominal FPS and app requested clocks | Qualified independent reference clock, separate from pose sampling | Reference reviewer/engineering lead | Synthetic qualification before pilot |
| Old geometry/diagnostic source snapshots | Preserve newer native geometry/operator assertions with remaining PTS/image limitations | Engineering/schema reviewer | Mapping review before tooling; no legacy rewrite |
| App-centric work or audit wording implying app deferral | Two equally required app/ML tracks with joint deployment/parity gates | User/team/supervisor | Effective current strategy; milestone/resources agreed at review |

The current checker fixes `GS-SIDE-1.0-draft`, allows only train/validation/test, checks exact fields, rejects duplicate hashes, and requires accepted measured-distance references plus its draft numerical gates. It does not support V2 structures or prove source/consent authenticity. A future migration must preserve original v1 evidence, define explicit mapping/new version, flag absent facts as unresolved and qualify a separate checker with synthetic fixtures. A v1 pass cannot be rebranded a V2 pass; old records cannot acquire missing consent, research identities or reference timing by renaming fields.

The [exact-image workflow](EXACT_FRAME_EVIDENCE_WORKFLOW.md), [knee protocol](KNEE_FLEXION_VALIDATION_PROTOCOL.md) and [motion-reference protocol](CANDIDATE_MOTION_REFERENCE_VERIFICATION.md) are separate endpoint drafts. Their synthetic-only tools must remain synthetic. V2 must not turn simulation fields into real approvals or use sampled motion extrema as speed references.

## 12. Decision gates and bounded next task

Still unresolved: primary task approval; exact model count/counting definition; downstream/backbone/both scope; temporal-model necessity; pilot/main participant counts, sessions/trials; course distance/crossing rule; timing technology; observer disagreement/readiness/adjudication rules; institutional route/consent language; retention/withdrawal/deletion/access policy; public data; device-diversity target; defense schedule; named research approval and implementation owners. No schema default answers these questions.

Recommended next no-phone work: **synthetic-only schema and reference-qualification design review package** with field/status invariants and hand-specified examples for unattempted, capture-failed, processing-failed-but-reference-available, unresolved timing, duplicate/re-encoded lineage, replacements, withdrawal and split conflicts. Use artificial IDs/numbers/bytes only; no actual participant registry, media, hashes or labels. Future implementation must be separately scoped; do not modify `research/study/check.py`, production Android or existing synthetic knee/motion contracts as a side effect.

The application track separately retains newest-APK physical acceptance, multi-device/offline/persistence/failure/UX regressions, final trained-model integration/parity and device performance/release readiness. Research governance/pilot/main collection and ML evaluation remain pending. This proposal prepares review and does not activate either track's acceptance or scientific status.

## 13. Sprint 6 Task 2 verification record

Only the supervisor brief, walking-speed reference SOP draft and this V2 proposal were created. All 38 internal repository links resolve, including the brief's linked conflict section. `git diff --check` and separate new-file `--no-index --check` checks show no whitespace errors; the latter returns 1 for a new-file difference, not a failed whitespace check.

All 271 pre-existing tracked/untracked/protected file SHA-256 values match their pre-write snapshot, including the Sprint 6 Task 1 audit, existing protocols/approval register/checker, local research reconciliation, `ShortIntervalComponentTest.kt`, `output/task8-apk/verify-current-bundle.cjs` and the release APK. All 122 research-file size/last-write metadata records are unchanged. No production/Android source changed; no training, model artifacts, data collection or APK build occurred. The index remains unstaged, `main`/HEAD unchanged, and no commit/push occurred. These are documentation/preservation checks, not study or physical-device acceptance.
