#!/usr/bin/env python3

import os
import sys
import yaml
from pathlib import Path
import pandas as pd
import numpy as np
import comap
import redo

database_coding_systems = {
    'safeguard': [
        ('Medicare', 'ICD9CM'),
        ('GePaRD', 'ICD10CM'),
        ('IPCI', 'ICPC')
    ]
}

coding_systems_filename = 'config/coding_systems.yaml'
project = redo.base
casedefs_path = Path('case-definitions') / project
outcome_ids = [ p.name.split('.')[0] for p in casedefs_path.glob('*.yaml') ]
references_path = Path('reference') / (project + '.yaml')
concept_filenames = ['{}.{}.concepts.yaml'.format(project, outcome) for outcome in outcome_ids]

with redo.ifchange(coding_systems_filename, references_path.as_posix(), concept_filenames) as \
     (coding_system_file, references_file, concept_files):
    coding_systems = yaml.load(coding_system_file)
    references = yaml.load(references_file)
    concepts_by_outcome = {}
    for outcome_id, concept_file in zip(outcome_ids, concept_files):
        concepts_by_outcome[outcome_id] = yaml.load(concept_file)

outcomes = []
for outcome_id in outcome_ids:
    path = casedefs_path / (outcome_id + '.yaml')
    with open(path.as_posix()) as f:
        outcomes.append(yaml.load(f))

results = {}
for outcome in outcomes:
    results[outcome['id']] = {}
    for database, coding_system in database_coding_systems[project]:
        reference = next(r for r in references if r['database'] == database)['mappings'][outcome['id']]
        reference_codes = reference.get('inclusion')
        generated_codes = [
            code['id']
            for concept in concepts_by_outcome[outcome['id']]
            for code in concept['sourceConcepts']
            if code['codingSystem'] == coding_system
        ]
        if reference_codes != None:

            true_positives  = set(generated_codes) & set(reference_codes)
            false_positives = set(generated_codes) - set(reference_codes)
            false_negatives = set(reference_codes) - set(generated_codes)

            recall    = len(true_positives) / len(reference_codes) if reference_codes else None
            precision = len(true_positives) / len(generated_codes) if generated_codes else None
            f_score   = 2 * recall * precision / (recall + precision) \
                        if recall != None and precision != None and recall + precision > 0 \
                        else None
            comparison = {
                'generated': generated_codes,
                'references': reference_codes,
                'true-positives': list(true_positives),
                'false-positives': list(false_positives),
                'false-negatives': list(false_negatives),
                'recall': recall,
                'precision': precision,
                'f-score': f_score,
            }
        else:
            comparison = None
            
        results[outcome['id']][database] = {
            'generated': generated_codes,
            'reference': reference.get('comment') or reference_codes,
            'comparison': comparison,
        }

with open(redo.temp, 'w') as f:
    index = [ outcome['name'] for outcome in outcomes ]
    columns = pd.MultiIndex.from_tuples([
        (database, c)
        for database, _ in database_coding_systems[project]
        for c in [ 'TP', 'FP', 'FN', 'recall', 'precision', 'f-score' ]
    ])
    p = lambda v: ', '.join(v) if type(v) == list else v
    data = [
        [ value
          for database, result in results[outcome['id']].items()
          for comparison in [ result.get('comparison', {}) ]
          for value in ([ p(comparison['true-positives']),
                          p(comparison['false-positives']),
                          p(comparison['false-negatives']),                         
                          comparison.get('recall'),
                          comparison.get('precision'),
                          comparison.get('f-score') ] if comparison != None else [None]*6) ]
        for outcome in outcomes
    ]
    pd.DataFrame(data, index=index, columns=columns).to_csv(f)    


