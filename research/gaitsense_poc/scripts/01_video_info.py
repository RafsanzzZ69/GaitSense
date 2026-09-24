import argparse
import cv2
from pathlib import Path
from common import ROOT, configure_logging, ensure_dirs, video_files

def inspect(path):
    cap = cv2.VideoCapture(str(path))
    if not cap.isOpened():
        print(f"ERROR: Cannot open {path}")
        return
    fps = cap.get(cv2.CAP_PROP_FPS); frames = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))
    width = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH)); height = int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT))
    fourcc = int(cap.get(cv2.CAP_PROP_FOURCC)); codec = "".join(chr((fourcc >> 8*i) & 255) for i in range(4)) if fourcc else "unknown"
    print(f"\nVideo: {path.name}\nResolution: {width} x {height}\nFPS: {fps:.3f}\nFrames: {frames}\nDuration: {frames/fps:.2f} seconds\nCodec: {codec}")
    cap.release()

def main():
    parser = argparse.ArgumentParser(); parser.add_argument("--input-dir", default=str(ROOT / "videos")); parser.add_argument("--video")
    args = parser.parse_args(); ensure_dirs()
    paths = [Path(args.video)] if args.video else video_files(args.input_dir)
    if not paths: print(f"No videos found in {args.input_dir}. Add MP4/MOV/AVI/MKV files.")
    for path in paths: inspect(path)
if __name__ == "__main__": main()
