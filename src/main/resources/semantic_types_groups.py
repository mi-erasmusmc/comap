import pandas as pd
import json
df = pd.read_csv('semantic_types_groups.csv')
li = [
    {
      key.lower(): value
      for key, value in df.ix[ix].to_dict().iteritems()
    }
    for ix in df.index.values
]
json.dump(li, open('../webapp/data/semantic_types_groups.json', 'w'))
