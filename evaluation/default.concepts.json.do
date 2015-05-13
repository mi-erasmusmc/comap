#!/usr/bin/env python3

import json
import yaml
import comap
import redo

with redo.ifchange(semantic_types='config/semantic_types.yaml',
                   coding_systems='config/coding_systems.yaml',
                   index=redo.base + '.index.json') as files:
    coding_systems = yaml.load(files['coding_systems'])
    semantic_types = yaml.load(files['semantic_types'])
    index = json.load(files['index'])

cuis = [s['cui'] for s in index['spans']]

client = comap.ComapClient()

concepts = [
    concept
    for concept in client.umls_concepts(cuis, coding_systems)
    if set(concept['semanticTypes']) & set(semantic_types)
]

with redo.output() as f:
    json.dump(concepts, f)
