#!/usr/bin/env python3
import pandas as pd
import json

GROUPS_FILE='semantic_groups.csv'
TYPES_FILE='semantic_types.csv'
TYPES_GROUPS_FILE='../webapp/data/semantic_types_groups.json'

groups = pd.read_csv(GROUPS_FILE).set_index('Abbreviation')
types = pd.read_csv(TYPES_FILE)
types['Semantic group'] = groups.ix[types.Group].reset_index()['Semantic group']

li = [
    {
      key.lower().replace(' ', '_'): value
      for key, value in types.ix[ix].to_dict().items()
    }
    for ix in types.index.values
]
json.dump(li, open(TYPES_GROUPS_FILE, 'w'))
print("Wrote", TYPES_GROUPS_FILE)
