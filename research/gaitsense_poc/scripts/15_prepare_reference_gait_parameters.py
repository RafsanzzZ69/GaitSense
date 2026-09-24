"""Prepare Kuopio/Health&Gait parameter samples for reference comparison.

gait_parameters.csv is treated as the reference table and
gait_parameters_estimation.csv as the pose-derived estimate table. This does
not train a model: the checked-in sample contains only one participant row.
"""
import argparse
from pathlib import Path
import numpy as np
import pandas as pd
from common import ROOT, ensure_dirs

def main():
    p=argparse.ArgumentParser(); p.add_argument('--reference',default=str(ROOT/'dataset_samples/gait_parameters.csv')); p.add_argument('--estimated',default=str(ROOT/'dataset_samples/gait_parameters_estimation.csv')); p.add_argument('--output',default=str(ROOT/'data/reference_gait_parameters.csv')); a=p.parse_args(); ensure_dirs(); ref_path,est_path=Path(a.reference),Path(a.estimated)
    if not ref_path.exists() or not est_path.exists(): print('Both gait parameter CSV files are required.'); return 1
    ref=pd.read_csv(ref_path); est=pd.read_csv(est_path)
    if 'ID' not in ref or 'ID' not in est: print('Both files must contain an ID column.'); return 2
    merged=ref.merge(est,on='ID',how='inner',suffixes=('_reference','_estimated'))
    for pace in ('UGS','FGS'):
        r='Velocity_'+pace+'_reference'; e='Velocity_'+pace+'_estimated'
        if r in merged and e in merged:
            merged['velocity_'+pace.lower()+'_absolute_error_mps']=(merged[e]-merged[r]).abs()
            merged['velocity_'+pace.lower()+'_relative_error_percent']=merged['velocity_'+pace.lower()+'_absolute_error_mps']/merged[r].abs()*100
    Path(a.output).parent.mkdir(parents=True,exist_ok=True); merged.to_csv(a.output,index=False); print('Saved:',a.output); print(merged.to_string(index=False))
    if len(merged)<5: print('WARNING: sample has fewer than 5 rows; it is suitable only for schema/label inspection, not ML training or evaluation.')
    return 0
if __name__=='__main__': raise SystemExit(main())
