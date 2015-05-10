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
        # print('get_cuis_for_codes', ', '.join(codes), end='... ')
        query = "select distinct code, cui from MRCONSO where sab = %s and code in ({})" \
            .format(', '.join(['%s'] * len(codes)))
        with comap.umls_db.cursor() as cursor:
            cursor.execute(query, tuple([coding_system] + codes))
            for row in cursor.fetchall():
                code, cui = row
                res[code].add(cui)
        # print('found', sum(len(cuis) for cuis in res.values()))
    return res


def get_terms_for_cuis(cuis):
    res = defaultdict(lambda: [None, set()])
    if cuis:
        # print('get_terms_for_cuis', ', '.join(cuis), end='... ')
        query = "select distinct cui, str, ispref = 'Y' and ts = 'p' and stt = 'PF' as preferred from MRCONSO where cui in ({})" \
            .format(', '.join(['%s'] * len(cuis)))
        with comap.umls_db.cursor() as cursor:
            cursor.execute(query, tuple(cuis))
            for row in cursor.fetchall():
                cui, term, preferred = row
                if preferred:
                    res[cui][0] = term
                res[cui][1].add(termm)
        # print('found', sum(len(terms) for terms in res.values()))
    return res


def error_analysis(coding_system, codes):
    """
    { code: { "cuis": [ cui ], "terms": [ str ] } }
    """
    if coding_system == 'RCD2':
        coding_system = 'RCD'
        to_umls0 = comap.translation_read2_to_read3(codes)
        from_umls0 = {
            code: set(c for c, codes in to_umls0.items() if code in codes)
            for code in (c for cs in to_umls0.values() for c in cs)
        }
        to_umls = lambda code: to_umls0.get(code, set())
        from_umls = lambda code: from_umls0.get(code, set())
    else:
        to_umls = lambda code: set([code])
        from_umls = lambda code: set([code])
    umls_codes = sorted(set(code0
                            for code in codes
                            for code0 in to_umls(code)))

    cuis_for_codes = get_cuis_for_codes(coding_system, umls_codes)
    terms_for_cuis = get_terms_for_cuis([cui for cuis in cuis_for_codes.values() for cui in cuis])
    res = OrderedDict()
    for code in sorted(codes):
        res[code] = OrderedDict()
        cuis = set(cui for code0 in to_umls(code) for cui in cuis_for_codes[code0])
        for cui in sorted(cuis):
            terms = [term for term in terms_for_cuis[cui][1]]
            res[code][cui] = OrderedDict([
                ('name', terms_for_cuis[cui][0]),
                ('terms', sorted(terms))
            ])
    return res


error_analyses = OrderedDict()
for outcome_id in outcome_ids:
    error_analyses[outcome_id] = OrderedDict()
    for database_name, _ in databases.items():
        evaluation_for_database = evaluation[outcome_id][database_name]
        error_analyses[outcome_id][database_name] = OrderedDict()
        if 'variations' in evaluation_for_database:
            for this_variation_id, variation in evaluation_for_database['variations'].items():
                if this_variation_id == variation_id:
                    codes = variation['comparison']['codes']
                    res = OrderedDict([
                        ('FN', error_analysis(databases[database_name], codes['FN'])),
                    ])
                    error_analyses[outcome_id][database_name] = res

with redo.output() as f:
    yaml.dump(error_analyses, f)
