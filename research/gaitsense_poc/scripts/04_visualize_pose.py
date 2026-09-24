import argparse, logging
from pathlib import Path
import cv2, mediapipe as mp
from common import ROOT, configure_logging, ensure_dirs, video_files
CONNECTIONS=[(11,12),(11,13),(13,15),(12,14),(14,16),(11,23),(12,24),(23,24),(23,25),(25,27),(24,26),(26,28),(27,29),(28,30),(29,31),(30,32)]
def process(video,out,model):
    if not model.exists(): logging.error("Model missing: %s",model); return
    cap=cv2.VideoCapture(str(video)); fps=cap.get(cv2.CAP_PROP_FPS) or 30; w=int(cap.get(cv2.CAP_PROP_FRAME_WIDTH)); h=int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT)); out.parent.mkdir(parents=True,exist_ok=True); writer=cv2.VideoWriter(str(out),cv2.VideoWriter_fourcc(*"mp4v"),fps,(w,h))
    Options=mp.tasks.vision.PoseLandmarkerOptions; Base=mp.tasks.BaseOptions; Mode=mp.tasks.vision.RunningMode; options=Options(base_options=Base(model_asset_path=str(model)),running_mode=Mode.VIDEO,num_poses=1)
    i=0
    with mp.tasks.vision.PoseLandmarker.create_from_options(options) as detector:
        while True:
            ok,frame=cap.read()
            if not ok: break
            result=detector.detect_for_video(mp.Image(image_format=mp.ImageFormat.SRGB,data=cv2.cvtColor(frame,cv2.COLOR_BGR2RGB)),int(i/fps*1000))
            if result.pose_landmarks:
                ls=result.pose_landmarks[0]
                for a,b in CONNECTIONS: cv2.line(frame,(int(ls[a].x*w),int(ls[a].y*h)),(int(ls[b].x*w),int(ls[b].y*h)),(0,255,0),2)
                for l in ls: cv2.circle(frame,(int(l.x*w),int(l.y*h)),4,(0,0,255),-1)
            writer.write(frame); i+=1
    cap.release(); writer.release(); logging.info("Saved %s",out)
def main():
    p=argparse.ArgumentParser(); p.add_argument("--video"); p.add_argument("--input-dir",default=str(ROOT/"videos")); p.add_argument("--output-dir",default=str(ROOT/"output/pose_videos")); p.add_argument("--model",default=str(ROOT/"models/pose_landmarker_full.task")); a=p.parse_args(); configure_logging(); ensure_dirs(); paths=[Path(a.video)] if a.video else video_files(a.input_dir)
    if not paths: print("No videos found. Add a video and rerun.")
    for v in paths: process(v,Path(a.output_dir)/(v.stem+"_pose.mp4"),Path(a.model))
if __name__ == "__main__": main()
