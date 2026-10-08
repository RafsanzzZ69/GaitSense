# Public gait dataset eligibility decision brief

9 October 2026 · Sprint 6 · **NOT_EVALUATED** · Supervisor discussion, not approval.
Model: GPT-6.1 Sol; reasoning: High. Phone: no; engineering video: no; research
dataset acquisition: no. Baseline: `9d626967ff8b995e0a0c61f8d71eada7ffa24794`.

## 1. Executive conclusion

| Candidate | Decision for proposed unseen-participant trial-average RGB walking-speed regression |
| --- | --- |
| Health & Gait (H) | **NOT SUITABLE FOR PRIMARY SPEED STUDY** using its published release: raw recordings are absent and sensor measurements preceded videos. Exact-passage targets cannot be manufactured from person/pace values. Any separate aggregate-feature study is on hold pending rights and supervisor decisions. |
| Insole–GAITRite (I) | **GO ONLY AFTER PROVIDER CLARIFICATION**: promising clip organization, but speed field/units, measurement window and camera compatibility remain unresolved. This means pursue clarification, not acquire or adopt data. RGB unseen-participant speed eligibility: **UNKNOWN — documentation insufficient**. |

H's Usage Notes and Limitations establish the two disqualifiers, correcting the
earlier audit's uncertainty. [H paper](https://pmc.ncbi.nlm.nih.gov/articles/PMC11724122/).
I's record establishes the hierarchy but not the speed export dictionary.
[I release](https://zenodo.org/records/19662017).
See the corrected [suitability audit](PUBLIC_GAIT_DATASET_SUITABILITY_AUDIT.md).

Retain own-cohort planning. No public release currently replaces it. Both equally
required tracks continue: reliable offline application and defensible ML research.
No clinical diagnosis, disease/fall-risk/treatment claim follows.

## 2. Health & Gait decision table

| Gate area | Established evidence / remaining barrier |
| --- | --- |
| Participant separation | PAXXX links person folders and CSV `ID`; repeated conditions group by person. Author split code partitions IDs, not frames. Inventory verification remains future work. |
| Raw RGB access | Not supplied in published release. Public derivative archives are not an RGB access route. Separate restricted access, eligibility and request process NR. |
| Trial correspondence | Person join exists; synchronized same-passage sensor→video link does not. Provider confirmation of an additional paired release would be new evidence. |
| Independent speed label | Independent MuscleLAB source exists; current person/pace targets are not exact-video trial labels. |
| Units/granularity | Paper speed table: m/s, UGS/FGS. Table says `Speed_*`; text/code also use `Velocity_*`. Actual measured CSV header and aggregation dictionary not inspected. |
| Licence | **LICENCE AUTHORITY UNRESOLVED**: Zenodo CC BY 4.0 versus author DUA; no precedence assumed. |
| Governance | DUA limits academic/research use, commercial use and sharing; forbids participant identification/contact; requires security. Derivative/model retention rights unresolved. |
| Domain compatibility | Controlled side view, COCO-17 derivatives; MediaPipe re-extraction cannot be assumed. |
| Suggested role | Potentially suitable for separately approved person/pace feature development; not current exact-clip RGB speed validation. |
| Blocking questions | Governing terms, aggregate-label semantics and existence/access of any separate paired RGB/reference release. |

Sources: [H paper](https://pmc.ncbi.nlm.nih.gov/articles/PMC11724122/),
[Zenodo metadata](https://zenodo.org/api/records/14039922),
[pinned partition code](https://github.com/AVAuco/healthgait/blob/2a6a29056c5f8a5ed4eac27c5e4c9ba3e65ac6d0/code/create_partitions/create_partitions.py),
[pinned DUA](https://github.com/AVAuco/healthgait/blob/2a6a29056c5f8a5ed4eac27c5e4c9ba3e65ac6d0/DUA.txt).

### Relevant variables: source classification, not interchangeable labels

A = independent sensor observation; B = directly measured protocol quantity;
C = derived from independent measurements; D = video/pose-derived estimate;
E = learned-model estimate; F = nominal/instruction category; G = unclear.
Classify by **file and provenance**, never column name alone.

| H field/quantity | Class; unit; granularity / eligibility |
| --- | --- |
| Measured `Speed_UGS/FGS` (possible `Velocity_*` header) | C: independently timed zone speed; m/s; person×pace release description, exact aggregation G. Not exact-clip ground truth. |
| Measured `Step_*`, `Stride_*`; `Cadence_*`; `MonoSP_*`, `BiSP_*` | C: OptoGait-derived metrics; cm; steps/min; seconds respectively; UGS/FGS, not qualified clip targets. |
| Sensor-zone distance / photocell crossing duration | B distance, A timing; physical route documented, but per-trial exported fields and correspondence G. No reconstruction from video allowed. |
| Estimated CSV `Velocity_UGS/FGS`, `Step_*`, `Stride_*`, `Cadence_*` | D; m/s, cm, steps/min by documented definitions; code averages across clips within person/pace. Never independent labels. |
| UGS/FGS; supplied pose | F instruction; E pretrained inference, respectively. Neither is measured speed. |

The [pinned estimation code](https://github.com/AVAuco/healthgait/blob/2a6a29056c5f8a5ed4eac27c5e4c9ba3e65ac6d0/code/gait_estimation/gait_parameters_estimation.py)
computes velocity from segmentation crossing-frame differences and supplied FPS,
then averages clips. Its `Velocity_*` names do not authenticate measured CSV values.
The README's estimated-table listing includes support-time descriptions; the
inspected estimator writes only step/stride/cadence/velocity. Request a dictionary,
not assumed equivalence. [Author README](https://github.com/AVAuco/healthgait/blob/2a6a29056c5f8a5ed4eac27c5e4c9ba3e65ac6d0/README.md).

## 3. Insole–GAITRite decision table

| Gate area | Established evidence / remaining barrier |
| --- | --- |
| Participant separation | Stable pseudonymous P IDs; participant/condition/clip hierarchy. Intentional gaps reflect quality exclusions, not an ID error. Grouped splitting structurally possible; retained inventory unknown. |
| Raw RGB access | Anonymized MP4 distributed according to record; unmodified raw RGB NR. Archive listing is public; media contents not inspected. |
| Trial correspondence | Clip folder contains video, `gaitrite_test.csv`, L/R insole CSV and `sync_auto.json`; condition-level summary distinct. Exact reference row keys/window and synchronization uncertainty unresolved. |
| Independent speed label | GAITRite is independent of video; presence of exports does not prove a distributed trial-speed value. Field/derivation unknown. |
| Units/granularity | Clip exports documented; speed/velocity, elapsed time, distance and stride-field names/units not established. |
| Licence | Official record/API declares CC BY 4.0; no conflicting DUA found in inspected public docs. Tool MIT licence is separate. |
| Governance | Secondary-use consent scope, participant withdrawal and retention instructions NR; anonymization is not an institutional approval. |
| Domain compatibility | Walkway passes; view, camera count/device/resolution and indoor setting NR. Nominal 30 FPS is not qualified PTS. |
| Suggested role | Potentially suitable for development **or** untouched external validation/domain-shift testing after gates. |
| Blocking questions | Speed dictionary/window, row-to-clip mapping, usable counts, camera/anonymization compatibility and governance. |

Sources: [I release](https://zenodo.org/records/19662017),
[metadata](https://zenodo.org/api/records/19662017),
[GaitScope README](https://github.com/MarcosRM02/GaitScope/blob/9b4a08c92808d53e316e7dfedbe2a337f190a9c7/README.md).

| I quantity/field | Class; unit; granularity / correspondence |
| --- | --- |
| GAITRite speed/velocity, distance, elapsed time, stride parameters | G: actual distributed field names, units, derivation/window unknown; cannot assert a speed label from title. |
| `Gait_Id`, `Event`, `Foot`, `Xback`, `Xfront`, `Ybottom`, `Ytop`, `Yarray` | GAITRite footprint export fields used by author tool; sensor-origin A/C distinction requires dictionary. Not themselves a trial-speed field. |
| Coordinate conversion | Tool converts spatial values to cm with factor 1.27; this is code evidence, not qualification of exported speed units. |
| L/R pressure, accelerometer/gyro, `copX`, `copY`, `sumP` | A/C independent sensor signals/derived quantities; units unresolved. Need calibrated distance/time to derive speed; signal presence is insufficient. |
| SP/NP/FP and metronome cadence | F instructions, not actual speed labels. |
| Nominal rates / `sync_auto.json` | Nominal acquisition rates and auxiliary metadata; qualification/error model G, not physical crossing duration. |
| RAMP-derived events in tool | Algorithm-derived insole events, not independent annotated events or established speed targets. No dataset speed model identified. |

[Pinned data manager](https://github.com/MarcosRM02/GaitScope/blob/9b4a08c92808d53e316e7dfedbe2a337f190a9c7/src/core/data_manager.py)
supports footprint parsing and proportional video↔sample display mapping, with an
FPS fallback. This does not validate the dataset's acquisition synchronization.
[Constants](https://github.com/MarcosRM02/GaitScope/blob/9b4a08c92808d53e316e7dfedbe2a337f190a9c7/src/constants.py)
and [plot code](https://github.com/MarcosRM02/GaitScope/blob/9b4a08c92808d53e316e7dfedbe2a337f190a9c7/src/core/plot_manager.py)
do not resolve the speed export dictionary. No participant CSVs were opened.

## 4. Legal/access comparison

| Meaning | H | I |
| --- | --- | --- |
| PUBLICLY INDEXED | Yes: official record/paper | Yes: official record |
| OPENLY DOWNLOADABLE | Derivative archives listed; needed raw RGB absent | Archive listed, including anonymized clips per description; not downloaded |
| LICENCE-PERMITTED | Governing dataset authority unresolved | CC BY declared for record; use subject to its terms and applicable rights; no study approval implied |
| REQUIRES DUA/REQUEST | Author DUA exists; application/submission route and any separate RGB access NR | No request/DUA required in inspected public notices; do not invent one |
| UNRESOLVED | Which components obey CC BY versus DUA; intended derivative/model uses | Secondary-use governance/retention details, actual target suitability |

H [DUA](https://github.com/AVAuco/healthgait/blob/2a6a29056c5f8a5ed4eac27c5e4c9ba3e65ac6d0/DUA.txt)
supports academic research generally and requires attribution for reported results;
undergraduate access procedure is not specified. Security is explicit; a fixed
retention period, mandatory deletion, feature/model sharing and model-weight terms
are not. Aggregate-result attribution is not permission to publish source records.
There is no demonstrated component-level resolution of the CC BY/DUA conflict.
H code [GPL-3.0](https://github.com/AVAuco/healthgait/blob/2a6a29056c5f8a5ed4eac27c5e4c9ba3e65ac6d0/LICENSE)
and I tool [MIT](https://github.com/MarcosRM02/GaitScope/blob/9b4a08c92808d53e316e7dfedbe2a337f190a9c7/LICENSE)
do not govern dataset media by assumption. H article terms are also separate.

Under [CC BY 4.0 legal code](https://creativecommons.org/licenses/by/4.0/legalcode.en),
copyright/database permissions include reproduction and adaptation with required
attribution when sharing; privacy/personality rights are not automatically granted.
It does not prescribe study retention/deletion or a special ML model policy.
For I, retain this distinction rather than asking whether the published CC licence
allows ordinary academic reuse. Ask only undocumented governance details. For H,
the same licence text cannot resolve which dataset terms actually apply.

## 5. Scientific roles and scale

| Candidate | People / trials / qualified pairs | Potential role; no acquisition authorized |
| --- | --- | --- |
| H | 398 reported people; 1,564 reported videos; acquisition-video versus split-clip accounting unverified. Current exact-passage RGB/reference pairs: not established; published design fails pairing requirement. | NOT eligible for primary/external exact-clip RGB speed evaluation. Aggregate-feature development/hyperparameter work or auxiliary methods potentially suitable only under a separately approved target and resolved terms. |
| I | 23 in original collection; retained released participant count NR; clip count and usable speed-pair count NR. P24 is not a count. | Potentially suitable for development/hyperparameter work **or** sealed external/domain-shift evaluation once qualified. Use separate participants/domains for these roles. |

Participants != sessions != trials != attempts != videos != frames/windows.
No multiplication of independence by clips or frames; exclude STAND/SITDOWN from
speed pairing. Report missing references and quality exclusions, not just successes.
M remains method-only (depth/Xsens); G auxiliary-only (force/speed without RGB).
Their existing classifications need no broader search or task expansion.

## 6. Provider questions — draft only; no contact made

### Questions for Health & Gait providers

1. Which authoritative terms govern each released component and any separately
   accessible RGB files: Zenodo CC BY, the repository DUA, or component-specific
   terms? Please supply the authoritative notice and any required DUA submission process.
2. Does a **separate** release contain RGB recordings paired with independent
   measurements of the same passage? The paper says raw recordings are absent and
   measurements preceded videos; if no additional paired data exist, please confirm.
   If yes, what access route and undergraduate eligibility apply, and what clip keys link it?
3. What are the exact measured CSV speed column names, units and person/pace
   aggregation rules? Which passes/conditions are averaged; are source distance,
   timing events, missingness and uncertainty available as a dictionary/metadata?
4. Under the governing terms, may a student retain local source data and derived
   landmarks/features, train/retain/share weights, publish aggregate thesis results
   and redistribute processed derivatives? Specify any deletion/retention obligations.

Stable person identifiers are already documented; do not ask providers to re-establish
that fact. No current sensor row may be re-labelled as a synchronized clip target.

### Questions for Insole–GAITRite providers

1. Please provide a small export dictionary/header example: does the release contain
   per-trial GAITRite speed/velocity, measured distance, elapsed time or stride metrics?
   Specify field names, units, measurement zone, valid-event rules and uncertainty.
   If speed must be derived, what independently measured fields/formula are valid?
2. Which `Gait_Id`/test-set keys map each video clip to its reference row(s)? How are
   condition summaries distinguished, and how were segmentation and `sync_auto.json`
   generated/qualified, including offsets, drift and reference-window coverage?
3. What are the retained participant and walking-clip counts by condition, usable
   speed-pair counts, quality exclusion criteria/counts and any available failure ledger?
   Stable IDs and intentional numbering gaps are already established.
4. What camera count, device, view, resolution and recording setting were used?
   What anonymization/cropping/transcoding was applied; does it preserve full-body
   pose and timing? Are unmodified RGB files available through a separate permitted route?
5. Beyond the declared CC BY licence, are there documented secondary-use consent,
   withdrawal, local retention/deletion or privacy instructions relevant to video,
   landmarks and model release? Please supply those notices if they exist.

## 7. Adoption gates and decision owners

PASS-DOC = public documentation establishes structure; not a verified ingestion PASS.
No unresolved gate passes automatically. Supervisor/steward must approve use;
future data audit must verify files and freeze participants, versions and lineage.

| Gate | H current release | I current release | Owner / evidence needed |
| --- | --- | --- | --- |
| G1 participant grouping | PASS-DOC | PASS-DOC; retained count unknown | Future inventory audit; stable IDs and all derivatives grouped |
| G2 usable RGB access | FAIL for published raw RGB | CONDITIONAL: anonymized MP4 documented; view/pose suitability unknown | Provider + permitted later inventory |
| G3 independent trial-speed target | FAIL for exact recorded passage | UNKNOWN | Provider dictionary, valid window, units/uncertainty |
| G4 exact video-label correspondence | FAIL for current acquisition design | UNKNOWN beyond co-located files | Provider keys/synchronization/window evidence |
| G5 authoritative terms | UNRESOLVED | PASS-DOC CC BY declaration; inspect component notices if later acquired | Provider H; steward review of intended components |
| G6 intended thesis/storage/derivative use and governance | UNRESOLVED | CONDITIONAL; copyright terms known, governance details missing | Institution/steward; unresolved notices answered |
| G7 scientific role approved | PENDING | PENDING | Supervisor: target, domain and development versus sealed evaluation |

H can only re-enter exact-clip speed planning on **new paired RGB/reference evidence**;
licence clarification alone cannot repair its published design. An aggregate-feature
task needs a separate endpoint decision. For I, obtain small dictionary/inventory
answers first; no archive download solely to discover whether a speed label exists.
Then approve a bounded acquisition audit before any training. See
[reference SOP](WALKING_SPEED_REFERENCE_SOP_DRAFT.md),
[V2 proposal](RESEARCH_MANIFEST_V2_PROPOSAL.md) and
[V2 invariants](RESEARCH_MANIFEST_V2_INVARIANTS.md); no production schema/checker changes.

## 8. Ranked strategies and own-cohort implication

| Rank | Strategy | Decision / rationale |
| --- | --- | --- |
| 1 | Own cohort only | **PREFERRED now**: continue protocol/governance/reference planning; acquisition remains gated. |
| 2 | Own cohort + I | **CONDITIONAL; preferred expansion if qualified**: separate development or untouched external domain, never automatic pooling. |
| 3 | Own cohort + H | **CONDITIONAL only for a separate aggregate/auxiliary task**; not current exact-clip RGB trial-speed validation. |
| 4 | Own cohort + both, separate domains | **CONDITIONAL**: adds overhead; H must retain a different target/role or supply new paired data. No shared headline error across incompatible labels. |
| 5 | Public-only study | **NOT RECOMMENDED for current target**: neither release establishes the complete required task; would need supervisor-approved reformulation. |

**No reason to abandon own-cohort planning is established.** It provides the path
to GaitSense capture/mobile compatibility, approved exact-reference SOP and a sealed
participant holdout. Public laboratory-domain results cannot establish deployment
accuracy. No final cohort count is approved: 8–12 pilot, 40–60 thesis aim and 80–120+
expansion remain planning ranges, not power calculations or guaranteed sufficiency.
Model count (including rumored ~10) and downstream-versus-pose scope remain pending.
App reliability and scientific validation retain separate exit criteria.

## 9. Monday meeting: facts versus decisions

- **FACTS NOW ESTABLISHED:** H raw recordings absent and references acquired before
  videos; person grouping documented. I stable IDs/noncontiguous exclusions and
  clip exports documented; exact released count/speed semantics unknown. Both
  Zenodo APIs declare CC BY; H DUA applicability conflicts. No dataset adopted.
- **SUPERVISOR DECISIONS REQUIRED:** retain proposed speed endpoint/own primary
  cohort; pursue I clarification; whether any H aggregate task justifies effort;
  reserve public data for development or external test; governance owner and
  acceptable domain/reference equivalence. Existing master decisions stay in the
  [supervisor brief](ML_SUPERVISOR_DECISION_BRIEF.md), not silently answered here.
- **PROVIDER CLARIFICATION REQUIRED:** section 6 only, prioritized I dictionary,
  mapping/view/counts and H authoritative terms/any additional paired release.
  Contact must be separately authorized; this task sends no message.

## 10. Source identity, verification and access limits

H: Zafra-Palma et al., Scientific Data **12:44 (2025)**,
DOI 10.1038/s41597-024-04327-4; [PMC paper](https://pmc.ncbi.nlm.nih.gov/articles/PMC11724122/),
[publisher](https://www.nature.com/articles/s41597-024-04327-4),
[Zenodo 14039922](https://zenodo.org/records/14039922) / DOI 10.5281/zenodo.14039922.
Author repository AVAuco/healthgait inspected at
`2a6a29056c5f8a5ed4eac27c5e4c9ba3e65ac6d0`.

I: Dobrescu et al., *An Open Insole-Based Plantar Pressure Dataset at Varying
Cadences Compared Against GAITRite*, Zenodo version 1, **2026**,
DOI 10.5281/zenodo.19662017. No linked companion paper/codebook established in
inspected record/API. Linked tool MarcosRM02/GaitScope inspected at
`9b4a08c92808d53e316e7dfedbe2a337f190a9c7`; its code is not a dataset dictionary.

All reads: **9 October 2026**, official sources only. HTML, small code/licence text,
file listings and JSON repository metadata inspected in memory. No dataset CSV,
participant media, sample ZIP or large archive downloaded; no external code executed.
Zenodo top-level listings provide no separately exposed export dictionary or
complete per-clip inventory. Do not infer archive contents or label absence from
that limitation. Publisher route failed through an identity redirect/internal error;
PMC was readable. Figshare item HTML failed; official API was readable. No challenge
was bypassed; these are access failures, not evidence of dataset ineligibility.

The weak-candidate consistency check retains M/G method-only roles; source registry
and earlier access limitations remain in the audit. The [related-work review](GAITSENSE_NOVELTY_AND_RELATED_WORK_REVIEW.md)
provides context, not adoption permission or a new novelty claim.
No research collection, training, app changes or APK build occurred.
