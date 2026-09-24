import argparse, glob
from pathlib import Path
import pandas as pd
from common import ROOT, REQUIRED, ensure_dirs

def check(path):
    df=pd.read_csv(path); total=df.frame.nunique(); valid=0
    for _, g in df.groupby("frame"):
        if all(name in set(g.landmark_name) and pd.notna(g.loc[g.landmark_name==name,"x"]).any() for name in REQUIRED): valid+=1
    pct=100*valid/total if total else 0; row={"video":path.stem.replace("_landmarks", ""),"total_frames":total,"usable_frames":valid,"quality_percent":pct,"status":"GOOD" if pct>=90 else "ACCEPTABLE" if pct>=70 else "POOR"}
    for name in REQUIRED:
        vals=pd.to_numeric(df.loc[df.landmark_name==name,"visibility"],errors="coerce"); row[name.lower()+"_visibility_mean"]=vals.mean()
    return row
def main():
    p=argparse.ArgumentParser(); p.add_argument("--input-dir",default=str(ROOT/"output/landmarks")); p.add_argument("--output",default=str(ROOT/"output/reports/quality_summary.csv")); a=p.parse_args(); ensure_dirs(); files=sorted(Path(a.input_dir).glob("*_landmarks.csv"));
    if not files: print("No landmark CSVs found. Run 02_pose_extraction.py first."); return
    out=pd.DataFrame([check(f) for f in files]); out.to_csv(a.output,index=False); print(out.to_string(index=False)); print("Saved:",a.output)
if __name__ == "__main__": main()
