import pandas as pd
import json

df = pd.read_csv('semantic_types_groups.csv', index_col=0)

d = {
    t: {
      'description': df.ix[t].Description,
      'group': df.ix[t].Group 
    }
  for t in df.index.values
}

json.dump(d, open('semantic_types_groups.json', 'w'))
