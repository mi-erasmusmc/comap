#!/usr/bin/env python3
from collections import OrderedDict
from pathlib import Path
import pandas as pd
import re
import json
import redo
import comap

codes = {}

freq_names = {
    'ICD10': 'ICD10-AUH',
    'ICPC': 'ICPC-IPCI',
    'RCD2': 'READ-THIN',
}
for db in freq_names:
    filename = "frequencies/{}.csv".format(freq_names[db])
    with redo.ifchange(filename) as file:
        df = pd.read_csv(file)
        codes[db] = sorted(set(df.astype(str).Code))

def format_icd9(code):
    if len(code) > 3:
        return code[:3] + '.' + code[3:]
    else:
        return code

with redo.ifchange("frequencies/ICD9-ARS-ratios.csv") as file:
    df = pd.read_csv(file, sep='\t')
    codes['ICD9'] = sorted({ format_icd9(code) for code in df.PAT })


try:
    with redo.output() as f:
        json.dump(codes, f)
except redo.NoRedoProcess:
    pass
