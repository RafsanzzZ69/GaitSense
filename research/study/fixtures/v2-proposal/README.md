# Synthetic V2 proposal fixtures

**SYNTHETIC ONLY — NOT APPROVED STUDY RECORDS — NOT_EVALUATED.**

All IDs, measurements, timestamps, observer/permission pointers and predictions
are fake. No real videos, people, source hashes or models were used. File hashes
are SHA-256 of public artificial identifier strings, not video bytes.

Read the [invariant specification](../../../../docs/planning/RESEARCH_MANIFEST_V2_INVARIANTS.md)
and [timing/annotation specification](../../../../docs/planning/REFERENCE_TIMING_AND_ANNOTATION_QUALIFICATION.md).
The [isolated validator](../../check_v2_proposal.py) reads only this directory.
It neither imports nor changes the [V1 checker](../../check.py).

Each JSON envelope has a hand-declared oracle: exact first error or ledger PASS,
plus simulated reference/pair-eligible attempt IDs. The validator does not use
the oracle to decide validity. PASS can preserve failed, rejected, pending or
withdrawn records without label eligibility. Scientific use remains prohibited.

Run from repository root:

```powershell
python -B research/study/check_v2_proposal.py
python -B -m unittest discover -s research/study/tests -p test_v2_proposal.py
```

Fixture-only policy uses 0.05 s to exercise branch/equality behavior, mean observer
boundaries or third independent boundaries. It is not a recommended or approved
threshold/adjudication rule. Real policy stays pending. Synthetic 6 m is an
arithmetic test input, not a selected course distance. This package exercises
metadata conversion, not an actual decoder or calibrated timing system.

Unknown/invalid records are valid quarantined ledger entries without a use request
or expected FAIL when offered for inclusion. Invalid manifests fail closed with
empty eligible outputs. Accepted reference with processing failure stays in
simulated reference yield and outside paired yield.

| Fixture | Expected ledger result | Reference / pair attempts | Case |
| --- | --- | --- | --- |
| [01-accepted-reference.json](01-accepted-reference.json) | PASS | SYN-A-1 / SYN-A-1 | Exact observer agreement; synthetic distance/time formula. |
| [02-missing-participant.json](02-missing-participant.json) | IDENTITY | none / none | Missing identity blocks simulated inclusion. |
| [03-participant-train-test.json](03-participant-train-test.json) | PARTICIPANT_PARTITION | none / none | One participant assigned to train and test. |
| [04-exact-duplicate-partitions.json](04-exact-duplicate-partitions.json) | HASH_PARTITION | none / none | Equal media hashes across partitions. |
| [05-replacement-retains-failure.json](05-replacement-retains-failure.json) | PASS | SYN-A-2 / SYN-A-2 | Replacement succeeds; original failure retained. |
| [06-rejected-no-target.json](06-rejected-no-target.json) | PASS | none / none | Rejected reference retains raw observers and null target. |
| [07-unqualified-timing.json](07-unqualified-timing.json) | TIMING_UNQUALIFIED | none / none | Unqualified decoded timing offered as accepted reference. |
| [08-disagreement-awaiting.json](08-disagreement-awaiting.json) | PASS | none / none | Large disagreement retained with no final target. |
| [09-adjudication-resolved.json](09-adjudication-resolved.json) | PASS | SYN-A-1 / SYN-A-1 | Third independent blinded submission resolves disagreement. |
| [10-negative-duration.json](10-negative-duration.json) | DURATION | none / none | Observer end before start. |
| [11-missing-distance.json](11-missing-distance.json) | DISTANCE_REQUIRED | none / none | Accepted reference omits measured distance. |
| [12-android-request-not-reference.json](12-android-request-not-reference.json) | TIMING_UNQUALIFIED | none / none | Android requested samples cannot be physical reference timing. |
| [13-reencoded-lineage.json](13-reencoded-lineage.json) | PASS | SYN-A-1 / SYN-A-1 | Known re-encode inherits same attempt/content/partition. |
| [14-multi-session-grouped.json](14-multi-session-grouped.json) | PASS | SYN-A-1, SYN-A-2 / SYN-A-1, SYN-A-2 | Repeated sessions/trials stay in one person partition. |
| [15-prediction-without-reference.json](15-prediction-without-reference.json) | PASS | none / none | Prediction cannot manufacture a pending reference target. |
| [16-unknown-participant.json](16-unknown-participant.json) | IDENTITY | none / none | Valid-looking code cannot replace known ownership. |
| [17-missing-original-attempt.json](17-missing-original-attempt.json) | REPLACEMENT | none / none | Replacement original absent from ledger. |
| [18-test-person-in-train-window.json](18-test-person-in-train-window.json) | DERIVED_PARTITION | none / none | Held-out participant's derived window wrongly assigned train. |
| [19-small-disagreement.json](19-small-disagreement.json) | PASS | SYN-A-1 / SYN-A-1 | Within synthetic threshold; mean boundaries. |
| [20-observer-a-only.json](20-observer-a-only.json) | PASS | none / none | Missing B remains pending with no target. |
| [21-observer-b-only.json](21-observer-b-only.json) | PASS | none / none | Missing A remains pending with no target. |
| [22-zero-duration.json](22-zero-duration.json) | DURATION | none / none | Zero observer crossing duration. |
| [23-incompatible-clocks.json](23-incompatible-clocks.json) | TIMING_INCOMPATIBLE | none / none | Matching timing class cannot disguise incompatible clocks. |
| [24-nominal-fps-not-reference.json](24-nominal-fps-not-reference.json) | TIMING_UNQUALIFIED | none / none | Nominal FPS is not qualified physical timing. |
| [25-adjudication-missing.json](25-adjudication-missing.json) | ADJUDICATION_REQUIRED | none / none | Large disagreement accepted without required adjudication. |
| [26-rejected-fabricated-target.json](26-rejected-fabricated-target.json) | FINAL_LABEL_FORBIDDEN | none / none | Rejected reference improperly carries a final speed. |
| [27-reference-distance-feature.json](27-reference-distance-feature.json) | TARGET_LEAKAGE | none / none | Measured distance cannot be a prediction input. |
| [28-test-person-preprocessing-fit.json](28-test-person-preprocessing-fit.json) | RUN_PARTITION | none / none | Held-out person included in fit/preprocessing membership. |
| [29-reference-valid-processing-failed.json](29-reference-valid-processing-failed.json) | PASS | SYN-A-1 / none | Reference yield retained despite unavailable prediction. |
| [30-withdrawn-ledger.json](30-withdrawn-ledger.json) | PASS | none / none | Fake withdrawn accounting retains no inclusion. |
| [31-withdrawal-blocks-use.json](31-withdrawal-blocks-use.json) | GOVERNANCE | none / none | Requested withdrawal blocks otherwise accepted reference use. |
| [32-source-unavailable-ledger.json](32-source-unavailable-ledger.json) | PASS | none / none | Missing source retained with no target. |
| [33-source-missing-accepted.json](33-source-missing-accepted.json) | REFERENCE_SOURCE | none / none | Accepted reference cannot lack source evidence. |
| [34-external-synchronized.json](34-external-synchronized.json) | PASS | SYN-A-1 / SYN-A-1 | Simulated external qualified timing route. |
| [35-pts-conversion-mismatch.json](35-pts-conversion-mismatch.json) | PTS_MAPPING | none / none | Tick-to-seconds conversion inconsistent. |
| [36-signed-origin-pts.json](36-signed-origin-pts.json) | PASS | SYN-A-1 / SYN-A-1 | Signed origin conversion uses rational clock, not nominal FPS. |
| [37-policy-pending-no-label.json](37-policy-pending-no-label.json) | PASS | none / none | Unresolved policy can wait in ledger without labels. |
| [38-policy-pending-accepted.json](38-policy-pending-accepted.json) | POLICY_PENDING | none / none | Exact agreement cannot bypass unresolved policy. |
| [39-unattempted-trial.json](39-unattempted-trial.json) | PASS | SYN-A-1 / SYN-A-1 | Unattempted scheduled trial has no invented capture. |
| [40-accepted-later-invalidated.json](40-accepted-later-invalidated.json) | PASS | none / none | Current invalidated revision has no final label; history engine future. |
| [41-reencoded-content-partitions.json](41-reencoded-content-partitions.json) | LINEAGE_PARTITION | none / none | Different hashes cannot evade known common-origin leakage. |
| [42-self-replacement.json](42-self-replacement.json) | REPLACEMENT | none / none | Self-replacement cannot erase original attempt. |
| [43-inconsistent-final-speed.json](43-inconsistent-final-speed.json) | SPEED_FORMULA | none / none | Accepted speed inconsistent with independent distance/duration. |
| [44-observer-unblinded.json](44-observer-unblinded.json) | OBSERVER_INDEPENDENCE | none / none | Observer saw predictions; independent label gate fails. |
| [45-frozen-test-membership-changed.json](45-frozen-test-membership-changed.json) | SPLIT_FROZEN | none / none | Frozen test membership cannot change silently. |
| [46-partition-unassigned-intake.json](46-partition-unassigned-intake.json) | PASS | none / none | Unassigned intake stays ledger-only, never final evaluation. |
| [47-prediction-in-reference.json](47-prediction-in-reference.json) | SHAPE | none / none | Prediction may not occupy ground-truth namespace. |
| [48-zero-distance.json](48-zero-distance.json) | DISTANCE | none / none | Zero measured distance cannot be accepted. |
| [49-alias-overlay-same-attempt.json](49-alias-overlay-same-attempt.json) | PASS | SYN-A-1 / SYN-A-1 | Alias and overlay are children of one physical attempt. |
| [50-threshold-equality.json](50-threshold-equality.json) | PASS | SYN-A-1 / SYN-A-1 | Inclusive synthetic threshold equality branch. |
| [51-different-clocks-pending.json](51-different-clocks-pending.json) | PASS | none / none | Incompatible clocks await review with no final label. |

Declared suite: **51 JSON cases; 23 ledger PASS; 28 expected FAIL**.

Expected FAIL cases test rejection, not scientific failure. Full partial-submission,
revision/deletion dependency handling, indirect feature leakage, per-frame decoder
qualification, observer readiness and authentic governance remain future scoped
work. Re-encodes without declared lineage are not detectable by hash-only checks.
No real collection or production V2 implementation is authorized.
