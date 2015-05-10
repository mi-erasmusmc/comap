#!/usr/bin/env python3
from collections import OrderedDict
import os
import json
import yaml
import re
from pathlib import Path
import redo
redo.ifchange('comap.py'); import comap

project = redo.base
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


class Variation(object):

    """Identity"""

    def __init__(self):
        self.outcome_id = None
        self.coding_system = None

    def description(self):
        return self.__doc__

    def vary_codes(self, generated, reference, coding_systems):
        return generated, reference

    def vary_concepts_and_mapping(self, concepts, mapping, outcome_id):
        return concepts, mapping


class VariationChain(Variation):

    """Chain of variations that are applied to the input left-to-right."""

    def __init__(self, *variations):
        self.variations = variations

    def set_context(self, *args, **kwargs):
        for variation in self.variations:
            variation.set_context(*args, **kwargs)

    def description(self):
        res = '; '.join(v.description() for v in self.variations)
        if res:
            return res[0].upper() + res[1:]
        else:
            return ""

    def vary_codes(self, generated, reference, coding_system):
        for variation in self.variations:
            generated, reference = variation.vary_codes(generated, reference, coding_system)
        return generated, reference

    def vary_concepts_and_mapping(self, concepts, mapping, outcome_id):
        for variation in self.variations:
            concepts, mapping = variation.vary_concepts_and_mapping(concepts, mapping, outcome_id)
        return concepts, mapping


class CodeNormalization(Variation):

    def __init__(self, coding_system_prefixes=['']):
        """`coding_systems` is None or a list of prefixes and this
        normalization is applied only if the list contains a prefix of the
        current coding systems."""
        self.coding_system_prefixes = coding_system_prefixes

    def vary_codes(self, generated, reference, coding_system):
        if any(coding_system.startswith(prefix)
               for prefix in self.coding_system_prefixes):
            return [self.normalize(c) for c in generated], \
                [self.normalize(c) for c in reference]
        else:
            return generated, reference


class NormalizeCodeCase(CodeNormalization):

    """Normalize code case in ICD, ICPC"""

    def __init__(self):
        super().__init__(['ICD', 'ICPC'])

    def normalize(self, code):
        return code.upper()


class NormalizeCodeSuffixDot(CodeNormalization):

    """Drop suffix dots in codes in ICPC"""

    def __init__(self):
        super().__init__(['ICPC'])

    def normalize(self, code):
        if code[-1] == '.':
            return code[:-1]
        else:
            return code


class NormalizeCodeXDD(CodeNormalization):

    """Normalize codes ICD and ICPC to 3 letters"""

    def __init__(self):
        super().__init__(['ICD', 'ICPC'])

    def normalize(self, code):
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

    read_re = re.compile(r'(?P<code>[A-Z\d][A-Za-z0-9.]{4}).*')

    def __init__(self):
        super().__init__(['RCD2'])

    def normalize(self, code):
        m = self.read_re.match(code)
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

    def vary_concepts_and_mapping(self, concepts, mapping, outcome_id):
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

    def vary_concepts_and_mapping(self, concepts, mapping, outcome_id):
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


def create_results(references0, concepts_by_outcome, variations):

    # mapping ::= { database_id: { "codes?": { code }, "comment"?: str } }

    # { outcome_id: mapping }
    mappings = {}
    for outcome_id in outcome_ids:
        mappings[outcome_id] = {}
        for database in databases.keys():
            mapping = references0[database]['mappings'][outcome_id]
            if 'inclusion' in mapping:
                codes = set(mapping['inclusion'] + mapping.get('exclusion', []))
            else:
                codes = None
            mappings[outcome_id][database] = OrderedDict([
                ('codes', codes)
            ])
            if 'comment' in mapping:
                mappings[outcome_id][database]['comment'] = mapping['comment']

    # { outcome_id: { variation_id: { "concepts": { concept }, "mapping": mapping } } }
    varied_by_outcome = {}
    for outcome_id in outcome_ids:
        varied_by_outcome[outcome_id] = {}
        concepts = concepts_by_outcome[outcome_id]
        for variation_id, variation in variations.items():
            varied_generated, varied_mapping = \
                variation.vary_concepts_and_mapping(concepts, mappings[outcome_id], outcome_id)
            varied_by_outcome[outcome_id][variation_id] = {
                'concepts': varied_generated,
                'mapping': varied_mapping,
            }

    res = OrderedDict()
    for outcome_id in outcome_ids:
        res[outcome_id] = OrderedDict()
        for database, coding_system in databases.items():
            res[outcome_id][database] = OrderedDict([])
            mapping = mappings[outcome_id][database]
            if mapping.get('codes') is not None:
                res[outcome_id][database]['variations'] = OrderedDict()
                for variation_id, variation in variations.items():
                    generated_codes = [
                        code['id']
                        for concept in varied_by_outcome[outcome_id][variation_id]['concepts']
                        for code in concept['sourceConcepts']
                        if code['codingSystem'] == coding_system
                    ]
                    reference_codes = varied_by_outcome[outcome_id][variation_id]['mapping'][database]['codes']
                    varied_generated_codes, varied_reference_codes = \
                        variation.vary_codes(generated_codes, reference_codes, coding_system)
                    varied_codes = comap.confusion_matrix(generated=varied_generated_codes,
                                                          reference=varied_reference_codes)
                    measures = comap.measures(codes=varied_codes)

                    res[outcome_id][database]['variations'][variation_id] = \
                        OrderedDict([
                            ('name', variation.description()),
                            ('comparison', OrderedDict([
                                ('codes', varied_codes),
                                ('measures', measures),
                            ])),
                    ])
            if 'comment' in mapping:
                res[outcome_id][database]['comment'] = mapping['comment']
    return res


default_variations = VariationChain(NormalizeCodeCase(), NormalizeCodeSuffixDot(), NormalizeRead2Codes())
variations = OrderedDict([
    ('baseline', default_variations),
    ('3-letter-codes', VariationChain(default_variations, NormalizeCodeXDD())),
    ('related-FN', VariationChain(default_variations, IncludeRelatedCodes('FN'))),
    ('related-FN-FP', VariationChain(default_variations, IncludeRelatedCodes('FN-FP'))),
    ('related-concepts-RN', VariationChain(default_variations, IncludeRelatedConcepts('RN'))),
    ('related-concepts-RN-RB', VariationChain(default_variations, IncludeRelatedConcepts('RN', 'RB'))),
    ('related-concepts-CHD', VariationChain(default_variations, IncludeRelatedConcepts('CHD'))),
    ('related-concepts-CHD-PAR', VariationChain(default_variations, IncludeRelatedConcepts('CHD', 'PAR'))),
    ('hyponyms', VariationChain(default_variations, IncludeChildConcepts())),
    ('child-concepts-related-FN-FP', VariationChain(default_variations, IncludeChildConcepts(), IncludeRelatedCodes('FN-FP'))),
])

evaluation = create_results(references, concepts_by_outcome, variations)

# Output results as YAML

with redo.output() as f:
    yaml.dump(evaluation, f)

if os.getenv('DOCTEST'):
    import doctest
    doctest.testmod()
    doctest.testmod(comap)

