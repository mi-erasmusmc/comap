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


def create_results(references, concepts_by_outcome, variations):

    res = OrderedDict()
    for outcome_id in outcome_ids:
        res[outcome_id] = OrderedDict()
        for database, coding_system in databases:
            res[outcome_id][database] = list()

            mapping = references[database]['mappings'].get(outcome_id)
            if mapping is None:
                print("No mapping for {} in {}".format(outcome_id, database))
                reference = None
            else:
                reference = mapping['inclusion'] + mapping.get('exclusion', [])

            for make_variation in variations:
                if reference is not None:
                    variation = make_variation(outcome_id, coding_system)
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
                    comparison = OrderedDict([
                        ('codes', OrderedDict([
                            (key, sorted(value))
                            for key, value in codes.items()
                        ])),
                        ('measures', OrderedDict([
                            (key, value and round(value, 2))
                            for key, value in measures.items()
                        ])),
                    ])
                else:
                    comparison = None
                res[outcome_id][database].append(OrderedDict([
                    ('name', variation.description()),
                    ('comparison', comparison),
                ]))
    return res


class AbstractVariation(object):

    def __init__(self, outcome_id, coding_system):
        self.outcome_id = outcome_id
        self.coding_system = coding_system

    def description(self):
        return self.__doc__

    def vary_codes(self, generated, reference):
        return generated, reference

    def vary_concepts(self, concepts, reference):
        return concepts


def variation_chain(*variations):

    class VariationChain(AbstractVariation):

        def __init__(self, *args, **kwargs):
            super().__init__(*args, **kwargs)
            self.variations = [v(*args, **kwargs) for v in variations]

        def description(self):
            res = ' -> '.join(v.description().lower() for v in self.variations)
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

    return VariationChain


class Identity(AbstractVariation):

    """Identity"""

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)


class CodeNormalization(AbstractVariation):

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)

    def vary_codes(self, generated, reference):
        return [self.normalize(c) for c in generated], \
            [self.normalize(c) for c in reference]


class NormalizeCodeCase(CodeNormalization):

    """Normalize code case"""

    @classmethod
    def normalize(cls, code):
        return code.upper()


class NormalizeCodeSuffixDot(CodeNormalization):

    """Drop suffix dots in codes"""

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)

    @classmethod
    def normalize(cls, code):
        if code[-1] == '.':
            return code[:-1]
        else:
            return code


class NormalizeCodeXDD(CodeNormalization):

    """Normalize codes (case and to XDD)"""

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)

    @classmethod
    def normalize(cls, code):
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


class IncludeRelatedCodes(AbstractVariation):

    """Include related codes"""

    hierarchies = {
        'ICD9CM': comap.RegexHierarchy('DDD'),
        'ICD10CM': comap.RegexHierarchy('LDD'),
        'ICPC': comap.RegexHierarchy('LDD'),
    }

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)

    def vary_codes(self, generated, reference):
        hierarchy = self.hierarchies[self.coding_system]
        codes = comap.confusion_matrix(generated, reference)
        related_codes, derivated_codes = comap.include_related(hierarchy, codes=codes)
        return comap.from_confusion_matrix(related_codes)


class IncludeRelatedCodesBidirect(AbstractVariation):

    """Include bidirectionally related codes"""

    hierarchies = {
        'ICD9CM': comap.RegexHierarchy('DDD'),
        'ICD10CM': comap.RegexHierarchy('LDD'),
        'ICPC': comap.RegexHierarchy('LDD'),
    }

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)

    def vary_codes(self, generated, reference):
        hierarchy = self.hierarchies[self.coding_system]
        codes = comap.confusion_matrix(generated, reference)
        related_codes, derivated_codes = comap.include_related_bidirect(hierarchy, codes=codes)
        return comap.from_confusion_matrix(related_codes)


class IncludeChildConcepts(AbstractVariation):

    """Include child concepts"""

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)

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


variations = [
    Identity,
    variation_chain(NormalizeCodeCase, NormalizeCodeSuffixDot),
    variation_chain(NormalizeCodeCase, NormalizeCodeSuffixDot, NormalizeCodeXDD),
    variation_chain(NormalizeCodeCase, NormalizeCodeSuffixDot, IncludeRelatedCodes),
    variation_chain(NormalizeCodeCase, NormalizeCodeSuffixDot, IncludeRelatedCodesBidirect),
    variation_chain(NormalizeCodeCase, NormalizeCodeSuffixDot, IncludeChildConcepts),
]

evaluation = create_results(references, concepts_by_outcome, variations)

# Output results as YAML

with redo.output() as f:
    yaml.dump(evaluation, f)

if os.getenv('DOCTEST'):
    import doctest
    doctest.testmod()
    doctest.testmod(comap)

