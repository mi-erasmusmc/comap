#!/usr/bin/env python3

import yaml
from pathlib import Path
import pandas as pd
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

with redo.ifchange(coding_systems='config/coding_systems.yaml',
                   references=(project_path / 'reference.yaml').as_posix(),
                   concepts=concept_filenames,
                   casedefs=casedef_paths) as files:
    coding_systems = yaml.load(files['coding_systems'])
    references = yaml.load(files['references'])
    concepts_by_outcome = {}
    for outcome_id, f in files['concepts'].items():
        concepts_by_outcome[outcome_id] = yaml.load(f)
    outcomes = {
        outcome_id: yaml.load(f)
        for outcome_id, f in files['casedefs'].items()
    }


def compare_codes(generated_codes, reference_codes):

    true_positives = set(generated_codes) & set(reference_codes)
    false_positives = set(generated_codes) - set(reference_codes)
    false_negatives = set(reference_codes) - set(generated_codes)

    recall = len(true_positives) / len(reference_codes) \
        if reference_codes else None
    precision = len(true_positives) / len(generated_codes) \
        if generated_codes else None
    f_score = 2 * recall * precision / (recall + precision) \
        if recall is not None and precision is not None and recall + precision > 0 \
        else None
    return {
        'generated': list(generated_codes),
        'references': list(reference_codes),
        'true-positives': list(true_positives),
        'false-positives': list(false_positives),
        'false-negatives': list(false_negatives),
        'recall': recall,
        'precision': precision,
        'f-score': f_score,
    }


def create_results(normalize_code=lambda code: code):

    def compare(reference, outcome, coding_system):
        reference_mapping = reference['mappings'].get(outcome['id'])
        if reference_mapping is not None:
            generated_codes = [
                normalize_code(code['id'])
                for concept in concepts_by_outcome[outcome['id']]
                for code in concept['sourceConcepts']
                if code['codingSystem'] == coding_system
            ]
            reference_codes = set(normalize_code(code)
                                  for code in reference_mapping['inclusion'] +
                                  reference_mapping.get('exclusion', []))
            return compare_codes(generated_codes, reference_codes)
        else:
            return None

    return {
        outcome_id: {
            database: {
                'comment': references.get('comment'),
                'comparison': comparison,
            }
            for database, coding_system in database_coding_systems[project]
            for reference in [references[database]]
            for comparison in [compare(reference, outcome, coding_system)]
        }
        for outcome_id, outcome in outcomes.items()
    }


def upper_and_ignore_suffix_dot(code):
    code = code.upper()
    if code[-1] == '.':
        return code[:-1]
    else:
        return code

results = [
    ('plain', create_results(lambda x: x)),
    ('upper_and_ignore_suffix_dot',
     create_results(upper_and_ignore_suffix_dot)),
]

with open(redo.target.replace('.xls', '.plain.yaml'), 'w') as f:
    yaml.dump(results[0][1], f)


# Output Excel via Pandas

index = pd.Index([
    outcomes[outcome_id]['name']
    for outcome_id in outcome_ids
], name='Outcome')

columns = pd.MultiIndex.from_tuples([
    ('{} ({})'.format(database, coding_system), c)
    for database, coding_system in database_coding_systems[project]
    for c in ['TP', 'FP', 'FN', 'recall', 'precision']
])


def data(results):
    """A row for each outcome with columns for values and measuges for
    each database."""
    def str_of_list(v):
        return ' '.join(str(v0) for v0 in v)
    return [
        [value
         for database, _ in database_coding_systems[project]
         for result in [results[outcome_id][database]]
         for comparison in [result.get('comparison')]
         for value in ([str_of_list(comparison['true-positives']),
                        str_of_list(comparison['false-positives']),
                        str_of_list(comparison['false-negatives']),
                        comparison.get('recall'),
                        comparison.get('precision')]
                       if comparison is not None else [None]*5)]
        for outcome_id in outcome_ids
    ]

writer = pd.ExcelWriter(redo.temp)
for sheet_name, sheet_results in results:
    df = pd.DataFrame(data(sheet_results), index=index, columns=columns)
    df.to_excel(writer, sheet_name, float_format='%.2f')
writer.save()