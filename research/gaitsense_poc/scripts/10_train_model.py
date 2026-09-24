import argparse
from pathlib import Path
import pandas as pd
import joblib
from sklearn.ensemble import RandomForestClassifier
from sklearn.model_selection import GroupShuffleSplit
from sklearn.metrics import accuracy_score, precision_score, recall_score, f1_score, confusion_matrix
from common import ROOT, ensure_dirs

FEATURES = ['cadence','step_symmetry_ratio','step_time_variability','left_knee_range','right_knee_range','knee_range_asymmetry_percent','left_arm_swing_proxy','right_arm_swing_proxy','arm_swing_asymmetry','hip_center_lateral_sway_proxy']

def main():
    p = argparse.ArgumentParser(); p.add_argument('--features', default=str(ROOT/'data/features.csv')); p.add_argument('--model-output', default=str(ROOT/'models/gait_model.pkl')); a = p.parse_args(); ensure_dirs(); path = Path(a.features)
    if not path.exists(): print('No features.csv found. Run 07_feature_extraction.py first.'); return
    df = pd.read_csv(path); cols = [c for c in FEATURES if c in df and df[c].notna().mean() >= .5]; df = df.dropna(subset=cols+['participant','condition']); df['label'] = (df.condition == 'controlled_variation').astype(int)
    if len(df) < 4 or df.participant.nunique() < 2 or df.label.nunique() < 2: print('Insufficient data: need both conditions and at least two participants; no model trained.'); return
    train, test = next(GroupShuffleSplit(n_splits=1, test_size=.2, random_state=42).split(df[cols], df.label, df.participant))
    model = RandomForestClassifier(n_estimators=200, random_state=42, class_weight='balanced'); model.fit(df.iloc[train][cols], df.iloc[train].label); pred = model.predict(df.iloc[test][cols]); y = df.iloc[test].label
    metrics = {'model':'RandomForestClassifier','features':cols,'train_participants':df.iloc[train].participant.unique().tolist(),'test_participants':df.iloc[test].participant.unique().tolist(),'accuracy':accuracy_score(y,pred),'precision':precision_score(y,pred,zero_division=0),'recall':recall_score(y,pred,zero_division=0),'f1':f1_score(y,pred,zero_division=0),'confusion_matrix':confusion_matrix(y,pred).tolist()}
    print(metrics); joblib.dump({'model':model,'features':cols,'metrics':metrics}, a.model_output); print('Saved:', a.model_output)
if __name__ == '__main__': main()
