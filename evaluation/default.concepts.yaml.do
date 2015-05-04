#!/usr/bin/env python3

import os
import sys
import yaml
import comap
import redo

coding_systems_filename = 'config/coding_systems.yaml'
semantic_types_filename = 'config/semantic_types.yaml'
comap_config_filename = 'config/comap.yaml'
index_filename = redo.base + '.index.yaml'

with redo.ifchange(comap_config_filename, semantic_types_filename, coding_systems_filename, index_filename) \
     as (comap_config_file, semantic_types_file, coding_systems_file, index_file):
    
    coding_systems = yaml.load(coding_systems_file)
    semantic_types = yaml.load(semantic_types_file)
    comap_api_url = yaml.load(comap_config_file)['api']['url']
    index = yaml.load(index_file)

cuis = [s['cui'] for s in index['spans']]

client = comap.ComapClient(comap_api_url)

concepts = [
    concept
    for concept in client.umls_concepts(cuis, coding_systems)
    if set(concept['semanticTypes']) & set(semantic_types)
]

with open(redo.temp, 'w') as f:
    yaml.dump(concepts, f)
