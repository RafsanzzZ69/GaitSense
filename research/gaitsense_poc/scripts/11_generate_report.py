import argparse
import platform
from pathlib import Path
import pandas as pd
from common import ROOT, ensure_dirs

def main():
    p = argparse.ArgumentParser(); p.add_argument('--features', default=str(ROOT/'data/features.csv')); p.add_argument('--output', default=str(ROOT/'output/reports/poc_summary.txt')); a = p.parse_args(); ensure_dirs(); path = Path(a.features)
    lines = ['GaitSense PoC Summary', '====================', 'Research/engineering feasibility PoC; not a medical diagnostic system.', '', f'Python: {platform.python_version()}']
    if path.exists():
        df = pd.read_csv(path); lines += [f'Videos: {len(df)}', f'Participants: {df.participant.nunique()}', f"Conditions: {', '.join(map(str, df.condition.dropna().unique()))}", '', 'Feature missingness:']
        lines += [f'  {c}: {df[c].isna().mean()*100:.1f}%' for c in df.columns]
    else: lines.append('features.csv not found; run the pipeline first.')
    lines += ['', 'Limitations: small self-collected dataset; controlled variation is not clinical abnormal gait; monocular depth ambiguity; pose and event-detection uncertainty; no clinical validation.', '', 'Conclusion: use measured feature changes and participant-grouped metrics to judge feasibility. Do not make disease or medical claims.']
    Path(a.output).write_text('\n'.join(lines)+'\n'); print('Saved:', a.output)
if __name__ == '__main__': main()
