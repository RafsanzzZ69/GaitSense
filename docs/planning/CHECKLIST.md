# Requirement status checklist

Baseline: 23 September 2026. No row is claimed as verified by paperwork alone.
Owner codes are roles; named assignments await A-05. Full acceptance procedures,
dependencies and evidence paths are in [requirements.json](requirements.json).

| ID | Requirement | Priority | Implementation status | Owner role |
| --- | --- | --- | --- | --- |
| FR-01 | Local profiles | core | partial | Mobile engineer |
| FR-02 | Video recording | core | partial | Mobile engineer |
| FR-03 | Quality rejection | core | partial | Vision/features engineer |
| FR-04 | 33-landmark pose extraction | core | partial | Vision/features engineer |
| FR-05 | Validated gait features | core | partial | Vision/features engineer |
| FR-06 | Trained model inference | core | partial | ML engineer |
| FR-07 | Human-readable report | core | partial | Mobile engineer |
| FR-08 | Non-diagnostic recommendations | core | not_started | Research/team lead |
| FR-09 | Local session history | core | partial | Mobile engineer |
| FR-10 | Progress comparison | optional | partial | Mobile engineer |
| FR-11 | Delete any/all data | core | partial | Mobile engineer |
| FR-12 | Offline PDF export | optional | partial | Mobile engineer |
| FR-13 | On-device inference | core | partial | Mobile engineer |
| FR-14 | Capture guidance | core | partial | Mobile engineer |
| FR-15 | Cloud sync/accounts | excluded | excluded | Platform engineer |
| FR-16 | Social sharing | excluded | excluded | Mobile engineer |
| NFR-01 | Performance | core | not_started | QA/evaluation lead |
| NFR-02 | Feature accuracy | core | partial | Vision/features engineer |
| NFR-03 | Responsive processing UI | core | partial | Mobile engineer |
| NFR-04 | Private video by default | core | partial | Platform engineer |
| NFR-05 | Security | core | partial | Platform engineer |
| NFR-06 | First-use usability | core | not_started | QA/evaluation lead |
| NFR-07 | Failure reliability | core | partial | Vision/features engineer |
| NFR-08 | Modularity | core | partial | Platform engineer |
| NFR-09 | Single-user scope | core | partial | Research/team lead |
| NFR-10 | Android compatibility | core | partial | Mobile engineer |
| NFR-11 | Large-text accessibility | core | not_started | QA/evaluation lead |
| NFR-12 | Zero-internet operation | core | partial | Mobile engineer |
| DATA-01 | Approved collection and consent | core | not_started | Research/team lead |
| DATA-02 | Paired dataset and provenance | core | partial | Data steward |
| DATA-03 | Leakage-free evaluation split | core | partial | ML engineer |
| DATA-04 | Privacy lifecycle and withdrawal | core | partial | Data steward |
| ML-01 | Baseline comparison and evaluation | core | partial | ML engineer |
| ML-02 | Explainable consistency sub-scores | core | not_started | ML engineer |
| ML-03 | Exported model and lineage | core | not_started | ML engineer |
| FEAT-01 | Core and recommended feature set | core | partial | Vision/features engineer |
| EXT-01 | Advanced measurements | stretch | not_started | Vision/features engineer |
| EXT-02 | Advanced experience | stretch | partial | Mobile engineer |
| EXT-03 | Anomaly/temporal models | stretch | not_started | ML engineer |
| RES-01 | Robustness study | core | not_started | QA/evaluation lead |
| RES-02 | Reproducible final delivery | core | partial | Research/team lead |
| SAFE-01 | Excluded claims and hardware | core | partial | Research/team lead |

Checklist coverage is not implementation completion. Server-only implementations
remain partial for offline requirements. No clinical claims are enabled by this checklist.

The Android capture/pose/SQLite prototype now supplies additional implementation
evidence. FR-13 remains partial: pose inference is not the trained gait model or
final report. See [native verification](../OFFLINE_ANDROID.md); physical two-device
acceptance and research validity must not be inferred from a build or emulator.
