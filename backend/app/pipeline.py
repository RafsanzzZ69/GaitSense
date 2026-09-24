"""Experimental camera-space measurements, deliberately no disease or health scores."""
import hashlib
import math
from pathlib import Path

import cv2
import numpy as np
from scipy.signal import find_peaks

VERSION = "0.2.0"
LIMITATIONS = [
    "Experimental, unvalidated video measurements; not medical advice or diagnosis.",
    "Camera angle, clothing, occlusion and walking outside the frame affect these estimates.",
    "No health, knee-stress, neurological or fall-risk score is computed.",
    "Distance, speed and ground-contact timing are unavailable without validated calibration and events.",
    "Timestamps use decoded frame order and nominal FPS; variable-frame-rate recordings need further validation.",
]


class ProcessingError(Exception):
    def __init__(self, code, message, retryable=False):
        self.code, self.message, self.retryable = code, message, retryable
        super().__init__(message)


def joint_angle(a, b, c):
    u, v = a - b, c - b
    norm = np.linalg.norm(u, axis=-1) * np.linalg.norm(v, axis=-1)
    cosine = np.divide(np.sum(u * v, axis=-1), norm, out=np.full_like(norm, np.nan), where=norm > 1e-8)
    return np.degrees(np.arccos(np.clip(cosine, -1, 1)))


def longest_run(mask):
    runs, start = [], None
    for i, good in enumerate([*mask, False]):
        if good and start is None:
            start = i
        elif not good and start is not None:
            runs.append((start, i))
            start = None
    return max(runs, key=lambda item: item[1] - item[0], default=(0, 0))


def measure(points, times, width, height, angle):
    """points: N x 33 x (x,y,z,visibility). No interpolation across missing poses."""
    points = np.asarray(points, dtype=float)
    times = np.asarray(times, dtype=float)
    xy = points[:, :, :2] * [width, height]  # Correct aspect ratio BEFORE computing angles.
    visible = (points[:, :, 3] >= 0.6) & np.isfinite(xy).all(axis=2)
    in_frame = ((points[:, :, :2] >= 0) & (points[:, :, :2] <= 1)).all(axis=2)
    visible &= in_frame
    required = [11, 12, 23, 24, 25, 26, 27, 28]
    if angle != "front":
        required = [11, 23, 25, 27] if angle == "side_left" else [12, 24, 26, 28]
    valid = visible[:, required].all(axis=1)
    ratio = float(np.mean(valid))
    values = points[:, required, 3]
    mean_visibility = float(np.mean(np.nan_to_num(values)))
    quality = {"usableFrameRatio": ratio, "meanLandmarkVisibility": mean_visibility,
               "warnings": ["Quality thresholds are engineering heuristics, not clinically validated."]}
    if ratio < 0.5:
        raise ProcessingError("INSUFFICIENT_POSE", "Less than half the sampled frames show the required body landmarks clearly.")
    metrics, definitions = {}, {}
    unavailable = {"walkingSpeedMps": "No independent distance calibration or validated speed model",
                   "strideLengthCm": "Uncalibrated monocular video",
                   "contactTimeRatio": "Foot-ground contact not validated",
                   "doubleSupportRatio": "Foot-ground contact not validated",
                   "fallRisk": "No validated clinical model", "overallScore": "No validated scoring model"}
    if angle == "front":
        for key, left, right in [("shoulderLevelDifference", 11, 12), ("hipLevelDifference", 23, 24)]:
            mask = visible[:, [left, right]].all(axis=1)
            metrics[key] = float(np.median(np.abs(points[mask, left, 1] - points[mask, right, 1])))
            definitions[key] = {"unit": "image_height_fraction", "method": "Median absolute projected left-right height difference"}
        unavailable.update({"cadenceSpm": "Front-view event detection has not been validated",
                            "kneeFlexionDeg": "Sagittal joint angles require a side view"})
    else:
        side = "left" if angle == "side_left" else "right"
        hip, knee, ankle, shoulder, wrist = (23, 25, 27, 11, 15) if side == "left" else (24, 26, 28, 12, 16)
        flexion = 180 - joint_angle(xy[valid, hip], xy[valid, knee], xy[valid, ankle])
        flexion = flexion[np.isfinite(flexion)]
        if len(flexion):
            metrics["kneeFlexionDeg"] = {side: float(np.percentile(flexion, 95))}
            definitions["kneeFlexionDeg"] = {"unit": "degrees", "method": "95th percentile projected flexion over usable frames; not mid-swing lab kinematics"}
        arm_mask = visible[:, [hip, shoulder, wrist]].all(axis=1)
        if np.sum(arm_mask) >= 10:
            arm = joint_angle(xy[arm_mask, hip], xy[arm_mask, shoulder], xy[arm_mask, wrist])
            arm = arm[np.isfinite(arm)]
            if len(arm):
                metrics["armSwingDeg"] = {side: float(np.percentile(arm, 95) - np.percentile(arm, 5))}
                definitions["armSwingDeg"] = {"unit": "degrees", "method": "Projected shoulder-arm angle 5th-to-95th percentile range; not a diagnostic arm-swing measure"}
        # Alternating ankle separation extrema are candidate events, not confirmed heel strikes.
        events_valid = visible[:, [23, 24, 27, 28]].all(axis=1)
        start, stop = longest_run(events_valid)
        unavailable["cadenceSpm"] = "Insufficient continuous visible alternating ankle events"
        if stop - start >= 20 and times[stop - 1] - times[start] >= 2:
            ts = times[start:stop]
            separation = points[start:stop, 27, 0] - points[start:stop, 28, 0]
            sample_dt = float(np.median(np.diff(ts)))
            # Minimum within-side spacing is a full stride, unlike the old PoC's frame-row timing.
            distance = max(1, int(0.4 / sample_dt))
            positive, _ = find_peaks(separation, distance=distance, prominence=0.035)
            negative, _ = find_peaks(-separation, distance=distance, prominence=0.035)
            events = sorted([(i, 0) for i in positive] + [(i, 1) for i in negative])
            if len(events) >= 5 and all(a[1] != b[1] for a, b in zip(events, events[1:])):
                intervals = np.diff([ts[i] for i, _ in events])
                cadence = 60 / float(np.median(intervals))
                if 40 <= cadence <= 240 and np.all((intervals >= 0.25) & (intervals <= 1.5)):
                    metrics.update({"cadenceSpm": cadence, "detectedStepCount": len(events)})
                    definitions["cadenceSpm"] = {"unit": "steps/minute", "method": "60 / median interval between alternating ankle-separation extrema in longest gap-free segment", "segmentSeconds": [float(ts[0]), float(ts[-1])]}
                    unavailable.pop("cadenceSpm")
                    quality["warnings"].append("Candidate step events require manual validation; entry, turns and exits are not automatically segmented.")
    return metrics, definitions, unavailable, quality


def analyze(path, model_path, angle, heartbeat=lambda: None):
    if not Path(model_path).is_file():
        raise ProcessingError("POSE_MODEL_MISSING", "Install the MediaPipe pose model before running the worker.")
    try:
        import mediapipe as mp
    except ImportError:
        raise ProcessingError("VISION_NOT_INSTALLED", "Install the backend vision dependencies.") from None
    model_hash = hashlib.sha256(Path(model_path).read_bytes()).hexdigest()
    options = mp.tasks.vision.PoseLandmarkerOptions(
        base_options=mp.tasks.BaseOptions(model_asset_path=str(model_path)),
        running_mode=mp.tasks.vision.RunningMode.VIDEO, num_poses=2,
        min_pose_detection_confidence=0.6, min_pose_presence_confidence=0.6, min_tracking_confidence=0.6)
    cap = cv2.VideoCapture(str(path))
    fps = cap.get(cv2.CAP_PROP_FPS)
    if not math.isfinite(fps) or fps <= 0:
        cap.release()
        raise ProcessingError("INVALID_VIDEO", "Cannot determine video frame rate")
    sample_every = max(1, math.ceil(fps / 15))
    width, height = cap.get(cv2.CAP_PROP_FRAME_WIDTH), cap.get(cv2.CAP_PROP_FRAME_HEIGHT)
    frames, points, times, brightness, sharpness = [], [], [], [], []
    multiple, index, decoded = 0, 0, 0
    try:
        with mp.tasks.vision.PoseLandmarker.create_from_options(options) as detector:
            while True:
                ok, frame = cap.read()
                if not ok:
                    break
                decoded += 1
                if decoded > min(14400, math.ceil(fps * 60) + 1):
                    raise ProcessingError("VIDEO_TOO_LONG", "Decoded video exceeds the 60-second limit")
                if index % sample_every == 0:
                    if len(times) % 15 == 0:
                        heartbeat()
                    # Bound inference size while preserving aspect ratio.
                    scale = min(1, 768 / max(frame.shape[:2]))
                    small = cv2.resize(frame, None, fx=scale, fy=scale) if scale < 1 else frame
                    gray = cv2.cvtColor(small, cv2.COLOR_BGR2GRAY)
                    brightness.append(float(np.mean(gray)))
                    sharpness.append(float(cv2.Laplacian(gray, cv2.CV_64F).var()))
                    result = detector.detect_for_video(mp.Image(image_format=mp.ImageFormat.SRGB,
                        data=cv2.cvtColor(small, cv2.COLOR_BGR2RGB)), round(index / fps * 1000))
                    times.append(index / fps)
                    if len(result.pose_landmarks) > 1:
                        multiple += 1
                    if len(result.pose_landmarks) == 1:
                        landmarks = [{"index": i, "x": float(p.x), "y": float(p.y), "z": float(p.z),
                                      "visibility": float(min(p.visibility, p.presence))}
                                     for i, p in enumerate(result.pose_landmarks[0])]
                        frames.append({"frameNumber": index, "timestampMs": index / fps * 1000, "landmarks": landmarks})
                        points.append([[p["x"], p["y"], p["z"], p["visibility"]] for p in landmarks])
                    else:
                        points.append(np.full((33, 4), np.nan))
                index += 1
    finally:
        cap.release()
    if not times or decoded / fps < 2:
        raise ProcessingError("INVALID_VIDEO", "Not enough decodable video")
    if multiple / len(times) > 0.05:
        raise ProcessingError("MULTIPLE_PEOPLE", "Record only one person at a time")
    metrics, definitions, unavailable, quality = measure(points, times, width, height, angle)
    if np.mean(brightness) < 35 or np.mean(brightness) > 230:
        quality["warnings"].append("Lighting is poor; repeat in even lighting.")
    if np.median(sharpness) < 30:
        quality["warnings"].append("Video may be blurry; use a stationary focused camera.")
    return {"frames": frames, "metrics": metrics, "definitions": definitions, "unavailable": unavailable,
            "quality": quality, "poseModel": {"name": "mediapipe-pose-landmarker", "version": model_hash[:32], "landmarkCount": 33},
            "modelSha256": model_hash, "sampledFrames": len(times), "decodedFrames": decoded}
