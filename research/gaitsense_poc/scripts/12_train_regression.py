"""Participant-grouped walking-speed regression baselines.

Requires independently measured walking_speed_mps labels. It refuses missing,
constant, or insufficient labels and excludes derived index columns.
"""
import argparse, json
from pathlib import Path
import numpy as np, pandas as pd, joblib
from sklearn.ensemble import RandomForestRegressor
from sklearn.linear_model import LinearRegression
from sklearn.metrics import mean_absolute_error, mean_squared_error, r2_score
from sklearn.model_selection import GroupShuffleSplit
from sklearn.neural_network import MLPRegressor
from sklearn.pipeline import make_pipeline
from sklearn.impute import SimpleImputer
from sklearn.preprocessing import StandardScaler
from common import ROOT, ensure_dirs

FEATURES=['cadence','step_symmetry_ratio','step_time_variability','left_knee_range','right_knee_range','knee_range_asymmetry_percent','left_arm_swing_proxy','right_arm_swing_proxy','arm_swing_asymmetry','hip_center_lateral_sway_proxy']

def main():
    p=argparse.ArgumentParser(); p.add_argument('--features',default=str(ROOT/'data/features.csv')); p.add_argument('--target',default='walking_speed_mps'); p.add_argument('--targets',default=str(ROOT/'data/speed_targets.csv')); p.add_argument('--measurements',default=str(ROOT/'data/speed_measurements.csv')); p.add_argument('--output-dir',default=str(ROOT/'output/reports')); a=p.parse_args(); ensure_dirs(); fp,tp=Path(a.features),Path(a.targets)
    if not tp.exists(): print(f'Missing target file: {tp}. Run scripts/measure_walking_speed.py first.'); return 2
    if not fp.exists(): print(f'Missing features file: {fp}. Run 07_feature_extraction.py first.'); return 2
    df=pd.read_csv(fp); targets=pd.read_csv(tp)
    if 'video' not in targets.columns or a.target not in targets.columns: print(f'{tp} must contain video,{a.target}.'); return 2
    targets[a.target]=pd.to_numeric(targets[a.target],errors='coerce')
    if targets[a.target].notna().sum()==0: print(f'No measured {a.target} labels found. Use scripts/measure_walking_speed.py.'); return 2
    merged=df.drop(columns=[a.target],errors='ignore').merge(targets[['video',a.target]],on='video',how='left'); missing=merged.loc[merged[a.target].isna(),'video'].astype(str).tolist()
    if missing: print('Missing walking-speed labels for: '+', '.join(missing)); print('Training stopped: measure every feature video before training.'); return 2
    y=pd.to_numeric(merged[a.target],errors='coerce')
    if y.isna().any() or (y<=0).any(): print('Walking-speed labels must be numeric and greater than zero.'); return 2
    if y.nunique()==1: print('Training stopped: all walking-speed targets are identical.'); print('Measure actual walking time for each video using scripts/measure_walking_speed.py.'); return 2
    cols=[c for c in FEATURES if c in merged.columns and merged[c].notna().mean()>=.5]; excluded=[c for c in merged.columns if 'gait_pattern_index' in c or c.endswith('_component')]; cols=[c for c in cols if c not in excluded]; data=merged.dropna(subset=[a.target,'participant']).copy(); data[a.target]=y.loc[data.index]; imputed=data[cols].isna().sum().to_dict()
    if len(data)<4 or data.participant.nunique()<3: print(f'Insufficient data: {len(data)} labeled usable videos from {data.participant.nunique()} participants; need at least 4 videos from 3 participants.'); return 3
    label_warning=False; mp=Path(a.measurements)
    if mp.exists():
        methods=pd.read_csv(mp).get('measurement_method',pd.Series(dtype=str)).dropna().astype(str).unique().tolist(); label_warning=any('estimate' in method.lower() for method in methods)
        if label_warning: print('WARNING: labels include visual boundary estimates, not independently timed ground truth.')
    if len(data)<12: print('WARNING: prototype result only; fewer than 12 labeled videos gives highly uncertain evaluation.')
    train,test=next(GroupShuffleSplit(n_splits=1,test_size=.25,random_state=42).split(data[cols],data[a.target],data.participant)); models={'random_forest':make_pipeline(SimpleImputer(strategy='median'),RandomForestRegressor(n_estimators=300,random_state=42,min_samples_leaf=2)),'linear_baseline':make_pipeline(SimpleImputer(strategy='median'),StandardScaler(),LinearRegression()),'neural_network':make_pipeline(SimpleImputer(strategy='median'),StandardScaler(),MLPRegressor(hidden_layer_sizes=(32,16),early_stopping=False,max_iter=2000,random_state=42))}; report={'target':a.target,'features':cols,'excluded_leakage_columns':excluded,'imputed_feature_values':{k:int(v) for k,v in imputed.items() if v},'train_participants':data.iloc[train].participant.unique().tolist(),'test_participants':data.iloc[test].participant.unique().tolist(),'prototype_warning':len(data)<12,'label_warning':label_warning,'models':{}}
    for name,model in models.items():
        model.fit(data.iloc[train][cols],data.iloc[train][a.target]); pred=model.predict(data.iloc[test][cols]); actual=data.iloc[test][a.target]; report['models'][name]={'mae_mps':mean_absolute_error(actual,pred),'rmse_mps':float(np.sqrt(mean_squared_error(actual,pred))),'r2':r2_score(actual,pred) if len(actual)>1 else np.nan}; joblib.dump({'model':model,'features':cols,'target':a.target,'metrics':report['models'][name]},Path(a.output_dir)/(name+'_walking_speed_model.pkl'))
    out=Path(a.output_dir)/'walking_speed_regression_report.json'; out.write_text(json.dumps(report,indent=2,default=str)); print(json.dumps(report,indent=2)); print('Saved:',out); return 0
if __name__=='__main__': raise SystemExit(main())
