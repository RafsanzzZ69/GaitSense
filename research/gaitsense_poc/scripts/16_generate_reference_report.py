import argparse
from pathlib import Path
import pandas as pd
from common import ROOT, ensure_dirs

def fmt(value, digits=3):
    return 'N/A' if pd.isna(value) else f'{value:.{digits}f}'

def main():
    p=argparse.ArgumentParser(); p.add_argument('--input',default=str(ROOT/'data/reference_gait_parameters.csv')); p.add_argument('--output',default=str(ROOT/'output/reports/reference_gait_parameter_report.md')); a=p.parse_args(); ensure_dirs(); path=Path(a.input)
    if not path.exists(): print('Missing reference_gait_parameters.csv. Run 15_prepare_reference_gait_parameters.py first.'); return 1
    df=pd.read_csv(path); lines=['# GaitSense Reference Gait-Parameter Report','', 'This report compares reference gait parameters with pose-derived estimates. It is a technical PoC comparison, not a clinical validation or medical assessment.', '']
    lines += [f'- Rows: {len(df)}', f'- Participants/trial IDs: {df.ID.nunique()}', '- Reference source: `gait_parameters.csv`', '- Estimate source: `gait_parameters_estimation.csv`', '']
    lines += ['## Walking speed comparison','', '| ID | Pace | Reference (m/s) | Estimated (m/s) | Absolute error (m/s) | Relative error |','|---|---|---:|---:|---:|---:|']
    for _,r in df.iterrows():
        for pace in ('UGS','FGS'):
            lines.append(f"| {r['ID']} | {pace} | {fmt(r.get('Velocity_'+pace+'_reference'))} | {fmt(r.get('Velocity_'+pace+'_estimated'))} | {fmt(r.get('velocity_'+pace.lower()+'_absolute_error_mps'))} | {fmt(r.get('velocity_'+pace.lower()+'_relative_error_percent'),2)}% |")
    lines += ['', '## Parameter comparison','', '| ID | Pace | Step ref/est (cm) | Stride ref/est (cm) | Cadence ref/est (steps/min) |','|---|---|---:|---:|---:|']
    for _,r in df.iterrows():
        for pace in ('UGS','FGS'):
            lines.append(f"| {r['ID']} | {pace} | {fmt(r.get('Step_'+pace+'_reference'))} / {fmt(r.get('Step_'+pace+'_estimated'))} | {fmt(r.get('Stride_'+pace+'_reference'))} / {fmt(r.get('Stride_'+pace+'_estimated'))} | {fmt(r.get('Cadence_'+pace+'_reference'))} / {fmt(r.get('Cadence_'+pace+'_estimated'))} |")
    lines += ['', '## Limitations','', 'The checked-in sample contains one row only, so it cannot support regression, generalization, or statistical validation. The reference and estimated values may not represent identical measurement conventions. Use the full dataset and keep participant IDs grouped when evaluating models.']
    Path(a.output).parent.mkdir(parents=True,exist_ok=True); Path(a.output).write_text('\n'.join(lines)+'\n'); print('Saved:',a.output); return 0
if __name__=='__main__': raise SystemExit(main())
