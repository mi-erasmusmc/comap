#!/usr/bin/env python3
from collections import OrderedDict
import json
import yaml
from pathlib import Path
import pandas as pd
import redo

project = redo.base
project_path = Path('projects') / project

with redo.ifchange(evaluation_config=project_path / 'evaluation.yaml') as files:
    evaluation_config = yaml.load(files['evaluation_config'])

databases = evaluation_config['databases']
outcome_ids = evaluation_config['outcome_ids']

concept_filenames = {
    outcome_id: '{}.{}.concepts.json'.format(project, outcome_id)
    for outcome_id in outcome_ids
}
child_concept_filenames = {
    outcome_id: '{}.{}.child-concepts.json'.format(project, outcome_id)
    for outcome_id in outcome_ids
}
casedef_paths = {
    outcome_id: project_path / 'case-definitions' / (outcome_id + '.yaml')
    for outcome_id in outcome_ids
}

with redo.ifchange(coding_systems='config/coding_systems.yaml',
                   references=(project_path / 'reference.yaml').as_posix(),
                   concepts=concept_filenames,
                   child_concepts=child_concept_filenames,
                   casedefs=casedef_paths) as files:
    coding_systems = yaml.load(files['coding_systems'])
    references = yaml.load(files['references'])
    concepts_by_outcome = {}
    for outcome_id, f in files['concepts'].items():
        concepts_by_outcome[outcome_id] = json.load(f)
    child_concepts_by_outcome = {}
    for outcome_id, f in files['child_concepts'].items():
        child_concepts_by_outcome[outcome_id] = json.load(f).items()
    outcomes = {
        outcome_id: yaml.load(f)
        for outcome_id, f in files['casedefs'].items()
    }


def create_results(normalize_code=lambda c: c, with_children=False):

    def reference_codes(database, outcome):
        reference_mapping = references[database]['mappings'].get(outcome['id'])
        if reference_mapping is not None:
            return reference_mapping['inclusion'] + \
                reference_mapping.get('exclusion', [])

    def generated_codes(outcome, coding_system):
        concepts = concepts_by_outcome[outcome['id']]
        if with_children:
            child_concepts_by_parent = child_concepts_by_outcome[outcome['id']]
            child_concepts = [
                child_concept
                for parent_id, concepts_for_parent in child_concepts_by_parent
                if parent_id in [c['cui'] for c in concepts]
                for child_concept in concepts_for_parent
            ]
            concepts = concepts + child_concepts
        return [
            code['id']
            for concept in concepts
            for code in concept['sourceConcepts']
            if code['codingSystem'] == coding_system
        ]

    def compare(generated_codes, reference_codes):

        if reference_codes is not None:

            generated_codes = set(normalize_code(code)
                                  for code in generated_codes)
            reference_codes = set(normalize_code(code)
                                  for code in reference_codes)

            true_positives = generated_codes & reference_codes
            false_positives = generated_codes - reference_codes
            false_negatives = reference_codes - generated_codes

            recall = len(true_positives) / len(reference_codes) \
                if reference_codes else None
            precision = len(true_positives) / len(generated_codes) \
                if generated_codes else None
            # f_score = 2 * recall * precision / (recall + precision) \
            #     if recall is not None and precision is not None and recall + precision > 0 \
            #     else None

            return {
                'codes': OrderedDict([
                    ('TP', list(true_positives)),
                    ('FP', list(false_positives)),
                    ('FN', list(false_negatives)),
                ]),
                'measures': OrderedDict([
                    ('recall', round(recall, 2)),
                    ('precision', round(precision, 2)
                     if precision is not None else None),
                ]),
            }

    return {
        outcome_id: {
            database: {
                'comparison': compare(generated, reference),
            }
            for database, coding_system in databases
            for generated in [generated_codes(outcome, coding_system)]
            for reference in [reference_codes(database, outcome)]
        }
        for outcome_id, outcome in outcomes.items()
    }


def upper_and_ignore_suffix_dot(code):
    code = code.upper()
    if code[-1] == '.':
        return code[:-1]
    else:
        return code


varied_results = [
    ('Baseline', create_results(lambda x: x)),
    ('Normalize',
     create_results(normalize_code=upper_and_ignore_suffix_dot)),
    ('Normalize and children',
     create_results(normalize_code=upper_and_ignore_suffix_dot,
                    with_children=True)),
]


# Output results as YAML
def represent_OrderedDict(dumper, data):
    return dumper.represent_dict(list(data.items()))
yaml.add_representer(OrderedDict, represent_OrderedDict, yaml.SafeDumper)
with open(redo.target.replace('.xls', '.yaml'), 'w') as f:
    yaml.dump(dict(varied_results), f, Dumper=yaml.SafeDumper)

# Output Excel via Pandas

columns_per_database = ['TP', 'FP', 'FN', 'recall', 'precision']
columns = pd.MultiIndex.from_tuples([
    ('{} ({})'.format(database, coding_system), c)
    for database, coding_system in databases
    for c in columns_per_database
])

index, rows = [], []
for ix, (heading, results) in enumerate(varied_results):
    str_of_list = lambda v: ' '.join(str(v0) for v0 in v)
    if ix:
        index.extend(['', ''])
        rows.extend([[None] * len(columns)] * 2)
    index.append(heading)
    rows.append([None] * len(columns))
    for outcome_id in outcome_ids:
        row = []
        for database, _ in databases:
            result = results[outcome_id][database]
            comparison = result.get('comparison')
            if comparison is None:
                row.extend([None] * len(columns_per_database))
            else:
                row.extend([
                    str_of_list(comparison['codes']['TP']),
                    str_of_list(comparison['codes']['FP']),
                    str_of_list(comparison['codes']['FN']),
                    comparison['measures']['recall'],
                    comparison['measures']['precision'],
                ])
        index.append(outcomes[outcome_id]['name'])
        rows.append(row)

writer = pd.ExcelWriter(redo.temp)
df = pd.DataFrame(rows, index=pd.Index(index), columns=columns)
df.to_excel(writer, float_format='%.2f')
writer.save()
