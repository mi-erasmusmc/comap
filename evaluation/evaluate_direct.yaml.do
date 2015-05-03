#!/usr/bin/env python3

import os
import sys
import json
import yaml
from pathlib import Path
import comap

(_, REDO_TARGET, REDO_BASE, REDO_TEMP) = sys.argv
coding_systems_file = 'config/coding_systems.yaml'
results_file = 'results.yaml'
outcomes = [ p.name.split('.')[0] for p in Path('case-definitions').glob('*.yaml') ]
concept_files = ' '.join('{}.concepts.json'.format(outcome) for outcome in outcomes)

os.system('redo-ifchange "{coding_systems_file}" "{results_file}" {concept_files}'\
          .format(**locals()))

database_coding_systems = [
    ('GePaRD', 'ICD10CM'),
    ('Medicare', 'ICD9CM'),
    ('IPCI', 'ICPC')
]

with open(coding_systems_file) as f:
    coding_systems = yaml.load(f)

with open(results_file) as f:
    references = yaml.load(f)

concepts_by_outcome = {}
for outcome in outcomes:
    with open(outcome + '.concepts.json') as f:
        concepts_by_outcome[outcome] = json.load(f)

results = {}
for database, coding_system in database_coding_systems:
    results[database] = {
        'coding_system': coding_system,
        'mappings': {},
    }
    for outcome in outcomes:
        codes = [
            code['id']
            for concept in concepts_by_outcome[outcome]
            for code in concept['sourceConcepts']
            if code['codingSystem'] == coding_system
        ]
        reference = next(r for r in references if r['database'] == database)
        results[database]['mappings'][outcome] = {
            'generated': codes,
            'manufactured': reference['mappings'][outcome].get('inclusion')
        }

with open(REDO_TEMP, 'w') as f:
    yaml.dump(results, f)
