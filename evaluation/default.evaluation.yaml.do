#!/usr/bin/env python3
from collections import OrderedDict, defaultdict
from pathlib import Path
import os
import json
import yaml
import re
import redo
redo.ifchange('comap.py'); import comap

project, variation_id = redo.base.split('.')
project_path = Path('projects') / project

with redo.ifchange(evaluation_config=project_path / 'evaluation-config.yaml') \
        as files:
    evaluation_config = yaml.load(files['evaluation_config'])

databases = OrderedDict(evaluation_config['databases'])
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
    coding_systems = yaml.load(files['coding_systems']) # FIXME Used?
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


class Variation(object):

    """Identity"""

    def __init__(self):
        self.outcome_id = None
        self.coding_system = None

    def description(self):
        return self.__doc__

    def vary_code(self, code, coding_system):
        """Called on each code of generated concepts and the reference before
        before vary_codes and vary_concepts_and_mapping"""
        return code

    def vary_concepts_and_mapping(self, concepts, mapping, coding_systems, outcome_id):
        """Called for each outcome_id and database before vary_codes. For
        concept-level variations."""
        return concepts, mapping

    def vary_codes(self, generated, reference, coding_systems):
        """Code-level variations."""
        return generated, reference


class ExpandConceptsTowardsReference(Variation):

    """Expand concepts towards reference"""

    def __init__(self, *relations):
        self.relations = list(relations)
        self.client = comap.ComapClient()

    def description(self):
        return super().description() + " ({})".format(', '.join(self.relations))

    def vary_concepts_and_mapping(self, concepts, mapping, coding_systems, outcome_id):

        generated_cuis = set(c['cui'] for c in concepts)
        reference_cuis = comap.mapping_to_max_recall_cuis(databases, mapping)

        all_cuis = generated_cuis | reference_cuis
        related_concepts = self.client.related(all_cuis, self.relations, [])

        relation_data = related_concepts
        for path, f in [([None, None, None], lambda c: c['cui']),
                        ([None, None], set),
                        ([None], lambda d: defaultdict(set, d)),
                        ([], lambda d: defaultdict(lambda: defaultdict(set), d))]:
            relation_data = comap.mega_map(relation_data, path, f)

        hierarchy = comap.DataHierarchy(self.relations, relation_data)
        related_cuis_by_rel = hierarchy.related(reference_cuis, generated_cuis)
        related_cuis = set(cui for _, cuis in related_cuis_by_rel.items() for cui in cuis)

        varied_cuis = generated_cuis | related_cuis
        varied_concepts = self.client.umls_concepts(varied_cuis, coding_systems)

        return varied_concepts, mapping


class MaximumRecall(Variation):

    """Maximize recall"""

    def __init__(self, min_codes=None):
        self.client = comap.ComapClient()
        self.min_codes = min_codes

    def description(self):
        return super().description() + ("" if self.min_codes is None else
                                        " (min {})".format(self.min_codes))

    def vary_concepts_and_mapping(self, concepts, mapping, coding_systems, outcome_id):
        "Return concepts that contain all codes in `mapping`."
        cuis = comap.mapping_to_max_recall_cuis(databases, mapping, self.min_codes)
        concepts = self.client.umls_concepts(cuis, coding_systems)
        return concepts, mapping


class MaximiumPrecision(Variation):

    """Maximize precision"""

    def __init__(self, max_codes=None):
        self.client = comap.ComapClient()
        self.max_codes = max_codes

    def description(self):
        return super().description() + ("" if self.max_codes is None else
                                        " (max {})".format(self.max_codes))

    def vary_concepts_and_mapping(self, concepts, mapping, coding_systems, outcome_id):
        "Return concepts such that code is not in `mapping`."
        cuis = comap.mapping_to_max_precision_cuis(databases, mapping, self.max_codes)
        concepts = self.client.umls_concepts(cuis, coding_systems)
        return concepts, mapping


class VariationChain(Variation):

    """Chain of variations that are applied to the input left-to-right."""

    def __init__(self, *variations, description=None):
        self.variations = variations
        self.description_str = description

    def description(self):
        if self.description_str is None:
            res = '; '.join(v.description() for v in self.variations)
            if res:
                return res[0].upper() + res[1:]
            else:
                return ""
        else:
            return self.description_str

    def vary_code(self, code, coding_system):
        for variation in self.variations:
            code = variation.vary_code(code, coding_system)
        return code

    def vary_codes(self, generated, reference, coding_system):
        for variation in self.variations:
            generated, reference = variation.vary_codes(generated, reference, coding_system)
        return generated, reference

    def vary_concepts_and_mapping(self, concepts, mapping, coding_systems, outcome_id):
        for variation in self.variations:
            concepts, mapping = variation.vary_concepts_and_mapping(concepts, mapping, coding_systems, outcome_id)
        return concepts, mapping


class CodeNormalization(Variation):

    def __init__(self, *coding_system_prefixes):
        """`coding_systems` is None or a list of prefixes and this
        normalization is applied only if the list contains a prefix of the
        current coding systems."""
        self.coding_system_prefixes = coding_system_prefixes \
            or [''] # A prefix of any coding system

    def vary_code(self, code, coding_system):
        if any(coding_system.startswith(prefix)
               for prefix in self.coding_system_prefixes):
            return self.normalize(code, coding_system)
        else:
            return code


class NormalizeCodeCase(CodeNormalization):

    """Normalize code case in ICD, ICPC"""

    def __init__(self):
        super().__init__('ICD', 'ICPC')

    def normalize(self, code, coding_system):
        return code.upper()


class NormalizeCodeSuffixDot(CodeNormalization):

    """Drop suffix dots in codes in ICPC"""

    def __init__(self):
        super().__init__('ICPC')

    def normalize(self, code, coding_system):
        if code[-1] == '.':
            return code[:-1]
        else:
            return code


class NormalizeCodeXDD(CodeNormalization):

    """Normalize codes to 3 letters"""

    def __init__(self, coding_system_prefixes):
        super().__init__(coding_system_prefixes)

    def description(self):
        return super().description() + ' ({})'.format(', '.join(self.coding_system_prefixes))

    def normalize(self, code, coding_system):
        code = code.upper()
        m1 = re.match(comap.RegexHierarchy.TYPES['LDD'], code)
        try:
            return m1.group('parent')
        except:
            m2 = re.match(comap.RegexHierarchy.TYPES['DDD'], code)
            try:
                return m2.group('parent')
            except:
                return code


class NormalizeRead2Codes(CodeNormalization):

    """Normalize READ2 codes to 5-byte"""

    READ_RE = re.compile(r'(?P<code>[A-Z\d][A-Za-z0-9.]{4}).*')

    def __init__(self):
        super().__init__('RCD2')

    def normalize(self, code, coding_system):
        m = self.READ_RE.match(code)
        assert m, "Not a READ2 code: {}".format(code)
        return m.group('code')


class IncludeRelatedCodes(Variation):

    """Include related codes"""

    hierarchies = {
        'ICD9CM': comap.RegexHierarchy('DDD'),
        'ICD10CM': comap.RegexHierarchy('LDD'),
        'ICPC': comap.RegexHierarchy('LDD'),
        'RCD2': comap.Read2Hierarchy(),
    }

    def __init__(self, direction):
        """ direction : 'FN-FP' | 'FN' """
        self.direction = direction

    def description(self):
        return super().description() + ' ({})'.format(self.direction)

    def vary_codes(self, generated, reference, coding_system):
        hierarchy = self.hierarchies[coding_system]
        codes = comap.confusion_matrix(generated, reference)
        related_codes, derivated_codes = {
            'FN': comap.include_related,
            'FN-FP': comap.include_related_bidirect,
        }[self.direction](hierarchy, codes=codes)
        return comap.from_confusion_matrix(related_codes)


class IncludeChildConcepts(Variation):

    """Include child concepts"""

    def vary_concepts_and_mapping(self, concepts, mapping, coding_systems, outcome_id):
        cuis = [c['cui'] for c in concepts]
        child_concepts_by_parent = child_concepts_by_outcome[outcome_id]
        child_concepts = [
            child_concept
            for parent_id, concepts_for_parent in child_concepts_by_parent
            for child_concept in concepts_for_parent
            if child_concept not in cuis
        ]
        return concepts + child_concepts, mapping


class IncludeRelatedConcepts(Variation):

    """Include related concepts"""

    def __init__(self, *relations):
        self.relations = list(relations)
        self.client = comap.ComapClient()

    def description(self):
        return super().description() + ' ({})'.format(', '.join(self.relations))

    def vary_concepts_and_mapping(self, concepts, mapping, coding_systems, outcome_id):
        cuis = [c['cui'] for c in concepts]
        coding_systems = list(databases.values())
        related = self.client.related(cuis, self.relations, coding_systems)
        concepts_and_related = {c['cui']: c for c in concepts}
        for cui in related.keys():
            for rel in related[cui].keys():
                for new_concept in related[cui][rel]:
                    new_cui = new_concept['cui']
                    codes = set((sourceConcept['id'], sourceConcept['codingSystem'])
                                for sourceConcept in new_concept['sourceConcepts'])
                    if new_cui not in concepts_and_related:
                        concepts_and_related[new_cui] = new_concept
        return list(concepts_and_related.values()), mapping


def create_result(references, concepts_by_outcome, variation):

    coding_systems = sorted(set(databases.values()))

    # { outcome_id: { database_id: { code } | None } }
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

    def vary_code_concepts_mapping(variation, concepts, mapping):
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

    print(variation_id)
    res_for_variation = OrderedDict([
        ('name', variation.description()),
        ('by-outcome', OrderedDict()),
    ])
    for outcome_id in outcome_ids:
        print(' - ', outcome_id)
        concepts = concepts_by_outcome[outcome_id]
        mapping = {
            database_id: mappings[outcome_id][database_id]
            for database_id in databases.keys()
        }
        varied_concepts, varied_mapping = vary_code_concepts_mapping(variation, concepts, mapping)

        res_by_outcome = res_for_variation['by-outcome'][outcome_id] = OrderedDict()

        res_by_outcome['generated-cuis'] = sorted(c['cui'] for c in varied_concepts)

        if variation_id == 'maximum-recall':
            res_by_cuis = res_by_outcome['by-cui'] = OrderedDict()
            for concept in varied_concepts:
                cui = concept['cui']
                res_by_cuis[cui] = OrderedDict()
                res_by_cuis[cui]['name'] = concept['preferredName']
                res_by_coding_systems = res_by_cuis[cui]['by-coding-system'] = OrderedDict()
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

        res_comparisons = res_by_outcome['by-database'] = OrderedDict()
        for database_id, coding_system in databases.items():
            if varied_mapping.get(database_id) is None:
                res_comparisons[database_id] = None
            else:
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

                res_comparisons[database_id] = OrderedDict([
                    ('codes', varied_cm),
                    ('measures', measures),
                ])
    return res_for_variation


default_variations0 = VariationChain(NormalizeCodeCase(), NormalizeCodeSuffixDot(), NormalizeRead2Codes(), NormalizeCodeXDD('ICPC'))
default_variations = VariationChain(default_variations0, description='Baseline variations')
all_variations = OrderedDict([
    ('baseline', default_variations0),
    ('maximum-recall', VariationChain(default_variations, MaximumRecall())),
    ('maximum-recall-min-2', VariationChain(default_variations, MaximumRecall(2))),
    ('maximum-precision', VariationChain(default_variations, MaximiumPrecision())),
    ('maximum-precision-max-1', VariationChain(default_variations, MaximiumPrecision(1))),
    ('3-letter-codes', VariationChain(default_variations, NormalizeCodeXDD('ICPC'))),
    ('expand-to-ref-RN-RB', VariationChain(default_variations, ExpandConceptsTowardsReference('RN', 'RB'))),
    ('expand-to-ref-CHD-PAR', VariationChain(default_variations, ExpandConceptsTowardsReference('CHD', 'PAR'))),
    ('expand-to-ref-RN-CHD', VariationChain(default_variations, ExpandConceptsTowardsReference('RN', 'CHD'))),
    ('expand-to-ref-RB-PAR', VariationChain(default_variations, ExpandConceptsTowardsReference('RB', 'PAR'))),
    ('expand-to-ref-RN-CHD-RB-PAR', VariationChain(default_variations, ExpandConceptsTowardsReference('RN', 'CHD', 'RB', 'PAR'))),
    ('expand-to-ref-SIB-SY-RQ', VariationChain(default_variations, ExpandConceptsTowardsReference('SI', 'SY', 'RQ'))),
    ('expand-to-ref-*', VariationChain(default_variations, ExpandConceptsTowardsReference('RN', 'CHD', 'RB', 'PAR', 'SIB', 'SY', 'RQ'))),
    ('related-FN', VariationChain(default_variations, IncludeRelatedCodes('FN'))),
    ('related-FN-FP', VariationChain(default_variations, IncludeRelatedCodes('FN-FP'))),
    ('related-concepts-RN', VariationChain(default_variations, IncludeRelatedConcepts('RN'))),
    ('related-concepts-RN-RB', VariationChain(default_variations, IncludeRelatedConcepts('RN', 'RB'))),
    ('related-concepts-CHD', VariationChain(default_variations, IncludeRelatedConcepts('CHD'))),
    ('related-concepts-CHD-PAR', VariationChain(default_variations, IncludeRelatedConcepts('CHD', 'PAR'))),
    ('hyponyms', VariationChain(default_variations, IncludeChildConcepts())),
    ('child-concepts-related-FN-FP', VariationChain(default_variations, IncludeChildConcepts(), IncludeRelatedCodes('FN-FP'))),
])

if os.getenv('DOCTEST'):
    import doctest
    doctest.testmod(comap, report=True)
    doctest.testmod(report=True)

try:
    variation = all_variations[variation_id]
except KeyError:
    print("No variation named", variation_id)
    exit(1)
evaluation = create_result(references, concepts_by_outcome, variation)

with redo.output() as f:
    yaml.dump(evaluation, f)
