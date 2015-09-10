#!/usr/bin/env python3
from collections import OrderedDict, defaultdict
from pathlib import Path
import os
import yaml
import redo
import comap

project, variation_id = redo.base.split('.')
project_path = Path('projects') / project

with redo.ifchange(
        evaluation_config=project_path / 'evaluation-config.yaml',
        evaluations='{}.evaluations.yaml'.format(project, variation_id),
        references=(project_path / 'reference.yaml').as_posix()
) as files:
    evaluation_config = yaml.load(files['evaluation_config'])
    evaluations = yaml.load(files['evaluations'])
    references = yaml.load(files['references'])

databases = OrderedDict(evaluation_config['databases'])
outcome_ids = evaluation_config['outcome_ids']
mappings = {
    outcome_id: defaultdict(None, {
        database_id: set(m['inclusion'] + m.get('exclusion', []))
        for database_id in databases
        for m in [ references[database_id]['mappings'][outcome_id] ]
        if 'inclusion' in m
    })
    for outcome_id in outcome_ids
}


def get_cuis_for_codes(coding_system, codes):
    res = defaultdict(lambda: set())
    if codes:
        query = """
            select distinct cui, code from MRCONSO
            where sab = %s and code in %s
        """
        with comap.umls_db.cursor() as cursor:
            cursor.execute(query, (coding_system, codes))
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

    def in_all_databases(self, outcome_id, confusions):
        return None


class Terms(Analysis):

    def __init__(self, *positions):
        self.positions = list(positions)

    def in_database(self, outcome_id, database_id, coding_system, cm):
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


def get_false_negative_cuis(outcome_id, reference_variation_id='maximum-recall'):
    reference_cuis = evaluations['by-variant'][reference_variation_id]['by-outcome'][outcome_id]['generated-cuis']
    generated_cuis = evaluations['by-variant'][variation_id]['by-outcome'][outcome_id]['generated-cuis']
    print(sorted(reference_cuis), '-', sorted(generated_cuis), '=', sorted(set(reference_cuis) - set(generated_cuis)))
    return set(reference_cuis) - set(generated_cuis)


class NumberOfFalseNegatives(Analysis):

    def in_all_databases(self, outcome_id, confusions):
        cuis = get_false_negative_cuis(outcome_id)
        print(outcome_id, cuis)
        return len(cuis)


class ClustersInFalseNegatives(Analysis):

    def __init__(self, relations):
        self.relations = relations

    def in_all_databases(self, outcome_id, confusions):

        cuis = get_false_negative_cuis(outcome_id)
        relations = comap.relations_for_cuis(cuis, self.relations)
        connected_sets = comap.connected_sets(cuis, relations)

        return OrderedDict([
            ('count', len(connected_sets)),
            ('clusters', OrderedDict([
                (cui, sorted(connected_sets[cui]))
                for cui in sorted(connected_sets.keys())
            ])),
        ])


class TermsInFalseNegatives(Analysis):

    def in_all_databases(self, outcome_id, confusions):
        cuis = get_false_negative_cuis(outcome_id)
        terms_for_cuis = get_terms_for_cuis(cuis)
        return OrderedDict([
            (cui, [ name ] + sorted(term for term in terms if term != name))
            for cui, (name, terms) in terms_for_cuis.items()
        ])


def run_analyses(analyses):
    res = OrderedDict([
        ('by-outcome', OrderedDict())
    ])
    for outcome_id in outcome_ids:
        res_for_outcome = res['by-outcome'][outcome_id] = OrderedDict()
        by_database = evaluations['by-variant'][variation_id]['by-outcome'][outcome_id]['by-database']

        # All confusion matrices by database for the variation of the outcome
        confusions = {}
        for database_id in databases.keys():
            if by_database[database_id]:
                confusions[database_id] = by_database[database_id]['confusion']

        print(confusions)

        in_all_databases = OrderedDict()
        for analysis_id, analysis in analyses:
            analysis_result = analysis.in_all_databases(outcome_id, confusions)
            if analysis_result is not None:
                in_all_databases[analysis_id] = analysis_result
        if in_all_databases:
            res_for_outcome['analysis'] = in_all_databases

        # res_for_outcome['by-database'] = OrderedDict()
        # for database_id, coding_system in databases.items():
        #     res_for_database = res_for_outcome['by-database'][database_id] = OrderedDict()
        #     if by_database[database_id]:
        #         cm = by_database[database_id]['codes']
        #         for analysis_id, analysis in analyses:
        #             analysis_result = analysis.in_database(outcome_id, database_id, coding_system, cm)
        #             if analysis_result is not None:
        #                 res_for_database[analysis_id] = analysis_result
    return res

if os.getenv('DOCTEST'):
    import doctest
    doctest.testmod(comap, report=True)
    doctest.testmod(report=True)

analyses = [
    ('FN-count', NumberOfFalseNegatives()),
    ('FN-clusters-RN-CHD-RB-PAR', ClustersInFalseNegatives(['RN', 'CHD', 'RB', 'PAR'])),
    ('FN-terms', TermsInFalseNegatives()),
]

# dnfs = {}
# for outcome_id in outcome_ids:
#     cosynonyms = comap.all_cosynonyms(mappings[outcome_id], databases)
#     dnfs[outcome_id] = comap.create_dnf(mapping, cosynonyms, databases)

res = run_analyses(analyses)

with redo.output() as f:
    yaml.dump(res, f)
