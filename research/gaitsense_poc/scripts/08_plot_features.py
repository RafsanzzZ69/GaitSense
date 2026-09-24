import argparse
from pathlib import Path
import pandas as pd
import matplotlib.pyplot as plt
from common import ROOT, ensure_dirs

def main():
    p = argparse.ArgumentParser()
    p.add_argument('--features', default=str(ROOT/'data/features.csv'))
    p.add_argument('--output-dir', default=str(ROOT/'output/plots'))
    a = p.parse_args(); ensure_dirs(); path = Path(a.features)
    if not path.exists(): print('No features.csv found. Run 07_feature_extraction.py first.'); return
    df = pd.read_csv(path); out = Path(a.output_dir); out.mkdir(parents=True, exist_ok=True)
    for col in df.select_dtypes('number').columns:
        if col == 'step_count': continue
        fig, ax = plt.subplots(figsize=(8, 4)); df.boxplot(column=col, by='condition', ax=ax)
        ax.set_title(col + ' by condition'); ax.set_xlabel('Condition'); ax.set_ylabel(col); fig.suptitle(''); fig.tight_layout(); fig.savefig(out/(col+'_by_condition.png'), dpi=140); plt.close(fig)
    print('Saved feature plots in', out)
if __name__ == '__main__': main()
