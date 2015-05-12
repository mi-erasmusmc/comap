#!/usr/bin/env python3
from collections import OrderedDict, defaultdict
from pathlib import Path
import os
import yaml
import pandas as pd
import pymysql
import redo
redo.ifchange('comap.py'); import comap

project, variation_id = redo.base.split('.')
project_path = Path('projects') / project

with redo.ifchange(
        evaluation_config=project_path / 'evaluation-config.yaml',
        evaluation=project + '.evaluation.yaml'
) as files:
    evaluation_config = yaml.load(files['evaluation_config'])
    evaluations = yaml.load(files['evaluation'])

databases = OrderedDict(evaluation_config['databases'])
outcome_ids = evaluation_config['outcome_ids']


def get_cuis_for_codes(coding_system, codes):
    res = defaultdict(lambda: set())
    if codes:
        query = """
            select distinct cui, code from MRCONSO
            where sab = %s and code in %s
        """
        with comap.umls_db.cursor() as cursor:
            cursor.execute(query, tuple(coding_system, codes))
            for cui, code in cursor.fetchall():
                res[code].add(cui)
    return res


def get_terms_for_cuis(cuis):
    res = defaultdict(lambda: [None, set()])
    if cuis:
        query = """
            select distinct cui, str, ispref = 'Y' and ts = 'P' and stt = 'PF' as preferred
            from MRCONSO where cui in %s
        """
        with comap.umls_db.cursor() as cursor:
            cursor.execute(query, (cuis))
            for cui, term, preferred in cursor.fetchall():
                if preferred:
                    res[cui][0] = term
                res[cui][1].add(term)
    return res


class Analysis(object):

    def in_database(self, outcome_id, database_id, coding_system, cm):
        return None

    def in_all_databases(self, outcome_id, cms):
        return None


class Terms(Analysis):

    def __init__(self, *positions):
        self.positions = list(positions)


    def in_database(outcome_id, database_id, coding_system, cm):
        """
        { code: { cui: {"name": str, "terms": { str } } }
        """
        codes = set()
        for position in self.positions:
            codes.update(cm[position])

        original_coding_system = coding_system
        if original_coding_system == 'RCD2':
            coding_system = 'RCD'
            translations = comap.translation_read_2to3(codes)
            codes = {
                code0
                for code in codes
                for code0 in translations.get(code, [])
            }

        cuis_for_codes = get_cuis_for_codes(coding_system, codes)
        terms_for_cuis = get_terms_for_cuis({
            cui
            for cuis in cuis_for_codes.values()
            for cui in cuis
        })

        res = OrderedDict()
        if original_coding_system == 'RCD2':
            backtranslation = comap.translation_read_3to2(codes)
            code_pairs = [
                (code, code2)
                for code in codes
                for code2 in backtranslation.get(code, [])
            ]
        else:
            code_pairs = [ (code, code) for code in codes ]

        for code, code2 in code_pairs:
            res[code2] = OrderedDict()
            for cui in sorted(cuis_for_codes[code]):
                name, terms = [term for term in terms_for_cuis[cui]]
                res[code2][cui] = sorted(terms)
        return res


class Clusters(Analysis):

    def __init__(self, positions, relations):
        self.positions = positions
        self.relations = relations

    def in_all_databases(self, outcome_id, cms):

        mapping = {}
        for database_id in databases.keys():
            mapping[database_id] = set()
            if database_id in cms:
                for position in self.positions:
                    mapping[database_id].update(cms[database_id][position])

        cuis = comap.mapping_to_max_recall_cuis(databases, mapping)
        relations = comap.relations_for_cuis(cuis, self.relations)
        connected_sets = comap.connected_sets(cuis, relations)
        # terms_for_cuis = get_terms_for_cuis(cuis)

        res = OrderedDict([
            ('max-sensitivity-cuis', len(cuis)),
            ('transitivity-sets', len(connected_sets)),
        ])
        # res = OrderedDict()
        # for root, connected in connected_sets.items():
            # res[root] = list()
            # for cui in [root] + [cui0 for cui0 in connected if cui0 != root]:
            #     res[root].append(OrderedDict([
            #         ('cui', cui),
            #         ('name', terms_for_cuis[cui][0] or next(terms_for_cuis[cui])),
            #     ]))
        return res


def run_analyses(analyses):
    res = OrderedDict()
    for outcome_id in outcome_ids:
        res[outcome_id] = OrderedDict()

        cms = {}
        for database_id in databases.keys():
            for_database = evaluations[outcome_id][database_id]
            if 'variations' in for_database:
                cms[database_id] = for_database['variations'][variation_id]['comparison']['codes']

        in_all_databases = OrderedDict()
        for analysis_id, analysis in analyses:
            analysis_result = analysis.in_all_databases(outcome_id, cms)
            if analysis_result is not None:
                in_all_databases[analysis_id] = analysis_result
        if in_all_databases:
            res[outcome_id]['analysis'] = in_all_databases

        for database_id, coding_system in databases.items():
            res[outcome_id][database_id] = OrderedDict()
            evaluation = evaluations[outcome_id][database_id]
            if 'variations' in evaluation:
                this_variation_id, variation = next(
                    (this_variation_id, variation)
                    for this_variation_id, variation in  evaluation['variations'].items()
                    if this_variation_id == variation_id
                )
                cm = variation['comparison']['codes']
                for analysis_id, analysis in analyses:
                    analysis_result = analysis.in_database(outcome_id, database_id, coding_system, cm)
                    if analysis_result is not None:
                        res[outcome_id][database_id]['analysis'][analysis_id] = analysis_result
    return res

if os.getenv('DOCTEST'):
    import doctest
    doctest.testmod(comap, report=True)
    doctest.testmod(report=True)

analyses = [
#    ('FN-terms', Terms('FN')),
    ('FN-clusters-RN-CHD-RB-PAR', Clusters(['FN'], ['RN', 'CHD', 'RB', 'PAR'])),
]

res = run_analyses(analyses)

with redo.output() as f:
    yaml.dump(res, f)
