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


class AbstractVariation(object):

    def description(self):
        return self.__doc__

    def set_context(self, outcome_id, coding_system):
        self.outcome_id = outcome_id
        self.coding_system = coding_system

    def vary_codes(self, generated, reference):
        return generated, reference

    def vary_concepts(self, concepts, reference):
        return concepts


class VariationChain(AbstractVariation):

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

    def vary_codes(self, generated, reference):
        for variation in self.variations:
            generated, reference = variation.vary_codes(generated, reference)
        return generated, reference

    def vary_concepts(self, concepts, reference):
        for variation in self.variations:
            concepts = variation.vary_concepts(concepts, reference)
        return concepts


class Identity(AbstractVariation):

    """Identity"""

    pass


class CodeNormalization(AbstractVariation):

    def __init__(self, coding_system_prefixes=['']):
        """`coding_systems` is None or a list of prefixes and this
        normalization is applied only if the list contains a prefix of the
        current coding systems."""
        self.coding_system_prefixes = coding_system_prefixes

    def vary_codes(self, generated, reference):
        if any(self.coding_system.startswith(prefix)
               for prefix in self.coding_system_prefixes):
            return [self.normalize(c) for c in generated], \
                [self.normalize(c) for c in reference]
        else:
            return generated, reference


class NormalizeCodeCase(CodeNormalization):

    """Normalize code case"""

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

    """Normalize codes to XDD in ICD and ICPC"""

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


class IncludeRelatedCodes(AbstractVariation):

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

    def vary_codes(self, generated, reference):
        hierarchy = self.hierarchies[self.coding_system]
        codes = comap.confusion_matrix(generated, reference)
        related_codes, derivated_codes = {
            'FN': comap.include_related,
            'FN-FP': comap.include_related_bidirect,
        }[self.direction](hierarchy, codes=codes)
        return comap.from_confusion_matrix(related_codes)


class IncludeChildConcepts(AbstractVariation):

    """Include child concepts"""

    def vary_concepts(self, concepts, reference):
        cuis = [c['cui'] for c in concepts]
        child_concepts_by_parent = child_concepts_by_outcome[self.outcome_id]
        child_concepts = [
            child_concept
            for parent_id, concepts_for_parent in child_concepts_by_parent
            for child_concept in concepts_for_parent
            if child_concept not in cuis
        ]
        return concepts + child_concepts


def create_results(references, concepts_by_outcome, variations):

    res = OrderedDict()
    for outcome_id in outcome_ids:
        res[outcome_id] = OrderedDict()
        for database, coding_system in databases:
            mapping = references[database]['mappings'][outcome_id]
            res[outcome_id][database] = OrderedDict([])

            if 'inclusion' in mapping:
                reference = mapping['inclusion'] + mapping.get('exclusion', [])
            else:
                print("No mapping for {} in {}".format(outcome_id, database))
                reference = None

            if reference is not None:
                res[outcome_id][database]['variations'] = list()
                for variation in variations:
                    variation.set_context(outcome_id, coding_system)
                    generated_concepts = variation.vary_concepts(
                        concepts_by_outcome[outcome_id], reference)
                    generated = [
                        code['id']
                        for concept in generated_concepts
                        for code in concept['sourceConcepts']
                        if code['codingSystem'] == coding_system
                    ]
                    varied_generated, varied_reference = \
                        variation.vary_codes(generated, reference)
                    codes = comap.confusion_matrix(generated=varied_generated,
                                                  reference=varied_reference)
                    measures = comap.measures(codes=codes)
                    for key, values in codes.items():
                        try:
                            sorted(values)
                        except:
                            print([v for v in values if type(v) != str])
                            raise
                    comparison = OrderedDict([
                        ('codes', OrderedDict([
                            (key, sorted(value))
                            for key, value in codes.items()
                        ])),
                        ('measures', OrderedDict([
                            (key, value) # and round(value, 2))
                            for key, value in measures.items()
                        ])),
                    ])
                    res[outcome_id][database]['variations'].append(OrderedDict([
                        ('name', variation.description()),
                        ('comparison', comparison),
                    ]))

            if 'comment' in mapping:
                res[outcome_id][database]['comment'] = mapping['comment']
    return res


default_variations = VariationChain(NormalizeCodeCase(), NormalizeCodeSuffixDot(), NormalizeRead2Codes())
variations = [
    Identity(),
    default_variations,
    VariationChain(default_variations, NormalizeCodeXDD()),
    VariationChain(default_variations, IncludeRelatedCodes('FN')),
    VariationChain(default_variations, IncludeRelatedCodes('FN-FP')),
    VariationChain(default_variations, IncludeChildConcepts()),
]

evaluation = create_results(references, concepts_by_outcome, variations)

# Output results as YAML

with redo.output() as f:
    yaml.dump(evaluation, f)

if os.getenv('DOCTEST'):
    import doctest
    doctest.testmod()
    doctest.testmod(comap)

