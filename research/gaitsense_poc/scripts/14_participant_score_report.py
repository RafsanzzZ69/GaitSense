import argparse
from pathlib import Path
import pandas as pd
from common import ROOT, ensure_dirs

def main():
    p=argparse.ArgumentParser(); p.add_argument('--features',default=str(ROOT/'data/features_with_pattern_index.csv')); p.add_argument('--speeds',default=str(ROOT/'data/speed_measurements.csv')); p.add_argument('--quality',default=str(ROOT/'output/reports/quality_summary.csv')); p.add_argument('--output-dir',default=str(ROOT/'output/reports')); a=p.parse_args(); ensure_dirs(); out=Path(a.output_dir); fp=Path(a.features)
    if not fp.exists(): print('Missing features_with_pattern_index.csv. Run 13_compute_pattern_index.py first.'); return 1
    df=pd.read_csv(fp); keep=['participant','video','gait_pattern_index','usable_frame_percent','cadence','step_symmetry_ratio','timing_asymmetry_percent','knee_range_asymmetry_percent']; report=df[[c for c in keep if c in df.columns]].copy()
    speed_path=Path(a.speeds)
    if speed_path.exists():
        speeds=pd.read_csv(speed_path); cols=[c for c in ['video','walking_time_seconds','walking_speed_mps','measurement_method'] if c in speeds.columns]; report=report.merge(speeds[cols],on='video',how='left')
    quality_path=Path(a.quality)
    if quality_path.exists():
        quality=pd.read_csv(quality_path); cols=[c for c in ['video','quality_percent','status'] if c in quality.columns]; report=report.drop(columns=['quality_percent','status'],errors='ignore').merge(quality[cols],on='video',how='left')
    report.to_csv(out/'participant_scores.csv',index=False)
    lines=['GaitSense Participant Score Report','===================================','PoC-only report: gait_pattern_index is a relative research indicator, not a clinical score. Walking speeds are visual-boundary estimates unless independently timed.', '']
    for participant, group in report.groupby('participant',dropna=False):
        lines += [f'Participant: {participant}', '-'*24]
        for _, row in group.iterrows():
            index='N/A' if pd.isna(row.get('gait_pattern_index')) else f"{row['gait_pattern_index']:.2f}"
            speed='N/A' if pd.isna(row.get('walking_speed_mps')) else f"{row['walking_speed_mps']:.3f} m/s"
            quality='N/A' if pd.isna(row.get('quality_percent')) else f"{row['quality_percent']:.1f}% ({row.get('status','')})"
            lines.append(f"{row['video']}: pattern index={index}; walking speed={speed}; pose quality={quality}")
        lines.append(f"Participant mean pattern index: {group['gait_pattern_index'].mean():.2f}")
        if 'walking_speed_mps' in group: lines.append(f"Participant mean estimated speed: {group['walking_speed_mps'].mean():.3f} m/s")
        lines.append('')
    lines += ['Interpretation:', 'Higher pattern-index values indicate greater relative deviation within this dataset only.', 'Do not use these values for diagnosis, disease prediction, or clinical decisions.', 'Poor-quality videos are excluded from the feature/index dataset.']
    (out/'participant_scores.md').write_text('\n'.join(lines)+'\n'); print('Saved:',out/'participant_scores.csv'); print('Saved:',out/'participant_scores.md'); return 0
if __name__=='__main__': raise SystemExit(main())
