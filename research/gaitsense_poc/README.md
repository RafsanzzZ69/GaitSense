# GaitSense research proof of concept

Curated source from the [original PoC repository](https://github.com/AzM0d3u8/gaitsense_poc). This is engineering feasibility research, not clinical validation.

Pipeline: video → MediaPipe landmarks → smoothing → gait events → relative features → exploratory Random Forest, linear and neural-network regression.

## Historical evidence and limitations

Eight recordings represented four participants; five passed the existing pose-quality filter. Walking-speed labels were visually estimated from frame boundaries, not independently established clinical ground truth. A one-recording holdout makes R-squared undefined and comparisons unreliable. A one-participant reference sample is insufficient for validation. View-sensitive features require calibration; duplicate recordings must not cross train/test partitions.

This aggregate summary replaces private evidence links in the published requirements checklist. It is not a reproduction of participant records or proof of requirement acceptance.

## Publication boundary and reproduction

Included: scripts, run_pipeline.py and historical requirements.txt. Excluded and retained locally: original/overlay videos, alias maps, participant labels, data/, artifacts/, reports/, dataset_samples/, private audit documents and trained pickle files. Do not share these through GitHub issues.

From the project root, obtain the official pose asset with `node frontend/scripts/prepare-pose-model.mjs --download`. Its SHA-256 is `5134a3aad27a58b93da0088d431f366da362b44e3ccfbe3462b3827a839011b1`. Historical scripts expect models/pose_landmarker_full.task; copy the verified frontend asset there locally when reproducing the pipeline.

Obtain approved private inputs and confirm their schema against the scripts. In this directory create a virtual environment, install requirements.txt, then run `python scripts/01_video_info.py --input-dir videos` and `python run_pipeline.py`. Dependencies are historically unpinned; pin and test an isolated environment before claiming reproducibility. Source alone cannot reproduce the old experiment.

Next work follows [the study protocol](../../docs/planning/STUDY_PROTOCOL.md): approved consent, independent targets, more participants and participant-separated evaluation. No validated clinical model is delivered by this folder.
