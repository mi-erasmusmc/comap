#!/usr/bin/env python3

import os
import sys
import yaml
import comap
import redo

with redo.ifchange(comap_config = 'config/comap.yaml',
                   semantic_types = 'config/semantic_types.yaml',
                   coding_systems = 'config/coding_systems.yaml',
                   index = redo.base + '.index.yaml') as files:
    coding_systems = yaml.load(files['coding_systems'])
    semantic_types = yaml.load(files['semantic_types'])
    comap_api_url = yaml.load(files['comap_config'])['api']['url']
    index = yaml.load(files['index'])

cuis = [s['cui'] for s in index['spans']]

client = comap.ComapClient(comap_api_url)

concepts = [
    concept
    for concept in client.umls_concepts(cuis, coding_systems)
    if set(concept['semanticTypes']) & set(semantic_types)
]

with redo.output() as f:
    yaml.dump(concepts, f)
