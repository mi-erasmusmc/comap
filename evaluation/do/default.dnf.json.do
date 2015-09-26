#!/usr/bin/env python3
from collections import defaultdict
import logging
import os
import json, yaml
import normalize
from data import Mappings, Dnf, Databases
from comap import get_umls_db, translation_read_2to3, translation_read_3to2
import redo

logger = logging.getLogger(__name__)

def dnf_of_cosynonyms(cosynonyms):
    """
    Just a test for Dnf.of_cosynonyms
    >>> cosynonyms = {
    ...     'A': {
    ...         'V1': {'C1', 'C2', 'C5'},
    ...         'V2': {'C3', 'C4'},
    ...     },
    ...     'B': {
    ...         'V1': {'C1', 'C3', 'C5'},
    ...         'V2': {'C3'},
    ...     }
    ... }
    >>> dnf = {
    ...     frozenset({'A', 'B'}): {
    ...         'V1': {'C1', 'C5'},
    ...         'V2': {'C3'}
    ...     },
    ...     frozenset({'A'}): {
    ...         'V1': {'C2'},
    ...         'V2': {'C4'},
    ...     },
    ...     frozenset({'B'}): {
    ...         'V1': {'C3'},
    ...     }
    ... }
    >>> dnf_of_cosynonyms(cosynonyms).disjunction() == dnf
    True
    """
    return Dnf.of_cosynonyms(cosynonyms)


"""
Cosynonyms are { cui: { voc: { code } } }
DNF is { { cui }: { voc: { code } } }
"""

def all_cosynonyms(mapping, databases):
    
    res = defaultdict(lambda: defaultdict(set))

    for database in databases.databases():
        codes = mapping.codes(database)
        coding_system = databases.coding_system(database)
        if codes is not None:
            cosynonyms = cosynonym_codes(codes, coding_system, databases.coding_systems())
            for cui in cosynonyms:
                for coding_system, synonyms in cosynonyms[cui].items():
                    if synonyms:
                        res[cui][coding_system].update(synonyms)

    # Cleanup noise (introduced by RCD2/3 translations)
    for cui in list(res):
        cui_has_reference = False
        for database in databases.databases():
            codes = mapping.codes(database)
            coding_system = databases.coding_system(database)
            if codes is not None:
                for_cui = res[cui].get(coding_system) or set()
                if set(for_cui) & codes:
                    cui_has_reference = True
        if not cui_has_reference:
            del res[cui]

    return res


def cosynonym_codes(codes, coding_system, coding_systems):

    """Return a mapping from all CUIS that include the given `codes` of a
    `coding_system` to all codes in `coding_systems`.

    >>> cosynonym_codes(['C67.0'], 'ICD10CM', ['ICD10CM', 'RCD']) == {
    ...     'C0496826': {
    ...         'ICD10CM': {'C67.0'},
    ...         'RCD': {'X78ZS', 'B490.'}
    ...     }
    ... }
    True
    >>> cosynonym_codes(['G61z.'], 'RCD2', ['RCD2', 'ICD9CM' ]) == {
    ...     'C2937358': {
    ...       'ICD9CM': {'431'},
    ...       'RCD2': {'G6...', 'G61..', 'G61z.'}
    ...     }
    ... }
    True
    """

    original_coding_systems = coding_systems
    if coding_system == 'RCD2':
        coding_system = 'RCD'
        coding_systems = [ 'RCD' ] + [ c for c in coding_systems
                                       if c not in ['RCD', 'RCD2'] ]
        translation = translation_read_2to3(codes)
        codes = set(code for codes in translation.values() for code in codes)

    if not codes:
        return {}

    query = """
        select distinct c1.cui, c1.sab, c1.code
        from MRCONSO c1 inner join MRCONSO c2
        where c1.sab in %s
        and c1.cui = c2.cui
        and c2.sab = %s
        and c2.code in %s
    """

    # { cui: { voc: { code } } }
    res = defaultdict(lambda: defaultdict(set))

    with get_umls_db().cursor() as cursor:
        cursor.execute(query, (sorted(coding_systems), coding_system, sorted(codes)))
        for cui, coding_system, code in cursor.fetchall():
            res[cui][coding_system].add(code)

    if 'RCD2' in original_coding_systems:

        rcd3_codes = set()
        for cui in res:
            for coding_system in res[cui]:
                if coding_system == 'RCD':
                    rcd3_codes.update(res[cui][coding_system])

        backtranslation = translation_read_3to2(rcd3_codes)

        for cui in res:
            for coding_system in list(res[cui]):
                if coding_system == 'RCD':
                    codes3 = res[cui][coding_system]
                    codes2 = { code2 for code3 in codes3 for code2 in backtranslation[code3] }
                    res[cui]['RCD2'] = codes2
                    if 'RCD' not in original_coding_systems:
                        del res[cui]['RCD']
    for cui in list(res):
        for sab in list(res[cui]):
            if not res[cui][sab]:
                del res[cui][sab]
        if not res[cui]:
            del res[cui]

    return {
        cui: {
            coding_system: res[cui][coding_system]
            for coding_system in res[cui]
        }
        for cui in res
    }


if redo.running():

    project, event = redo.snippets
    project_path = redo.path / 'projects' / project

    with redo.ifchange(project_path / 'config.yaml') as f:
        config = yaml.load(f)
        databases = Databases.of_config(config)
    with redo.ifchange(project_path / 'events.yaml') as f:
        events = yaml.load(f)    
    with redo.ifchange(project_path / 'mappings.yaml') as f:
        mappings = Mappings.of_raw_data(yaml.load(f), events, databases)
        mappings = normalize.mappings(mappings, databases)
        mapping = mappings.get(event)

    cosynonyms = all_cosynonyms(mapping, databases)
    dnf = Dnf.of_cosynonyms(cosynonyms)
    assert cosynonyms == dnf.to_cosynonyms()
    
    with redo.output() as f:
        json.dump(dnf.to_data(), f)

if os.getenv('DOCTEST'):
    import doctest
    doctest.testmod(report=True)
