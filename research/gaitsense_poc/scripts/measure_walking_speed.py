"""Interactively measure a marked 4-meter walking interval in each video.

Controls: SPACE=start, ENTER=end, R=reset, N=save/next, Q=quit.
The tool never uses the full video duration and never invents labels.
"""
import argparse
import logging
from pathlib import Path
import cv2
import pandas as pd
from common import ROOT, ensure_dirs, video_files

DISTANCE_M = 4.0

def resolve_videos(input_dir):
    if input_dir: return video_files(input_dir)
    for candidate in (ROOT/'videos', ROOT/'Test walking videos '):
        found = video_files(candidate)
        if found: return found
    return []

def show_frame(frame, name, fps, current, start, end, delay):
    display = frame.copy(); lines = [f'Video: {name}    FPS: {fps:.3f}    Frame: {current}', f'START FRAME: {start if start is not None else "---"}    END FRAME: {end if end is not None else "---"}', f'Walking distance: {DISTANCE_M:.1f} m']
    if start is not None and end is not None and end > start:
        seconds = (end-start)/fps; lines.append(f'Walking time: {seconds:.3f} s    Walking speed: {DISTANCE_M/seconds:.6f} m/s')
    else: lines.append('SPACE=start   ENTER=end   R=reset   N=save/next   Q=quit')
    scale=min(1.0,1280/display.shape[1]);
    if scale<1: display=cv2.resize(display,None,fx=scale,fy=scale)
    for i,text in enumerate(lines): cv2.putText(display,text,(15,30+i*30),cv2.FONT_HERSHEY_SIMPLEX,.7,(0,255,255),2,cv2.LINE_AA)
    cv2.imshow('GaitSense walking-speed measurement',display); return cv2.waitKey(delay)&0xFF

def measure(video, delay):
    cap=cv2.VideoCapture(str(video)); fps=cap.get(cv2.CAP_PROP_FPS); total=int(cap.get(cv2.CAP_PROP_FRAME_COUNT))
    if not cap.isOpened() or fps<=0: logging.error('Cannot open or read FPS: %s',video); return None
    current=0; start=end=None; result=None
    while True:
        ok,frame=cap.read()
        if not ok: cap.set(cv2.CAP_PROP_POS_FRAMES,0); current=0; continue
        key=show_frame(frame,video.stem,fps,current,start,end,delay)
        if key==32: start=current; end=None
        elif key in (13,10):
            if start is None: print('Mark START first.'); continue
            if current>start: end=current
        elif key in (ord('r'),ord('R')): start=end=None; cap.set(cv2.CAP_PROP_POS_FRAMES,0); current=0; continue
        elif key in (ord('n'),ord('N')):
            if start is None or end is None or end<=start: print('Mark a valid START and END before pressing N.'); continue
            seconds=(end-start)/fps; result={'video':video.stem,'fps':fps,'start_frame':start,'end_frame':end,'walking_time_seconds':seconds,'walking_distance_m':DISTANCE_M,'walking_speed_mps':DISTANCE_M/seconds}; break
        elif key in (ord('q'),ord('Q'),27): break
        current+=1
        if current>=total: cap.set(cv2.CAP_PROP_POS_FRAMES,0); current=0
    cap.release(); return result

def main():
    p=argparse.ArgumentParser(); p.add_argument('--input-dir'); p.add_argument('--measurements',default=str(ROOT/'data/speed_measurements.csv')); p.add_argument('--targets',default=str(ROOT/'data/speed_targets.csv')); p.add_argument('--delay-ms',type=int,default=30); p.add_argument('--overwrite',action='store_true'); a=p.parse_args(); ensure_dirs(); videos=resolve_videos(a.input_dir)
    if not videos: print('No videos found. Put videos in videos/ or pass --input-dir.'); return 1
    measurement_path,target_path=Path(a.measurements),Path(a.targets); measurements=pd.read_csv(measurement_path) if measurement_path.exists() else pd.DataFrame(); targets=pd.read_csv(target_path) if target_path.exists() else pd.DataFrame(columns=['video','walking_speed_mps'])
    try:
        for video in videos:
            already_measured = (not measurements.empty and 'video' in measurements and str(video.stem) in measurements.video.astype(str).values) or (not targets.empty and 'video' in targets and str(video.stem) in targets.video.astype(str).values and pd.to_numeric(targets.loc[targets.video.astype(str)==video.stem, 'walking_speed_mps'], errors='coerce').notna().any())
            if not a.overwrite and already_measured: print('Preserving existing measurement:',video.stem); continue
            try: result=measure(video,a.delay_ms)
            except cv2.error as exc: print('OpenCV display error. Run this tool in a desktop session:',exc); return 2
            if result is None: continue
            print(f"{video.stem}: {result['walking_time_seconds']:.6f} s, {result['walking_speed_mps']:.6f} m/s")
            if not measurements.empty and 'video' in measurements: measurements=measurements[measurements.video.astype(str)!=video.stem]
            if 'video' in targets: targets=targets[targets.video.astype(str)!=video.stem]
            measurements=pd.concat([measurements,pd.DataFrame([result])],ignore_index=True); targets=pd.concat([targets,pd.DataFrame([{'video':video.stem,'walking_speed_mps':result['walking_speed_mps']}])],ignore_index=True)
            measurement_path.parent.mkdir(parents=True,exist_ok=True); target_path.parent.mkdir(parents=True,exist_ok=True); measurements.to_csv(measurement_path,index=False); targets.to_csv(target_path,index=False)
    finally: cv2.destroyAllWindows()
    print('Measurements:',measurement_path); print('Targets:',target_path); return 0
if __name__=='__main__': raise SystemExit(main())
