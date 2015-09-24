import logging
from collections import defaultdict
import re
import comap


logger = logging.getLogger(__name__)


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


class ExpandConceptsTowardsMaxRecallDNF(Variation):

    """Expand concepts towards max-recall DNF"""

    def __init__(self, depth, databases, *relations):
        self.depth = depth
        self.databases = databases
        self.relations = list(relations)

    def description(self):
        return super().description() + " ({} times over {})".format(self.depth, ', '.join(self.relations))

    def vary_concepts_and_mapping(self, concepts, mapping, coding_systems, outcome_id):

        cosynonyms = comap.all_cosynonyms(mapping, self.databases)
        dnf = comap.create_dnf(mapping, cosynonyms, self.databases)

        generated_cuis = {c['cui'] for c in concepts}
        reference_cuis = {cui for cuis in dnf for cui in cuis}
        expansions = defaultdict(set)

        for _ in range(self.depth):
            related = comap.get_client().related(generated_cuis, self.relations, [])
            for cui in related:
                for rel in related[cui]:
                    for concept in related[cui][rel]:
                        related_cui = concept['cui']
                        if related_cui in reference_cuis:
                            generated_cuis.add(related_cui)
                            expansions[cui].add(related_cui)

        varied_concepts = comap.get_client().umls_concepts(generated_cuis, coding_systems)

        return varied_concepts, mapping


class ExpandConceptsTowardsReference(Variation):

    """Expand concepts towards reference"""

    def __init__(self, databases, *relations):
        self.databases = databases
        self.relations = list(relations)

    def description(self):
        return super().description() + " ({})".format(', '.join(self.relations))

    def vary_concepts_and_mapping(self, concepts, mapping, coding_systems, outcome_id):

        generated_cuis = set(c['cui'] for c in concepts)
        reference_cuis = comap.mapping_to_max_recall_cuis(self.databases, mapping)

        all_cuis = generated_cuis | reference_cuis
        related_concepts = comap.get_client().related(all_cuis, self.relations, [])

        relation_data = defaultdict(set, {
            cui: defaultdict(set, {
                rel: set(concept['cui'] for concept in related_concepts[cui][rel])
                for rel in related_concepts[cui]
            })
            for cui in related_concepts
        })
        # relation_data = related_concepts
        # for path, f in [([None, None, None], lambda c: c['cui']),
        #                 ([None, None], set),
        #                 ([None], lambda d: defaultdict(set, d)),
        #                 ([], lambda d: defaultdict(lambda: defaultdict(set), d))]:
        #     relation_data = comap.mega_map(relation_data, path, f)

        hierarchy = comap.DataHierarchy(self.relations, relation_data)
        related_cuis_by_rel = hierarchy.related(reference_cuis, generated_cuis)
        related_cuis = set(cui for _, cuis in related_cuis_by_rel.items() for cui in cuis)

        varied_cuis = generated_cuis | related_cuis
        varied_concepts = comap.get_client().umls_concepts(varied_cuis, coding_systems)

        return varied_concepts, mapping


class MaximumRecall(Variation):

    """Maximize recall"""

    def __init__(self, databases, min_codes=None):
        self.databases = databases
        self.min_codes = min_codes

    def description(self):
        return super().description() + ("" if self.min_codes is None else
                                        " (min {})".format(self.min_codes))

    def vary_concepts_and_mapping(self, concepts, mapping, coding_systems, outcome_id):
        "Return concepts that contain all codes in `mapping`."
        cuis = comap.mapping_to_max_recall_cuis(self.databases, mapping, self.min_codes)
        concepts = comap.get_client().umls_concepts(cuis, coding_systems)
        return concepts, mapping


class MaximiumPrecision(Variation):

    """Maximize precision"""

    def __init__(self, databases, max_codes=None):
        self.databases = databases
        self.max_codes = max_codes

    def description(self):
        return super().description() + ("" if self.max_codes is None else
                                        " (max {})".format(self.max_codes))

    def vary_concepts_and_mapping(self, concepts, mapping, coding_systems, outcome_id):
        "Return concepts such that code is not in `mapping`."
        cuis = comap.mapping_to_max_precision_cuis(self.databases, mapping, self.max_codes)
        concepts = comap.get_client().umls_concepts(cuis, coding_systems)
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
            try:
                generated, reference = variation.vary_codes(generated, reference, coding_system)
            except TypeError: # 'NoneType' is not iterable
                pass
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


class NormalizeReadCodes(CodeNormalization):

    """Normalize READ2 codes to 5-byte"""

    READ_RE = re.compile(r'(?P<code>[A-Z\d][A-Za-z0-9.]{4}).*')

    def __init__(self):
        super().__init__('RCD')

    def normalize(self, code, coding_system):
        m = self.READ_RE.match(code)
        if m:
            return m.group('code')
        else:
            logger.warn("Not a READ2 code: %s", code)
            return code


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

    def __init__(self, child_concepts_by_outcome):
        self.child_concepts_by_outcome = child_concepts_by_outcome

    def vary_concepts_and_mapping(self, concepts, mapping, coding_systems, outcome_id):
        cuis = [c['cui'] for c in concepts]
        child_concepts_by_parent = self.child_concepts_by_outcome[outcome_id]
        child_concepts = [
            child_concept
            for parent_id, concepts_for_parent in child_concepts_by_parent
            for child_concept in concepts_for_parent
            if child_concept not in cuis
        ]
        return concepts + child_concepts, mapping


class IncludeRelatedConcepts(Variation):

    """Include related concepts"""

    def __init__(self, databases, *relations):
        self.databases = databases
        self.relations = list(relations)

    def description(self):
        return super().description() + ' ({})'.format(', '.join(self.relations))

    def vary_concepts_and_mapping(self, concepts, mapping, coding_systems, outcome_id):
        cuis = [c['cui'] for c in concepts]
        coding_systems = list(self.databases.values())
        related = comap.get_client().related(cuis, self.relations, coding_systems)
        concepts_and_related = {c['cui']: c for c in concepts}
        for cui in related.keys():
            for rel in related[cui].keys():
                for new_concept in related[cui][rel]:
                    new_cui = new_concept['cui']
                    # FIXME `codes` never used?
                    codes = set((sourceConcept['id'], sourceConcept['codingSystem'])
                                for sourceConcept in new_concept['sourceConcepts'])
                    if new_cui not in concepts_and_related:
                        concepts_and_related[new_cui] = new_concept
        return list(concepts_and_related.values()), mapping

    
def get_codes_in_db(codes_in_dbs, coding_system):
    for coding_system0 in codes_in_dbs:
        if coding_system.startswith(coding_system0):
            return codes_in_dbs[coding_system0]
    return None

    
class FilterGeneratedCodesByDbs(Variation):

    def __init__(self, codes_in_dbs):
        self.codes_in_dbs = codes_in_dbs

    def description(self):
        return "Filter unused generated codes"

    def filter_code(self, code, codes_in_db):
        return code in codes_in_db
        
    def vary_codes(self, generated, reference, coding_system):
        codes_in_db = get_codes_in_db(self.codes_in_dbs, coding_system)
        if codes_in_db is None:
            logger.warn("No codes_in_db for coding system %s", coding_system)
            return None
        else:
            generated2 = [code for code in generated if self.filter_code(code, codes_in_db)]
            if generated != generated2:
                logger.info("Filtered in %s %s -> %s", coding_system, ', '.join(generated), ', '.join(generated2))
            return generated2, reference
    

class FilterCodesByDbs(Variation):

    def __init__(self, codes_in_dbs):
        self.codes_in_dbs = codes_in_dbs

    def description(self):
        return "Filter unused codes"

    def filter_code(self, code, codes_in_db):
        return code in codes_in_db
        
    def vary_codes(self, generated, reference, coding_system):
        codes_in_db = get_codes_in_db(self.codes_in_dbs, coding_system)
        if codes_in_db is None:
            logger.warn("No codes_in_db for coding system %s", coding_system)
            return None
        else:
            generated2 = [code for code in generated if self.filter_code(code, codes_in_db)]
            reference2 = [code for code in reference if self.filter_code(code, codes_in_db)]
            # if generated != generated2 or reference != reference2:
            #     logger.info("Filtered %s -- %s", ', '.join(set(generated)-set(generated2)), ', '.join(set(reference)-set(reference2)))
            return generated2, reference2


default_variations = VariationChain(NormalizeCodeCase(),
                                    NormalizeCodeSuffixDot(),
                                    NormalizeReadCodes(),
                                    NormalizeCodeXDD('ICPC'))
