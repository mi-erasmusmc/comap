#!/usr/bin/env python3
from collections import OrderedDict
import json
import yaml
from pathlib import Path
import redo
redo.ifchange('comap.py'); import comap

project = redo.base
project_path = Path('projects') / project

with redo.ifchange(evaluation_config=project_path / 'evaluation-config.yaml') \
        as files:
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

            measures = comap.measures(generated=generated_codes,
                                      reference=reference_codes,
                                      f=lambda f: round(f, 2))

            return OrderedDict([
                ('codes', OrderedDict([
                    ('TP', sorted(true_positives)),
                    ('FP', sorted(false_positives)),
                    ('FN', sorted(false_negatives)),
                ])),
                ('measures', measures),
            ])

    return OrderedDict([
        (outcome_id, OrderedDict([
            (database, compare(generated, reference))
            for database, coding_system in databases
            for generated in [generated_codes(outcomes[outcome_id], coding_system)]
            for reference in [reference_codes(database, outcomes[outcome_id])]
        ]))
        for outcome_id in outcome_ids
    ])


def upper_and_ignore_suffix_dot(code):
    code = code.upper()
    if code[-1] == '.':
        return code[:-1]
    else:
        return code


evaluations = [
    ('baseline', create_results(lambda x: x)),
    ('normalize',
     create_results(normalize_code=upper_and_ignore_suffix_dot)),
    ('normalize_and_children',
     create_results(normalize_code=upper_and_ignore_suffix_dot,
                    with_children=True)),
]

# Output results as YAML

with redo.output() as f:
    yaml.dump(OrderedDict(evaluations), f)
