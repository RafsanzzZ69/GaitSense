import argparse
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent

def run(script, args):
    print('\n===', script, '===')
    return subprocess.run([sys.executable, str(ROOT/'scripts'/script), *args]).returncode

def main():
    p = argparse.ArgumentParser(); p.add_argument('--video'); a = p.parse_args()
    video_args = ['--video', a.video] if a.video else []
    for script in ['01_video_info.py','02_pose_extraction.py','03_quality_check.py','04_visualize_pose.py','05_smoothing.py','06_gait_events.py','07_feature_extraction.py','08_plot_features.py','09_compare_conditions.py','10_train_model.py','11_generate_report.py']:
        code = run(script, video_args if script in ('01_video_info.py','02_pose_extraction.py','04_visualize_pose.py') else [])
        if code and script == '02_pose_extraction.py':
            print('Stopping: pose extraction failed; check the model and video.'); return code
    return 0

if __name__ == '__main__': raise SystemExit(main())
