"""Compute a transparent, non-clinical relative gait-pattern index.

Higher values mean more relative deviation within this dataset. This is not a
validated gait score, diagnosis, risk score, or supervised-learning target.
"""
import argparse
from pathlib import Path
import numpy as np
import pandas as pd
from common import ROOT, ensure_dirs

INDEX_FEATURES = {
    'timing_asymmetry_percent': 'timing_asymmetry_component',
    'knee_range_asymmetry_percent': 'knee_asymmetry_component',
    'arm_swing_asymmetry': 'arm_asymmetry_component',
    'step_time_variability': 'variability_component',
}

def main():
    p = argparse.ArgumentParser()
    p.add_argument('--features', default=str(ROOT/'data/features.csv'))
    p.add_argument('--output', default=str(ROOT/'data/features_with_pattern_index.csv'))
    p.add_argument('--report', default=str(ROOT/'output/reports/pattern_index_method.txt'))
    a = p.parse_args(); ensure_dirs(); source = Path(a.features)
    if not source.exists(): print('No features.csv found. Run 07_feature_extraction.py first.'); return 1
    df = pd.read_csv(source)
    available = [c for c in INDEX_FEATURES if c in df.columns]
    if not available: print('No index features are available.'); return 2
    components = []
    for feature in available:
        values = pd.to_numeric(df[feature], errors='coerce')
        component = values.rank(pct=True, method='average') * 100
        component[values.isna()] = np.nan
        name = INDEX_FEATURES[feature]; df[name] = component; components.append(name)
    df['gait_pattern_index'] = df[components].mean(axis=1, skipna=True)
    df.loc[df[components].notna().sum(axis=1) == 0, 'gait_pattern_index'] = np.nan
    Path(a.output).parent.mkdir(parents=True, exist_ok=True); df.to_csv(a.output, index=False)
    method = [
        'GaitSense relative gait-pattern index',
        '======================================',
        'This is a research-only relative indicator, not a clinical gait score.',
        'Higher values indicate greater relative deviation within these recordings.',
        'It is not a diagnosis, disease prediction, risk score, or medical alert.',
        '', 'Method:',
        'Each available component is converted to its percentile rank across the usable videos.',
        'The final index is the equal-weight mean of available components (0-100 approximately).',
        'Components: ' + ', '.join(available),
        'Missing components are excluded; rows with no components receive NaN.',
        'The index is dataset-relative and should not be compared across datasets without recalibration.',
    ]
    Path(a.report).write_text('\n'.join(method) + '\n'); print('Saved:', a.output); print('Saved:', a.report); print(df[['participant','video','gait_pattern_index']].to_string(index=False)); return 0

if __name__ == '__main__': raise SystemExit(main())
