#!/usr/bin/env python3
from collections import defaultdict, OrderedDict
from pathlib import Path
import json, yaml
import redo
from data import Databases, Evaluations, Mappings, Dnf, ErrorAnalysis, ErrorAnalysisFN
from utils import get_logger
from comap import get_client, known_codes, cui_names, translation_read_2to3

logger = get_logger(__name__)


def create_error_analyses(events, databases, mappings, dnfs,
                          evaluations, max_recall_evaluations,
                          residuals_info):
    error_analyses = defaultdict(dict)
    for event in events:
        mapping = mappings.get(event)
        for database in databases.databases():
            evaluation = evaluations[event][database]
            if evaluation:
                error_analysis = create_error_analysis_fn(event,
                                                          database,
                                                          dnfs[event],
                                                          evaluation,
                                                          max_recall_evaluations[event][database],
                                                          mapping.exclusion_codes(database),
                                                          residuals_info[database][event],
                                                          mapping)
            else:
                error_analysis = None
            error_analyses[database][event] = error_analysis
    return ErrorAnalysis(error_analyses)


def database_specific(code, database, databases, dnf, mapping):
    voc = databases.coding_system(database)
    return all(
        not (generated & reference)
        # All CUI sets that have `code`
        for cuis in dnf.cui_sets() if code in dnf.get(cuis).get(voc, set())
        # All *other* databases
        for database1 in databases.databases() if database1 != database
        for voc1 in [databases.coding_system(database1)]
        for reference in [mapping.codes(database1) or set()]
        for generated in [dnf.get(cuis).get(voc1, set())]
    )

                
def create_error_analysis_fn(event, database, dnf, evaluation,
                             max_recall_evaluation, exclusion_codes,
                             residuals_info, mapping):

    coding_system = databases.coding_system(database)
    
    tp, fp, fn = evaluation.tp, evaluation.fp, evaluation.fn
    #generated, reference = tp | fp, tp | fn
    
    known_fn = known_codes(fn, coding_system)

    fn_cuis = {
        cui for cuis, for_cuis in dnf.disjunction().items()
        if fn & for_cuis.get(coding_system, set())
        for cui in cuis
    }
    # {cui: {rel: [sourceConcept]}}
    relateds0 = get_client().related(fn_cuis, ['RN', 'CHD', 'RB', 'PAR'],
                                     databases.coding_systems())
    # {cui: {cui}}
    relateds = {
        cui: {sourceConcept['cui'] for sourceConcept in sourceConcepts}
        for cui in relateds0
        for sourceConcepts in relateds0[cui].values()
    }

    def categorize_fn(code):
        if code not in known_fn:
            return 'not-in-umls'
        # if code not in dnf.codes(coding_system):
        #     return 'not-in-dnf'
        if code in exclusion_codes:
            return 'exclusion'
        if any(evaluation.cuis & relateds.get(cui, set()) for cui in fn_cuis):
            return 'next-expansion'
        if database_specific(code, database, databases, dnf, mapping):
            return 'database-specific'
        if not any(relateds.get(cui) for cui in dnf.cuis(code, coding_system)):
            return 'isolated'
        if code in residuals_info:
            return residuals_info[code]['category']
        return None

    code_categories, unassigned = dict(), set()
    for code in fn:
        category = categorize_fn(code)
        if category:
            code_categories[code] = category
        else:
            unassigned.add(code)

    if unassigned:
        if coding_system == 'RCD2':
            t = translation_read_2to3(unassigned)
        names = cui_names(fn_cuis)
        def for_code(code):
            cuis = dnf.cuis(code, coding_system)
            res = OrderedDict([
                ('cuis', {
                    cui: OrderedDict([
                        ('name', names.get(cui, '?')),
                        ('relateds', ' '.join(relateds.get(cui, []))),
                    ])
                    for cui in cuis
                }),
            ])
            if coding_system == 'RCD2':
                res['RCD'] = list(t[code])
            return res
        unassigned = {
            code: for_code(code)
            for code in unassigned
        }

    return ErrorAnalysisFN(code_categories, unassigned)

if redo.running():
    project = redo.snippets[0]
    variation_id = '.'.join(redo.snippets[1:])
    project_path = Path('projects') / project

    with redo.ifchange(project_path / 'config.yaml') as f:
        config = yaml.load(f)
        databases = Databases.of_config(config)

    with redo.ifchange(project_path / 'events.yaml') as f:
        events = yaml.load(f)

    with redo.ifchange(project_path / 'mappings.yaml') as f:
        mappings = Mappings.of_raw_data_and_normalize(yaml.load(f), events, databases)

    with redo.ifchange(project_path / 'residuals-info.yaml') as f:
        data = yaml.load(f)
        residuals_info = {
            database: {
                event: data.get(database, {}).get(event, {})
                for event in events
            }
            for database in databases.databases()
        }

    with redo.ifchange({
            event: '{}.{}.dnf.json'.format(project, event)
            for event in events
    }) as files:
        dnfs = {
            event: Dnf.of_data(json.load(files[event]))
            for event in events
        }

    with redo.ifchange('{}.evaluations.json'.format(project)) as f:
        evaluations0 = Evaluations.of_data(json.load(f))
        evaluations = evaluations0.for_variation(variation_id, events, databases.databases())
        max_recall_evaluations = evaluations0.for_variation('max-recall', events, databases.databases())

        
    error_analyses = create_error_analyses(events, databases,
                                           mappings, dnfs,
                                           evaluations,
                                           max_recall_evaluations,
                                           residuals_info)
    with redo.output() as f:
        yaml.dump(error_analyses.to_data(), f, default_flow_style=False)
