# Dataset contract v1 (preparation)

Dataset manifests are UTF-8 JSON: `dataset_version`, `protocol_version`,
`records`. Each record is a pseudonymous clip. Store real manifests and approval
copies under ignored `research/private/` or outside the repository; access control
and encryption must also be configured. Gitignore is not encryption and cannot
remove already tracked files. Do not publish raw video, consent forms or contacts.

## Required record fields

| Field | Meaning / accepted values |
| --- | --- |
| participant_id | P followed by three digits; linkage stays in private consent registry |
| clip_id | P001_T01 pattern, matching participant, unique |
| protocol_version | GS-SIDE-1.0-draft (change version after approval if revised) |
| consent_id | C followed by three digits; private registry reference |
| consent_status | accepted; withdrawn records are not eligible |
| view | side_left or side_right; front view needs a separate future contract |
| pace | comfortable; variations need reviewed protocol amendment |
| split | train, validation or test; participant belongs to exactly one |
| file_sha256 | 64-character hex digest; duplicates rejected |
| duration_seconds / fps | Recorded finite values, protocol range 10-15 s, FPS 29-61 |
| usable_frame_ratio | Measured ratio 0-1; accepted records need >=0.70 |
| step_count_manual | Independent integer count >=6 for this accepted-clip manifest |
| walking_interval_seconds | Positive finite duration <= clip duration |
| ground_truth | Independent reference object below |

`ground_truth`: `method` must be `marked_distance_timing`; `distance_m`,
`start_seconds`, `end_seconds`, `speed_mps`; `markers_visible: true`;
`distance_verified: true`; two distinct `reviewer_ids` (R01-style).
The checker verifies speed arithmetic and timestamp boundaries, not real evidence.
Keep original reviewer annotation sheets and setup measurement log privately.
This schema intentionally covers the accepted, paired-speed side-view dataset;
rejected clips remain in a separate private exclusion log with reasons. They must
be included in study coverage reports, not silently deleted from the denominator.

Collection can begin before train/test allocation; raw intake is NOT a training
manifest. Freeze participant allocation before modeling. This checker expects the
curated, split-assigned manifest. No minimum cohort size is enforced for a pilot;
passing two records is not approval for training/generalization claims.

## Provenance and legacy policy

- Existing P_01-style data stays unchanged; any mapping to P001 must have a private
  mapping log. Do not infer consent from possession of a video.
- Visual-boundary-estimated targets are excluded from the independent-speed
  dataset. Existing saved ML artifacts remain feasibility artifacts only.
- Retain dataset, annotation, feature-definition and split versions plus hashes.
  Freeze evaluation set. Changes require a new version and documented reason.
- Public data needs licence/population/modality/label audit before use; do not
  mix force-sensor or mocap features with smartphone features without a separate
  justified study design. No external datasets downloaded by this task.

## Retention and access plan awaiting institutional approval

Data steward maintains consent ledger, access list, withdrawal/deletion log and
backup inventory. Proposal: temporary raw video until annotation/extraction QC,
maximum 30 days unless separately approved explicit retention consent; delete
failed recordings under the same ceiling. Numerical research records up to
12 months after project submission, consent ledger and backups per institutional
policy. These are proposed values, not activated policy or legal advice.
Finalize exact dates/backup expiry before recruitment. Default app behavior remains
delete video after successful extraction (not the study's annotation window).

## Release gate

Record A-01 supervisor/architecture acceptance, A-02 institutional ethics decision
(approval or documented exemption), A-03 protocol/endpoints/threshold review,
A-04 consent/privacy/retention review, A-05 named owner assignment. Use the checker
for metadata gates; a human checks authentic approval documents and consent.
