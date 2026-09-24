import argparse
from pathlib import Path
import pandas as pd
from common import ROOT, ensure_dirs

def main():
    p = argparse.ArgumentParser(); p.add_argument('--features', default=str(ROOT/'data/features.csv')); p.add_argument('--output', default=str(ROOT/'output/reports/condition_comparison.csv')); a = p.parse_args(); ensure_dirs(); path = Path(a.features)
    if not path.exists(): print('No features.csv found. Run 07_feature_extraction.py first.'); return
    df = pd.read_csv(path); rows = []
    for col in df.select_dtypes('number').columns:
        n = df.loc[df.condition == 'normal', col].dropna(); v = df.loc[df.condition == 'controlled_variation', col].dropna()
        rows.append({'feature': col, 'normal_mean': n.mean(), 'variation_mean': v.mean(), 'normal_median': n.median(), 'variation_median': v.median(), 'normal_std': n.std(), 'variation_std': v.std(), 'participant_count': df.participant.nunique(), 'mean_difference': v.mean()-n.mean()})
    pd.DataFrame(rows).to_csv(a.output, index=False); print('Saved:', a.output)
if __name__ == '__main__': main()
