import argparse
from pathlib import Path
import numpy as np, pandas as pd
from scipy.signal import savgol_filter
from common import ROOT, ensure_dirs

def smooth(path,out,window=7,poly=2):
    df=pd.read_csv(path); df=df.sort_values(["frame","landmark_id"]); window=max(poly+3,window|1)
    for col in ("x","y","z"):
        for lid, idx in df.groupby("landmark_id").groups.items():
            vals=pd.to_numeric(df.loc[idx,col],errors="coerce"); valid=vals.notna()
            vals=vals.interpolate(limit=3,limit_direction="both")
            if valid.sum() >= window: vals.loc[valid.index[valid]]=savgol_filter(vals.to_numpy(),window,poly)[valid.to_numpy()]
            df.loc[idx,col]=vals
    out.parent.mkdir(parents=True,exist_ok=True); df.to_csv(out,index=False); print("Saved:",out)
def main():
    p=argparse.ArgumentParser(); p.add_argument("--input-dir",default=str(ROOT/"output/landmarks")); p.add_argument("--output-dir",default=str(ROOT/"output/landmarks")); p.add_argument("--window",type=int,default=7); a=p.parse_args(); ensure_dirs(); files=sorted(Path(a.input_dir).glob("*_landmarks.csv"));
    if not files: print("No landmark CSVs found. Run 02_pose_extraction.py first.")
    for f in files: smooth(f,Path(a.output_dir)/(f.stem.replace("_landmarks","")+"_smoothed.csv"),a.window)
if __name__=="__main__": main()
