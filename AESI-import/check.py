import pandas as pd
from glob import glob
import sys

def coding_systems(indir):
    res = set()
    for infile in sorted(glob(f"{indir}/*.csv")):
        if infile == f"{indir}/index.csv":
            continue
        df = pd.read_csv(infile, dtype=str, na_filter=False)
        for sab in df.coding_system:
            if sab:
                res.add(sab)
    return res

if __name__ == "__main__":
    for sab in coding_systems(sys.argv[1]):
        print(f"- {sab}")

