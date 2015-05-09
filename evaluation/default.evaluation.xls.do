#!/usr/bin/env python3
from collections import OrderedDict
import yaml
from pathlib import Path
import pandas as pd
import redo

project = redo.base
project_path = Path('projects') / project

with redo.ifchange(evaluation_config=project_path / 'evaluation-config.yaml',
                   evaluation=redo.target.replace('.xls', '.yaml')) as files:
    evaluation_config = yaml.load(files['evaluation_config'])
    evaluations = yaml.load(files['evaluation'])

databases = OrderedDict(evaluation_config['databases'])
outcome_ids = evaluation_config['outcome_ids']

casedef_paths = {
    outcome_id: project_path / 'case-definitions' / (outcome_id + '.yaml')
    for outcome_id in outcome_ids
}

with redo.ifchange(casedefs=casedef_paths) as files:
    outcomes = {
        outcome_id: yaml.load(f)
        for outcome_id, f in files['casedefs'].items()
    }


def evaluations_to_xls(filename, evaluations, outcomes=None, databases=None):

    """
    evaluations ::= { outcome_id: { database: {variations?: [variation], comment?: str} } }
    variation = { name: str, comparison: comparison }
    comparison ::= { codes: { TP, FP, FN: codes }, measures: { recall, precision: float } }
    """

    outcome_ids = list(evaluations.keys())
    database_names = list(evaluations[outcome_ids[0]].keys()
                          if databases is not None else
                          databases.keys())
    for database_name in database_names:
        for_database = evaluations[outcome_ids[0]][database_name]
        if 'variations' in for_database:
            variations = [variation['name'] for variation in for_database['variations']]
            break

    columns_per_database = ['TP', 'FP', 'FN', 'recall', 'precision']
    columns = pd.MultiIndex.from_tuples([
        (database_name
         if databases is None else
         '{} ({})'.format(database_name, databases[database_name]),
         c)
        for database_name in database_names
        for c in columns_per_database
    ] + [('Average over databases', 'recall'), ('Average over databases', 'precision')])

    str_of_list = lambda v: ' '.join(str(v0) for v0 in v)
    index, rows = [], []

    for variation_ix, variation_name in enumerate(variations):
        if variation_ix:
            index.extend(['', ''])
            rows.extend([[None] * len(columns)] * 2)
        index.append(variation_name)
        rows.append([None] * len(columns))
        measures_over_outcomes = {
            database_name: pd.DataFrame(columns=['recall', 'precision'])
            for database_name in database_names
        }
        for outcome_id in outcome_ids:
            row = []
            measures_over_databases = pd.DataFrame(columns=['recall', 'precision'])
            for database_name in database_names:
                for_database = evaluations[outcome_id][database_name]
                if 'variations' in for_database:
                    variation = for_database['variations'][variation_ix]
                    assert variation['name'] == variation_name, \
                        (variation['name'], variation_name)
                    codes, measures = (variation['comparison'][key] for key in ('codes', 'measures'))
                    measures_over_databases.ix[database_name] = measures
                    measures_over_outcomes[database_name].ix[outcome_id] = measures
                    row.extend([
                        str_of_list(codes['TP']),
                        str_of_list(codes['FP']),
                        str_of_list(codes['FN']),
                        measures['recall'],
                        measures['precision'],
                    ])
                else:
                    row.extend([for_database.get('comment')] + [None] * (len(columns_per_database) - 1))
            if len(measures_over_databases):
                average = measures_over_databases.sum() / len(measures_over_databases)
                row.extend([average['recall'], average['precision']])
            else:
                row.extend([None, None])
            index.append(outcomes[outcome_id]['name'] if outcomes else outcome_id)
            rows.append(row)

        row = []
        for database_name in database_names:
            measures = measures_over_outcomes[database_name]
            average = measures.sum() / len(measures)
            row.extend([None] * (len(columns_per_database)-2) + [average['recall'], average['precision']])
        index.append('Average over outcomes')
        rows.append(row)

    writer = pd.ExcelWriter(filename)
    df = pd.DataFrame(rows, index=pd.Index(index), columns=columns)
    df.to_excel(writer, float_format='%.2f')
    writer.save()

evaluations_to_xls(redo.temp, evaluations,
                   databases=databases,
                   outcomes=outcomes)
