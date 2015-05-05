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

outcome_ids = [
    "ap",
    "scd",
    "pc",
    "is",
    "va",
    "bc",
    "mi",
    "hf",
    "hs"
]

project = redo.base
project_path = Path('projects') / project
concept_filenames = {
    outcome_id: '{}.{}.concepts.yaml'.format(project, outcome_id)
    for outcome_id in outcome_ids
}
casedef_paths = {
    outcome_id: project_path / 'case-definitions' / (outcome_id + '.yaml')
    for outcome_id in outcome_ids
}

with redo.ifchange(coding_systems = 'config/coding_systems.yaml',
                   references = (project_path / 'reference.yaml').as_posix(),
                   concepts = concept_filenames,
                   casedefs = casedef_paths) as files:
    coding_systems = yaml.load(files['coding_systems'])
    references = yaml.load(files['references'])
    concepts_by_outcome = {}
    for outcome_id, f in files['concepts'].items():
        concepts_by_outcome[outcome_id] = yaml.load(f)
    outcomes = {
        outcome_id: yaml.load(f)
        for outcome_id, f in files['casedefs'].items()
    }

def results(normalize_code):
    res = {}
    for outcome in outcomes:
        res[outcome['id']] = {}
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
                generated_codes = set(normalize_code(code) for code in generated_codes)
                reference_codes = set(normalize_code(code) for code in reference_codes)
                true_positives  = set(generated_codes) & set(reference_codes)
                false_positives = set(generated_codes) - set(reference_codes)
                false_negatives = set(reference_codes) - set(generated_codes)

                recall    = len(true_positives) / len(reference_codes) if reference_codes else None
                precision = len(true_positives) / len(generated_codes) if generated_codes else None
                f_score   = 2 * recall * precision / (recall + precision) \
                            if recall != None and precision != None and recall + precision > 0 \
                            else None
                comparison = {
                    'generated': list(generated_codes),
                    'references': list(reference_codes),
                    'true-positives': list(true_positives),
                    'false-positives': list(false_positives),
                    'false-negatives': list(false_negatives),
                    'recall': recall,
                    'precision': precision,
                    'f-score': f_score,
                }
            else:
                comparison = None

            res[outcome['id']][database] = {
                'comment': reference.get('comment'),
                'comparison': comparison,
            }
    return res

def lower_and_no_suffix_dot(code):
    code = code.lower()
    if code[-1] == '.':
        return code[:-1]
    else:
        return code

results = [
    ('plain', results(lambda x: x)),
    ('lower_and_no_suffix_dot', results(lower_and_no_suffix_dot)),
]

index = pd.Index([ outcome['name'] for outcome in outcomes ], name='Outcome')
columns = pd.MultiIndex.from_tuples([
    ('{} ({})'.format(database, coding_system), c)
    for database, coding_system in database_coding_systems[project]
    for c in [ 'TP', 'FP', 'FN', 'recall', 'precision', 'f-score' ]
])

def data(results):
    """ The data of a sheet. """
    p = lambda v: ' '.join(str(v0) for v0 in v) if type(v) == list else v
    return [
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

writer = pd.ExcelWriter(redo.temp)
for sheet_name, sheet_results in results:
    df = pd.DataFrame(data(sheet_results), index=index, columns=columns)
    df.to_excel(writer, sheet_name)
writer.save()

