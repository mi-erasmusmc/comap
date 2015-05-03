#!/usr/bin/env python3

import os
import sys
import json
import yaml
import comap

(_, REDO_TARGET, REDO_BASE, REDO_TEMP) = sys.argv

coding_systems_file = 'config/coding_systems.yaml'
semantic_types_file = 'config/semantic_types.yaml'
comap_config_file = 'config/comap.yaml'
index_file = REDO_BASE + '.index.json'
casedef_file = os.path.join('case-definitions', REDO_BASE + '.yaml')

os.system('redo-ifchange comap.py "{comap_config_file}" "{semantic_types_file}" "{coding_systems_file}" "{index_file}"'\
          .format(**locals()))

casedef = yaml.load(open(casedef_file))['definition'].strip()

coding_systems = yaml.load(open(coding_systems_file))

semantic_types = yaml.load(open(semantic_types_file))

comap_api_url = yaml.load(open(comap_config_file))['api']['url']

with open(index_file) as f:
    index = json.load(f)

client = comap.ComapClient(comap_api_url)

concepts = [
    concept
    for concept in client.umls_concepts(index['cuis'], coding_systems)
    if set(concept['semanticTypes']) & set(semantic_types)
]

with open(REDO_TEMP, 'w') as f:
    json.dump(concepts, f)
