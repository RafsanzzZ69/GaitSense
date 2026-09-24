from __future__ import annotations

import logging
from pathlib import Path
import numpy as np
import pandas as pd

ROOT = Path(__file__).resolve().parents[1]
VIDEO_EXTENSIONS = (".mp4", ".mov", ".avi", ".mkv")
LANDMARK_NAMES = [
    "NOSE", "LEFT_EYE_INNER", "LEFT_EYE", "LEFT_EYE_OUTER",
    "RIGHT_EYE_INNER", "RIGHT_EYE", "RIGHT_EYE_OUTER", "LEFT_EAR",
    "RIGHT_EAR", "MOUTH_LEFT", "MOUTH_RIGHT", "LEFT_SHOULDER",
    "RIGHT_SHOULDER", "LEFT_ELBOW", "RIGHT_ELBOW", "LEFT_WRIST",
    "RIGHT_WRIST", "LEFT_PINKY", "RIGHT_PINKY", "LEFT_INDEX",
    "RIGHT_INDEX", "LEFT_THUMB", "RIGHT_THUMB", "LEFT_HIP",
    "RIGHT_HIP", "LEFT_KNEE", "RIGHT_KNEE", "LEFT_ANKLE",
    "RIGHT_ANKLE", "LEFT_HEEL", "RIGHT_HEEL", "LEFT_FOOT_INDEX",
    "RIGHT_FOOT_INDEX",
]
REQUIRED = ["LEFT_HIP", "RIGHT_HIP", "LEFT_KNEE", "RIGHT_KNEE", "LEFT_ANKLE", "RIGHT_ANKLE"]


def configure_logging(debug=False):
    logging.basicConfig(level=logging.DEBUG if debug else logging.INFO, format="%(levelname)s: %(message)s")


def ensure_dirs(root=ROOT):
    for name in ("videos", "models", "output/landmarks", "output/pose_videos", "output/features", "output/plots", "output/reports", "output/logs", "data"):
        (root / name).mkdir(parents=True, exist_ok=True)


def video_files(directory):
    directory = Path(directory)
    return sorted(p for p in directory.iterdir() if p.is_file() and p.suffix.lower() in VIDEO_EXTENSIONS) if directory.exists() else []


def finite_series(values):
    return pd.to_numeric(values, errors="coerce").replace([np.inf, -np.inf], np.nan).dropna()


def safe_ratio(a, b):
    return float(a / b) if pd.notna(a) and pd.notna(b) and b not in (0, 0.0) else np.nan


def infer_metadata(video_name, metadata_path):
    path = Path(metadata_path)
    if path.exists():
        metadata = pd.read_csv(path)
        if "video" in metadata.columns:
            found = metadata[metadata.video.astype(str).isin([video_name, Path(video_name).stem])]
            if not found.empty:
                row = found.iloc[0].to_dict()
                return row.get("participant", "unknown"), row.get("condition", "unknown"), row.get("view", "unknown")
    stem = Path(video_name).stem
    participant = stem.split("_")[0] if "_" in stem else "unknown"
    condition = "controlled_variation" if any(x in stem.lower() for x in ("asymmetry", "variation", "limp")) else "normal"
    return participant, condition, "unknown"


def load_landmarks(path):
    return pd.read_csv(path)


def point(frame_df, name):
    rows = frame_df[frame_df.landmark_name == name]
    if rows.empty:
        return None
    values = rows.iloc[0][["x", "y"]].to_numpy(dtype=float)
    return values if np.isfinite(values).all() else None


def angle(a, b, c):
    if any(v is None for v in (a, b, c)):
        return np.nan
    ba, bc = a - b, c - b
    denom = np.linalg.norm(ba) * np.linalg.norm(bc)
    if denom == 0:
        return np.nan
    return float(np.degrees(np.arccos(np.clip(np.dot(ba, bc) / denom, -1, 1))))
