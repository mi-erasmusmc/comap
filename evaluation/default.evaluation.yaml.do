#!/usr/bin/env python3
from collections import OrderedDict, defaultdict
from pathlib import Path
import os
import json
import yaml
import re
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


def cosynonym_codes(codes, coding_system, coding_systems):

    """
    >>> expected = {'C0496826': {'ICD10CM': {'C67.0'}, 'RCD': {'X78ZS', 'B490.'}}}
    >>> res = cosynonym_codes(['C67.0'], 'ICD10CM', ['ICD10CM', 'RCD'])
    >>> dict(comap.mega_map(res, [None], dict)) == expected
    True
    """

    res = defaultdict(lambda: defaultdict(set))

    if not codes:
        return res

    original_coding_system = coding_system
    original_coding_systems = coding_systems
    if coding_system == 'RCD2':
        coding_system = 'RCD'
        if 'RCD' not in coding_systems:
            coding_systems = coding_systems + ['RCD']
        read_translation = comap.translation_read2_to_read3(codes)
        codes = set(code for codes in read_translation.values() for code in codes)

    # ... WHERE cui IN (SELECT cui FROM MRCONSO WHERE code in (...)) was too slow, separate
    cuis_query = """
        SELECT DISTINCT cui FROM MRCONSO
        WHERE sab = %s AND code IN ({codes})
    """.format(codes=', '.join(['%s'] * len(codes)))

    cuis_for_codes = []
    with comap.umls_db.cursor() as cursor:
        cursor.execute(cuis_query, tuple([coding_system] + list(codes)))
        for row in cursor.fetchall():
            cuis_for_codes.append(row[0])

    if not cuis_for_codes:
        return res

    cui_code_query = """
        SELECT DISTINCT cui, code, sab FROM MRCONSO
        WHERE cui IN ({cuis})
        AND sab in ({coding_systems})
    """.format(cuis=', '.join(['%s'] * len(cuis_for_codes)),
               coding_systems=', '.join(['%s'] * len(coding_systems)))

    with comap.umls_db.cursor() as cursor:
        cursor.execute(cui_code_query, tuple(cuis_for_codes + coding_systems))

        for row in cursor.fetchall():
            cui, code, sab = row
            res[cui][sab].add(code)

    if 'RCD2' in coding_systems:
        rcd3_codes = set()
        for cui, codes_by_sab in res.items():
            for sab, codes in codes_by_sab.items():
                if sab == 'RCD':
                    for code in codes:
                        rcd3_codes.add(code)
        backtranslation = comap.translation_read3_to_read2(rcd3_codes)
        res1 = defaultdict(lambda: defaultdict(set))
        for cui, codes_by_sab in res.items():
            for sab, codes in codes_by_sab.items():
                for code in codes:
                    if sab == 'RCD':
                        if 'RCD' in original_coding_systems:
                            res1[cui]['RCD'].add(code)
                        else:
                            for code2 in backtranslation[code]:
                                res1[cui]['RCD2'].add(code2)
                    else:
                        res1[cui][sab].add(code)
        return res1
    else:
        return res


def mapping_to_max_recall_cuis(mapping):

    """
    The CUIs such that their codes capture the mapping with minimal
    codes outside the mapping, i.e.

        ⋃_{v ∈ V_DB} \{
           argmin_{cui ∈ UMLS}
             \| m_v ∩ codes(cui) \|
        \}

    """

    cuis = set()
    coding_systems = list(set(databases.values()))
    for database_id in mapping.keys():
        if not mapping[database_id]:
            continue
        codes = set(mapping[database_id])
        coding_system = databases[database_id]
        cui_codes = cosynonym_codes(codes, coding_system, coding_systems)
        for code in codes:
            # Find the `cui` that implicates `code` with the least number of irrelevant codes
            cuis_with_count = \
                [(cui, len(codes - codes_by_sab[coding_system]))
                 for cui, codes_by_sab in cui_codes.items()
                 if code in codes_by_sab[coding_system]]
            if cuis_with_count:
                key = lambda x: x[1]
                cui, _ = sorted(cuis_with_count, key=key)[0]
                cuis.add(cui)
    return cuis


def mapping_to_max_precision_cuis(mapping):
    """
    The maximum CUIs such that all codes are in mapping, i.e.

    \{ 
       cui ∈ UMLS | ∀v ∈ V_DB: codes_v ⊂ m_v
    \}
    """
    coding_systems = list(set(databases.values()))
    all_cui_codes = defaultdict(lambda: defaultdict(set))
    for database_id in mapping.keys():
        if not mapping[database_id]:
            continue
        coding_system = databases[database_id]
        codes = set(mapping[database_id])
        cui_codes = cosynonym_codes(codes, coding_system, coding_systems)
        for cui, codes_by_sab in cui_codes.items():
            for sab, codes in codes_by_sab.items():
                for code in codes:
                    all_cui_codes[cui][sab].add(code)
    # Find the CUIs where all codes are in the reference
    cuis = set()
    for cui, codes in all_cui_codes.items():
        if all(mapping[database_id] is None or \
               codes[coding_system].issubset(mapping[database_id])
               for database_id, coding_system in databases.items()):
            cuis.add(cui)
    return cuis


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
        reference_cuis = mapping_to_max_recall_cuis(mapping)

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

    def __init__(self):
        self.client = comap.ComapClient()

    def vary_concepts_and_mapping(self, concepts, mapping, coding_systems, outcome_id):
        "Return concepts that contain all codes in `mapping`."
        cuis = mapping_to_max_recall_cuis(mapping)
        concepts = self.client.umls_concepts(cuis, coding_systems)
        return concepts, mapping


class MaximiumPrecision(Variation):

    """Maximize precision"""

    def __init__(self):
        self.client = comap.ComapClient()

    def vary_concepts_and_mapping(self, concepts, mapping, coding_systems, outcome_id):
        "Return concepts such that code is not in `mapping`."
        cuis = mapping_to_max_precision_cuis(mapping)
        concepts = self.client.umls_concepts(cuis, coding_systems)
        return concepts, mapping


class VariationChain(Variation):

    """Chain of variations that are applied to the input left-to-right."""

    def __init__(self, *variations, description=None):
        self.variations = variations
        self.description_str = description

    def set_context(self, *args, **kwargs):
        for variation in self.variations:
            variation.set_context(*args, **kwargs)

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

    """Normalize codes ICD and ICPC to 3 letters"""

    def __init__(self):
        super().__init__('ICD', 'ICPC')

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


def create_results(references, concepts_by_outcome, variations):

    # mapping ::= { database_id: { code } | None }

    # { outcome_id: mapping }
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

    coding_systems = sorted(set(databases.values()))

    # { outcome_id: { variation_id: { "concepts": { concept }, "mapping": mapping } } }
    varied_by_outcome = {}
    for outcome_id in outcome_ids:
        varied_by_outcome[outcome_id] = {}
        concepts = concepts_by_outcome[outcome_id]
        reference_codes = OrderedDict([
            (database_id, mappings[outcome_id][database_id])
            for database_id in databases.keys()
        ])
        for variation_id, variation in variations.items():
            # Map codes in generated concepts with variation.vary_code
            concepts1 = []
            for concept in concepts_by_outcome[outcome_id]:
                concept1 = concept.copy()
                concept1['sourceConcepts'] = []
                for source_concept in concept['sourceConcepts']:
                    source_concept1 = source_concept.copy()
                    id, coding_system = source_concept['id'], source_concept['codingSystem']
                    source_concept1['id'] = variation.vary_code(id, coding_system)
                    concept1['sourceConcepts'].append(source_concept1)
                concepts1.append(concept1)
            # Map reference codes with variation.vary_code
            reference_codes1 = OrderedDict()
            for database_id in databases.keys():
                if reference_codes[database_id] is None:
                    reference_codes1[database_id] = None
                else:
                    reference_codes1[database_id] = [
                        variation.vary_code(code, databases[database_id])
                        for code in mappings[outcome_id][database_id]
                    ]
            concepts2, reference_codes2 = \
                variation.vary_concepts_and_mapping(concepts1, reference_codes1, coding_systems, outcome_id)
            assert concepts2 is not None, (outcome_id, variation_id)
            varied_by_outcome[outcome_id][variation_id] = {
                'concepts': concepts2,
                'reference-codes': reference_codes2,
            }

    res = OrderedDict()
    for outcome_id in outcome_ids:
        res[outcome_id] = OrderedDict()
        for database_id, coding_system in databases.items():
            res[outcome_id][database_id] = OrderedDict([])
            mapping = mappings[outcome_id][database_id]
            if mapping is not None:
                res[outcome_id][database_id]['variations'] = OrderedDict()
                for variation_id, variation in variations.items():
                    varied = varied_by_outcome[outcome_id][variation_id]
                    generated_codes = [
                        variation.vary_code(code['id'], coding_system)
                        for concept in varied['concepts']
                        for code in concept['sourceConcepts']
                        if code['codingSystem'] == coding_system
                    ]
                    reference_codes = [
                        variation.vary_code(code, coding_system)
                        for code in varied['reference-codes'][database_id]
                    ]

                    varied_generated_codes, varied_reference_codes = \
                        variation.vary_codes(generated_codes, reference_codes, coding_system)

                    varied_codes = comap.confusion_matrix(generated=varied_generated_codes,
                                                          reference=varied_reference_codes)

                    measures = comap.measures(codes=varied_codes)

                    res[outcome_id][database_id]['variations'][variation_id] = \
                        OrderedDict([
                            ('name', variation.description()),
                            ('comparison', OrderedDict([
                                ('codes', varied_codes),
                                ('measures', measures),
                            ])),
                    ])
            comment = references[database_id]['mappings'][outcome_id].get('comment')
            if comment is not None:
                res[outcome_id][database_id]['comment'] = comment
    return res


default_variations = VariationChain(NormalizeCodeCase(), NormalizeCodeSuffixDot(), NormalizeRead2Codes(), description='Default')
all_variations = [
    ('baseline', default_variations),
    ('maximum-recall', VariationChain(default_variations, MaximumRecall())),
    ('maximum-precision', VariationChain(default_variations, MaximiumPrecision())),
    ('expand-to-ref-RN-CHD', VariationChain(default_variations, ExpandConceptsTowardsReference('RN', 'CHD'))),
    ('expand-to-ref-RN-CHD-RB-PAR', VariationChain(default_variations, ExpandConceptsTowardsReference('RN', 'CHD', 'RB', 'PAR'))),
    ('expand-to-ref-SIB-SY-RQ', VariationChain(default_variations, ExpandConceptsTowardsReference('SI', 'SY', 'RQ'))),
    ('expand-to-ref-*', VariationChain(default_variations, ExpandConceptsTowardsReference('RN', 'CHD', 'RB', 'PAR', 'SIB', 'SY', 'RQ'))),
    ('3-letter-codes', VariationChain(default_variations, NormalizeCodeXDD())),
    ('related-FN', VariationChain(default_variations, IncludeRelatedCodes('FN'))),
    ('related-FN-FP', VariationChain(default_variations, IncludeRelatedCodes('FN-FP'))),
    ('related-concepts-RN', VariationChain(default_variations, IncludeRelatedConcepts('RN'))),
    ('related-concepts-RN-RB', VariationChain(default_variations, IncludeRelatedConcepts('RN', 'RB'))),
    ('related-concepts-CHD', VariationChain(default_variations, IncludeRelatedConcepts('CHD'))),
    ('related-concepts-CHD-PAR', VariationChain(default_variations, IncludeRelatedConcepts('CHD', 'PAR'))),
    ('hyponyms', VariationChain(default_variations, IncludeChildConcepts())),
    ('child-concepts-related-FN-FP', VariationChain(default_variations, IncludeChildConcepts(), IncludeRelatedCodes('FN-FP'))),
]
if 'variations' in evaluation_config:
    variations = OrderedDict([
        (variation_id, variation)
        for (variation_id, variation) in all_variations
        if variation_id in evaluation_config['variations']
    ])
else:
    variations = OrderedDict(all_variations)

if os.getenv('DOCTEST'):
    print("Start testing")
    import doctest
    doctest.testmod()
    doctest.testmod(comap)
    print("Finished testing")

evaluation = create_results(references, concepts_by_outcome, variations)

with redo.output() as f:
    yaml.dump(evaluation, f)
