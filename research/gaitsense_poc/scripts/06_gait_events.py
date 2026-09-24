import argparse
from pathlib import Path
import numpy as np, pandas as pd
from scipy.signal import find_peaks
import matplotlib.pyplot as plt
from common import ROOT, ensure_dirs
def detect(path,out_dir,plot_dir,fps=None,distance=.4,prominence=.01,signal="y"):
    df=pd.read_csv(path); fps=fps or (1/df.timestamp.diff().median() if df.timestamp.diff().median()>0 else 30); events=[]; fig,ax=plt.subplots(figsize=(12,5))
    for side,color in (("LEFT","tab:blue"),("RIGHT","tab:orange")):
        part=df[df.landmark_name==side+"_ANKLE"].sort_values("frame").copy(); vals=pd.to_numeric(part[signal],errors="coerce").interpolate(limit=3).to_numpy(dtype=float, copy=True); valid=np.isfinite(vals)
        if not valid.any(): continue
        vals[~valid]=np.nanmedian(vals[valid]); peaks,_=find_peaks(vals,distance=max(1,int(fps*distance)),prominence=prominence)
        ax.plot(part.frame,vals,label=side+" ankle",color=color); ax.plot(part.iloc[peaks].frame,vals[peaks],"x",color=color)
        for p in peaks: events.append({"video":path.stem.replace("_smoothed","").replace("_landmarks",""),"side":side,"event":"step_event","frame":int(part.iloc[p].frame),"timestamp":float(part.iloc[p].timestamp)})
    ax.set(title="Detected gait events (manual validation required)",xlabel="Frame",ylabel=f"Ankle {signal} (normalized)"); ax.grid(); ax.legend(); plot_dir.mkdir(parents=True,exist_ok=True); fig.savefig(plot_dir/(path.stem.replace("_smoothed","")+"_events.png"),dpi=140); plt.close(fig)
    out_dir.mkdir(parents=True,exist_ok=True); pd.DataFrame(events).sort_values(["timestamp","side"]).to_csv(out_dir/(path.stem.replace("_smoothed","")+"_events.csv"),index=False); print("Saved events and plot for",path.name)
def main():
    p=argparse.ArgumentParser(); p.add_argument("--input-dir",default=str(ROOT/"output/landmarks")); p.add_argument("--output-dir",default=str(ROOT/"output/features")); p.add_argument("--plot-dir",default=str(ROOT/"output/plots")); p.add_argument("--fps",type=float); p.add_argument("--distance-seconds",type=float,default=.4); p.add_argument("--prominence",type=float,default=.01); p.add_argument("--signal",choices=["x","y"],default="y"); a=p.parse_args(); ensure_dirs(); files=sorted(Path(a.input_dir).glob("*_smoothed.csv"));
    if not files: print("No smoothed CSVs found. Run 05_smoothing.py first.")
    for f in files: detect(f,Path(a.output_dir),Path(a.plot_dir),a.fps,a.distance_seconds,a.prominence,a.signal)
if __name__=="__main__": main()
