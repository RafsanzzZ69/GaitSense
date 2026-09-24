import argparse, logging
from pathlib import Path
import cv2, pandas as pd
import mediapipe as mp
from common import ROOT, LANDMARK_NAMES, configure_logging, ensure_dirs, video_files

def process(video, output_dir, model):
    if not model.exists(): logging.error("Model missing: %s. Download pose_landmarker_full.task into models/.", model); return False
    cap = cv2.VideoCapture(str(video)); fps = cap.get(cv2.CAP_PROP_FPS)
    if not cap.isOpened() or fps <= 0: logging.error("Cannot open video or read FPS: %s", video); return False
    BaseOptions = mp.tasks.BaseOptions; PoseLandmarker = mp.tasks.vision.PoseLandmarker
    Options = mp.tasks.vision.PoseLandmarkerOptions; RunningMode = mp.tasks.vision.RunningMode
    options = Options(base_options=BaseOptions(model_asset_path=str(model)), running_mode=RunningMode.VIDEO, num_poses=1,
        min_pose_detection_confidence=0.5, min_pose_presence_confidence=0.5, min_tracking_confidence=0.5)
    rows=[]; frame_no=0
    with PoseLandmarker.create_from_options(options) as landmarker:
        while True:
            ok, frame = cap.read()
            if not ok: break
            timestamp_ms = int(frame_no / fps * 1000); rgb = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
            result = landmarker.detect_for_video(mp.Image(image_format=mp.ImageFormat.SRGB, data=rgb), timestamp_ms)
            if result.pose_landmarks:
                for i, landmark in enumerate(result.pose_landmarks[0]):
                    rows.append({"frame":frame_no,"timestamp":timestamp_ms/1000,"landmark_id":i,"landmark_name":LANDMARK_NAMES[i],"x":landmark.x,"y":landmark.y,"z":landmark.z,"visibility":getattr(landmark,"visibility",None),"presence":getattr(landmark,"presence",None)})
            else: rows.append({"frame":frame_no,"timestamp":timestamp_ms/1000,"landmark_id":-1,"landmark_name":"NO_POSE","x":None,"y":None,"z":None,"visibility":0,"presence":0})
            frame_no += 1
            if frame_no % 30 == 0: logging.info("%s: %d frames", video.name, frame_no)
    cap.release(); out=output_dir/(video.stem+"_landmarks.csv"); pd.DataFrame(rows).to_csv(out,index=False); logging.info("Saved %s",out); return True

def main():
    p=argparse.ArgumentParser(); p.add_argument("--video"); p.add_argument("--input-dir",default=str(ROOT/"videos")); p.add_argument("--output-dir",default=str(ROOT/"output/landmarks")); p.add_argument("--model",default=str(ROOT/"models/pose_landmarker_full.task")); p.add_argument("--debug",action="store_true"); a=p.parse_args(); configure_logging(a.debug); ensure_dirs()
    paths=[Path(a.video)] if a.video else video_files(a.input_dir)
    if not paths: logging.warning("No videos found in %s",a.input_dir)
    for path in paths: process(path,Path(a.output_dir),Path(a.model))
if __name__ == "__main__": main()
