#!/usr/bin/env python3
from collections import OrderedDict
import pandas as pd
from pathlib import Path
import pickle
import os
import json
import yaml
import redo
import comap
redo.ifchange('variations.py'); import variations

# Init...

project, variation_id = redo.base.split('.')
project_path = Path('projects') / project

with redo.ifchange(evaluation_config=project_path / 'evaluation-config.yaml') \
        as files:
    evaluation_config = yaml.load(files['evaluation_config'])

databases = OrderedDict(evaluation_config['databases'])
outcome_ids = evaluation_config['outcome_ids']

# Load...

## Read the project reference
with redo.ifchange((project_path / 'reference.yaml').as_posix()) as f:
    references = yaml.load(f)

## Read concept files
concept_filenames = {
    outcome_id: '{}.{}.concepts.json'.format(project, outcome_id)
    for outcome_id in outcome_ids
}
with redo.ifchange(concept_filenames) as files:
    concepts_by_outcome = {}
    for outcome_id, f in files.items():
        concepts_by_outcome[outcome_id] = json.load(f)

## Read child concept files
child_concept_filenames = {
    outcome_id: '{}.{}.child-concepts.json'.format(project, outcome_id)
    for outcome_id in outcome_ids
}
with redo.ifchange(child_concept_filenames) as files:
    child_concepts_by_outcome = {}
    for outcome_id, f in files.items():
        child_concepts_by_outcome[outcome_id] = json.load(f).items()

## Read the case definitions
casedef_paths = {
    outcome_id: project_path / 'case-definitions' / (outcome_id + '.yaml')
    for outcome_id in outcome_ids
}
with redo.ifchange(casedef_paths) as files:
    outcomes = {
        outcome_id: yaml.load(f)
        for outcome_id, f in files.items()
    }

with redo.ifchange('codes-in-dbs.json') as f:
    codes_in_dbs = json.load(f)


def create_mappings(references):
    """
    Codes (inclusion + exclusion) for every outcome in every database:

    outcome:
      database: { CODE } | NONE
    """
    mappings = {}
    for outcome_id in outcome_ids:
        mappings[outcome_id] = {}
        for database in databases.keys():
            mapping = references[database]['mappings'][outcome_id]
            if 'inclusion' in mapping:
                codes = set(mapping['inclusion'] + mapping.get('exclusion', []))
            else:
                codes = None
            mappings[outcome_id][database] = codes
    return mappings


def vary_code_concepts_mapping(coding_systems, variation, concepts, mapping):
    # Map codes in generated concepts with variation.vary_code
    def for_source_concept(source_concept):
        coding_system = source_concept['coding_system']
        res = source_concept.copy()
        res['id'] = variation.vary_code(id, coding_system)
        return res
    vary_code_concepts = comap.mega_map(concepts, [None, 'sourceConcepts', [None]], for_source_concept)
    # Map reference codes with variation.vary_code
    vary_code_mapping = {
        database_id: None if mapping.get(database_id) is None else [
            variation.vary_code(code, databases[database_id])
            for code in mapping[database_id]
        ]
        for database_id in databases.keys()
    }
    varied_concepts, varied_reference = \
        variation.vary_concepts_and_mapping(vary_code_concepts, vary_code_mapping, coding_systems, outcome_id)
    return varied_concepts, varied_reference


def varied_cuis(varied_concepts, varied_mapping):
    res = OrderedDict()
    for concept in varied_concepts:
        cui = concept['cui']
        res[cui] = OrderedDict()
        res[cui]['name'] = concept['preferredName']
        res_by_coding_systems = res[cui]['by-coding-system'] = OrderedDict()
        for coding_system in set(databases.values()):
            code_terms = OrderedDict()
            for sourceConcept in concept['sourceConcepts']:
                if sourceConcept['codingSystem'] == coding_system:
                    name = sourceConcept['preferredTerm']
                    tp_not_fp = any(
                        sourceConcept['id'] in varied_mapping[database_id]
                        for database_id, coding_system0 in databases.items()
                        if coding_system0 == coding_system and varied_mapping.get(database_id) is not None
                    )
                    code_terms[sourceConcept['id']] = [name, 'TP' if tp_not_fp else 'FP']
            if code_terms:
                res_by_coding_systems[coding_system] = code_terms
    return res
    
def confusion_and_measures(database_id, coding_system, variation, varied_concepts, varied_mapping):
    generated_codes = [
        variation.vary_code(code['id'], coding_system)
        for concept in varied_concepts
        for code in concept['sourceConcepts']
        if code['codingSystem'] == coding_system
    ]
    reference_codes = varied_mapping[database_id]
    varied_generated_codes, varied_reference_codes = \
        variation.vary_codes(generated_codes, reference_codes, coding_system)
    varied_cm = comap.confusion_matrix(varied_generated_codes, varied_reference_codes)
    measures = comap.measures(codes=varied_cm)
    return OrderedDict([
        ('confusion', varied_cm),
        ('measures', measures),
    ])


def create_result(references, concepts_by_outcome, variation):

    coding_systems = sorted(set(databases.values()))
    mappings = create_mappings(references)

    res_for_variation = OrderedDict([
        ('name', variation.description()),
        ('by-outcome', OrderedDict()),
    ])
    for outcome_id in outcome_ids:
        concepts = concepts_by_outcome[outcome_id]
        mapping = {
            database_id: mappings[outcome_id][database_id]
            for database_id in databases.keys()
        }
        varied_concepts, varied_mapping = vary_code_concepts_mapping(coding_systems, variation, concepts, mapping)

        res_by_outcome = res_for_variation['by-outcome'][outcome_id] = OrderedDict()
        res_by_outcome['generated-cuis'] = sorted(c['cui'] for c in varied_concepts)

        # Save varied CUIs for maximum-recall
        if variation_id == 'maximum-recall':
            res_by_outcome['by-cui'] = varied_cuis(varied_concepts, varied_mapping)

        # Create and save confusions and measures for all databases
        res_comparisons = res_by_outcome['by-database'] = OrderedDict()
        for database_id, coding_system in databases.items():
            if varied_mapping.get(database_id) is None:
                res_comparisons[database_id] = None
            else:
                res_comparisons[database_id] = \
                    confusion_and_measures(database_id, coding_system, variation, varied_concepts, varied_mapping)
    return res_for_variation


def get_variation(name, databases, child_concepts_by_outcome, codes_in_dbs):
    from variations import VariationChain, MaximumRecall, MaximiumPrecision, NormalizeCodeXDD, ExpandConceptsTowardsReference, \
        IncludeRelatedCodes, IncludeChildConcepts, ExpandConceptsTowardsMaxRecallDNF, IncludeRelatedConcepts, FilterGeneratedCodesByDbs, FilterCodesByDbs
    default_variations = VariationChain(variations.default_variations, description='Baseline variations')
    return {
        'baseline': lambda: variations.default_variations,
        'baseline-filter-generated': lambda: VariationChain(
            variations.default_variations,
            FilterGeneratedCodesByDbs(codes_in_dbs)),
        'baseline-filter': lambda: VariationChain(
            variations.default_variations,
            FilterCodesByDbs(codes_in_dbs)),
        
        'maximum-recall': lambda: VariationChain(
            default_variations,
            MaximumRecall(databases)),
        'maximum-recall-filter-generated': lambda: VariationChain(
            default_variations,
            MaximumRecall(databases),
            FilterGeneratedCodesByDbs(codes_in_dbs)),
        'maximum-recall-filter': lambda: VariationChain(
            default_variations,
            MaximumRecall(databases),
            FilterCodesByDbs(codes_in_dbs)),
        
        'maximum-recall-min-2': lambda: VariationChain(
            default_variations,
            MaximumRecall(databases, 2)),
        'maximum-precision': lambda: VariationChain(
            default_variations,
            MaximiumPrecision(databases)),
        'maximum-precision-max-1': lambda: VariationChain(
            default_variations,
            MaximiumPrecision(databases, 1)),
        '3-letter-codes': lambda: VariationChain(
            default_variations,
            NormalizeCodeXDD('ICPC')),

        'expand-to-ref-RN-RB': lambda: VariationChain(
            default_variations,
            ExpandConceptsTowardsReference(databases, 'RN', 'RB')),
        'expand-to-ref-CHD-PAR': lambda: VariationChain(
            default_variations,
            ExpandConceptsTowardsReference(databases, 'CHD', 'PAR')),
        'expand-to-ref-RN-CHD': lambda: VariationChain(
            default_variations,
            ExpandConceptsTowardsReference(databases, 'RN', 'CHD')),
        'expand-to-ref-RB-PAR': lambda: VariationChain(
            default_variations,
            ExpandConceptsTowardsReference(databases, 'RB', 'PAR')),
        'expand-to-ref-RN-CHD-RB-PAR': lambda: VariationChain(
            default_variations,
            ExpandConceptsTowardsReference(databases, 'RN', 'CHD', 'RB', 'PAR')),
        'expand-to-ref-SIB-SY-RQ': lambda: VariationChain(
            default_variations,
            ExpandConceptsTowardsReference(databases, 'SI', 'SY', 'RQ')),
        'expand-to-ref-*': lambda: VariationChain(
            default_variations,
            ExpandConceptsTowardsReference(databases, 'RN', 'CHD', 'RB', 'PAR', 'SIB', 'SY', 'RQ')),

        'expand-1-to-dnf-RN-RB': lambda: VariationChain(
            default_variations,
            ExpandConceptsTowardsMaxRecallDNF(1, databases, 'RN', 'RB')),
        'expand-1-to-dnf-CHD-PAR': lambda: VariationChain(
            default_variations,
            ExpandConceptsTowardsMaxRecallDNF(1, databases, 'CHD', 'PAR')),
        'expand-1-to-dnf-RN-CHD': lambda: VariationChain(
            default_variations,
            ExpandConceptsTowardsMaxRecallDNF(1, databases, 'RN', 'CHD')),
        'expand-1-to-dnf-RB-PAR': lambda: VariationChain(
            default_variations,
            ExpandConceptsTowardsMaxRecallDNF(1, databases, 'RB', 'PAR')),
        'expand-1-to-dnf-RN-CHD-RB-PAR': lambda: VariationChain(
            default_variations,
            ExpandConceptsTowardsMaxRecallDNF(1, databases, 'RN', 'CHD', 'RB', 'PAR')),

        'expand-2-to-dnf-RN-RB': lambda: VariationChain(
            default_variations,
            ExpandConceptsTowardsMaxRecallDNF(2, databases, 'RN', 'RB')),
        'expand-2-to-dnf-CHD-PAR': lambda: VariationChain(
            default_variations,
            ExpandConceptsTowardsMaxRecallDNF(2, databases, 'CHD', 'PAR')),
        'expand-2-to-dnf-RN-CHD': lambda: VariationChain(
            default_variations,
            ExpandConceptsTowardsMaxRecallDNF(2, databases, 'RN', 'CHD')),
        'expand-2-to-dnf-RB-PAR': lambda: VariationChain(
            default_variations,
            ExpandConceptsTowardsMaxRecallDNF(2, databases, 'RB', 'PAR')),
        'expand-2-to-dnf-RN-CHD-RB-PAR': lambda: VariationChain(
            default_variations,
            ExpandConceptsTowardsMaxRecallDNF(2, databases, 'RN', 'CHD', 'RB', 'PAR')),

        'expand-3-to-dnf-RN-CHD-RB-PAR': lambda: VariationChain(
            default_variations,
            ExpandConceptsTowardsMaxRecallDNF(3, databases, 'RN', 'CHD', 'RB', 'PAR')),
        'expand-3-to-dnf-RN-CHD-RB-PAR-filter': lambda: VariationChain(
            default_variations,
            ExpandConceptsTowardsMaxRecallDNF(3, databases, 'RN', 'CHD', 'RB', 'PAR'),
            FilterCodesByDbs(codes_in_dbs)),
        'expand-3-to-dnf-RN-CHD-RB-PAR-filter-generated': lambda: VariationChain(
            default_variations,
            ExpandConceptsTowardsMaxRecallDNF(3, databases, 'RN', 'CHD', 'RB', 'PAR'),
            FilterGeneratedCodesByDbs(codes_in_dbs)),

        'related-FN': lambda: VariationChain(
            default_variations,
            IncludeRelatedCodes('FN')),
        'related-FN-FP': lambda: VariationChain(
            default_variations,
            IncludeRelatedCodes('FN-FP')),
        'related-concepts-RN': lambda: VariationChain(
            default_variations,
            IncludeRelatedConcepts('RN')),
        'related-concepts-RN-RB': lambda: VariationChain(
            default_variations,
            IncludeRelatedConcepts('RN', 'RB')),
        'related-concepts-CHD': lambda: VariationChain(
            default_variations,
            IncludeRelatedConcepts('CHD')),
        'related-concepts-CHD-PAR': lambda: VariationChain(
            default_variations,
            IncludeRelatedConcepts('CHD', 'PAR')),
        'hyponyms': lambda: VariationChain(
            default_variations,
            IncludeChildConcepts(child_concepts_by_outcome)),
        'child-concepts-related-FN-FP': lambda: VariationChain(
            default_variations,
            IncludeChildConcepts(child_concepts_by_outcome),
            IncludeRelatedCodes('FN-FP')),
    }[name]()

if os.getenv('DOCTEST'):
    import doctest
    doctest.testmod(comap, report=True)
    doctest.testmod(report=True)

try:
    variation = get_variation(variation_id, databases, child_concepts_by_outcome, codes_in_dbs)
    assert variation is not None, (variation, variation_id)
except KeyError:
    print("No variation named", variation_id)
    exit(1)

evaluation = create_result(references, concepts_by_outcome, variation)

with redo.output() as f:
    yaml.dump(evaluation, f)
