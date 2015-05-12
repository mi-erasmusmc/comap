#!/usr/bin/env python3
from collections import OrderedDict, defaultdict
import yaml
from pathlib import Path
import pandas as pd
import pymysql
import redo
import comap # For YAML loader/constructor

project, variation_id = redo.base.split('.')
project_path = Path('projects') / project

with redo.ifchange(
        evaluation_config=project_path / 'evaluation-config.yaml',
        evaluation=project + '.evaluation.yaml'
) as files:
    evaluation_config = yaml.load(files['evaluation_config'])
    evaluation = yaml.load(files['evaluation'])

databases = OrderedDict(evaluation_config['databases'])
outcome_ids = evaluation_config['outcome_ids']


def get_cuis_for_codes(coding_system, codes):
    res = defaultdict(lambda: set())
    if codes:
        query = "select distinct code, cui from MRCONSO where sab = %s and code in ({})" \
            .format(', '.join(['%s'] * len(codes)))
        with comap.umls_db.cursor() as cursor:
            cursor.execute(query, tuple([coding_system] + list(codes)))
            for row in cursor.fetchall():
                code, cui = row
                res[code].add(cui)
    return res


def get_terms_for_cuis(cuis):
    res = defaultdict(lambda: [None, set()])
    if cuis:
        query = "select distinct cui, str, ispref = 'Y' and ts = 'p' and stt = 'PF' as preferred from MRCONSO where cui in ({})" \
            .format(', '.join(['%s'] * len(cuis)))
        with comap.umls_db.cursor() as cursor:
            cursor.execute(query, tuple(cuis))
            for row in cursor.fetchall():
                cui, term, preferred = row
                if preferred:
                    res[cui][0] = term
                res[cui][1].add(term)
    return res


def error_analysis(coding_system, codes):
    """
    { code: { cui: {"name": str, "terms": { str } } }
    """

    original_coding_system = coding_system
    if original_coding_system == 'RCD2':
        coding_system = 'RCD'
        translations = comap.translation_read_2to3(codes)
        codes = set(code0
                    for code in codes
                    for code0 in translations.get(code, []))

    cuis_for_codes = get_cuis_for_codes(coding_system, codes)
    terms_for_cuis = get_terms_for_cuis([
        cui for cuis in cuis_for_codes.values() for cui in cuis
    ])

    if original_coding_system == 'RCD2':
        backtranslation = comap.translation_read_3to2(codes)
        # codes = set(code0
        #             for code in codes
        #             for code0 in backtranslation[code])

    res = OrderedDict()
    if original_coding_system == 'RCD2':
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


error_analyses = OrderedDict()
for outcome_id in outcome_ids:
    error_analyses[outcome_id] = OrderedDict()
    for database_name, _ in databases.items():
        evaluation_for_database = evaluation[outcome_id][database_name]
        error_analyses[outcome_id][database_name] = OrderedDict()
        if 'variations' in evaluation_for_database:
            variation = next(
                variation
                for id, variation in  evaluation_for_database['variations'].items()
                if id == variation_id
            )
            codes = variation['comparison']['codes']
            res = OrderedDict([
                ('FN', error_analysis(databases[database_name], codes['FN']))
            ])
            error_analyses[outcome_id][database_name] = res

with redo.output() as f:
    yaml.dump(error_analyses, f)
