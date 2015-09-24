#!/usr/bin/env python3
import pandas as pd
import json
import redo
import normalize

codes_in_dbs = {}

freq_names = {
    'ICD10': 'ICD10-AUH',
    'ICPC': 'ICPC-IPCI',
    'RCD2': 'READ-THIN',
}
for db in freq_names:
    with redo.ifchange("frequencies/{}.csv".format(freq_names[db])) as f:
        df = pd.read_csv(f)
        normalizer = normalize.get_normalizer(db)
        codes = df.astype(str).Code
        codes_in_dbs[db] = sorted(set(normalizer(codes)))

with redo.ifchange("frequencies/ICD9-ARS-ratios.csv") as f:
    df = pd.read_csv(f, sep='\t')
    codes = df.PAT.tolist()
    normalizer = normalize.get_normalizer('ICD9')
    codes_in_dbs['ICD9'] = sorted(set(normalizer(codes)))

try:
    with redo.output() as f:
        json.dump(codes_in_dbs, f)
except redo.NoRedoProcess:
    pass
