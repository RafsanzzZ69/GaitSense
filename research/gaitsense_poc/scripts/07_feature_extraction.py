import argparse, glob
from pathlib import Path
import numpy as np, pandas as pd
from common import ROOT, angle, ensure_dirs, infer_metadata, safe_ratio
FEATURES=["cadence","step_symmetry_ratio","step_time_variability","left_knee_range","right_knee_range","knee_range_asymmetry_percent","left_arm_swing_proxy","right_arm_swing_proxy","arm_swing_asymmetry","hip_center_lateral_sway_proxy"]
def feature(path,events_dir,metadata):
    df=pd.read_csv(path); name=path.stem.replace("_smoothed",""); participant,condition,view=infer_metadata(name,metadata); duration=float(df.timestamp.max()-df.timestamp.min()) if not df.empty else np.nan; evpath=events_dir/(name+"_events.csv"); ev=pd.read_csv(evpath) if evpath.exists() else pd.DataFrame(columns=["side","timestamp"]); times=np.sort(pd.to_numeric(ev.timestamp,errors="coerce").dropna().unique()); intervals=np.diff(times); intervals=intervals[(intervals>=.25)&(intervals<=3)]
    mean=np.mean(intervals) if len(intervals) else np.nan; std=np.std(intervals,ddof=1) if len(intervals)>1 else np.nan; side=[]
    for s in ("LEFT","RIGHT"):
        t=np.sort(ev.loc[ev.side==s,"timestamp"].dropna().unique()); it=np.diff(t); it=it[(it>=.25)&(it<=3)]; side.append(np.mean(it) if len(it) else np.nan)
    ranges={}; arm={}
    for s in ("left","right"):
        vals=[]
        for _,g in df.groupby("frame"): vals.append(angle(point(g,s.upper()+"_HIP"),point(g,s.upper()+"_KNEE"),point(g,s.upper()+"_ANKLE")))
        vals=np.array(vals,dtype=float); ranges[s]=np.nanmax(vals)-np.nanmin(vals) if np.isfinite(vals).any() else np.nan
        sh=df[df.landmark_name==s.upper()+"_SHOULDER"].set_index("frame"); wr=df[df.landmark_name==s.upper()+"_WRIST"].set_index("frame"); common=sh.index.intersection(wr.index); arm[s]=float(np.nanmean(np.hypot(sh.loc[common,"x"].diff(),sh.loc[common,"y"].diff()))+np.nanmean(np.hypot(wr.loc[common,"x"].diff(),wr.loc[common,"y"].diff()))) if len(common)>1 else np.nan
    hips=df[df.landmark_name.isin(["LEFT_HIP","RIGHT_HIP"])].pivot(index="frame",columns="landmark_name",values="x"); sway=float(np.nanstd(hips.mean(axis=1))) if not hips.empty else np.nan
    return {"participant":participant,"video":name,"condition":condition,"view":view,"duration_seconds":duration,"usable_frame_percent":np.nan,"step_count":len(times),"cadence":safe_ratio(len(times)*60,duration),"mean_step_time":mean,"step_time_std":std,"step_time_variability":safe_ratio(std*100,mean),"left_mean_step_time":side[0],"right_mean_step_time":side[1],"step_symmetry_ratio":safe_ratio(min(side),max(side)) if all(np.isfinite(side)) else np.nan,"timing_asymmetry_percent":safe_ratio(abs(side[0]-side[1])*100,np.mean(side)) if all(np.isfinite(side)) else np.nan,"left_knee_range":ranges["left"],"right_knee_range":ranges["right"],"knee_range_asymmetry_percent":safe_ratio(abs(ranges["left"]-ranges["right"])*100,np.mean([ranges["left"],ranges["right"]])) if all(np.isfinite(list(ranges.values()))) else np.nan,"left_arm_swing_proxy":arm["left"],"right_arm_swing_proxy":arm["right"],"arm_swing_asymmetry":safe_ratio(abs(arm["left"]-arm["right"])*100,np.mean(list(arm.values()))) if all(np.isfinite(list(arm.values()))) else np.nan,"hip_center_lateral_sway_proxy":sway}
def point(g,name):
    r=g[g.landmark_name==name]; return r.iloc[0][["x","y"]].to_numpy(float) if not r.empty and r.iloc[0][["x","y"]].notna().all() else None
def main():
    p=argparse.ArgumentParser(); p.add_argument("--input-dir",default=str(ROOT/"output/landmarks")); p.add_argument("--events-dir",default=str(ROOT/"output/features")); p.add_argument("--metadata",default=str(ROOT/"data/metadata.csv")); p.add_argument("--quality",default=str(ROOT/"output/reports/quality_summary.csv")); p.add_argument("--output",default=str(ROOT/"data/features.csv")); a=p.parse_args(); ensure_dirs(); rows=[]
    quality=pd.read_csv(a.quality) if Path(a.quality).exists() else pd.DataFrame()
    allowed=set(quality.loc[quality.status!="POOR","video"]) if not quality.empty and "status" in quality else None
    for f in sorted(Path(a.input_dir).glob("*_smoothed.csv")):
        if allowed is not None and f.stem.replace("_smoothed","") not in allowed:
            print("Skipping POOR video:", f.name); continue
        row=feature(f,Path(a.events_dir),a.metadata)
        if not quality.empty and "quality_percent" in quality:
            match=quality[quality.video.astype(str)==row["video"]]
            if not match.empty: row["usable_frame_percent"]=float(match.iloc[0].quality_percent)
        rows.append(row)
    if rows: pd.DataFrame(rows).to_csv(a.output,index=False); print("Saved:",a.output)
    else: print("No smoothed CSVs found. Run 05 and 06 first.")
if __name__=="__main__": main()
