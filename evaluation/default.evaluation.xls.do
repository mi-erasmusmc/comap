#!/usr/bin/env python3
from collections import OrderedDict
import yaml
from pathlib import Path
import pandas as pd
import redo
import comap # Just for the YAML converters

project = redo.base
project_path = Path('projects') / project

with redo.ifchange(evaluation_config=project_path / 'evaluation-config.yaml',
                   evaluation=redo.target.replace('.xls', '.yaml')) as files:
    evaluation_config = yaml.load(files['evaluation_config'])
    evaluations = yaml.load(files['evaluation'])

databases = evaluation_config['databases']
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
    variation = { name: str, comparison: comparison }
    comparison ::= { codes: { TP, FP, FN: codes }, measures: { recall, precision: float } }
    """

    columns_per_database = ['TP', 'FP', 'FN', 'precision', 'recall']
    columns = pd.MultiIndex.from_tuples(
        [('Generated', 'CUIs')] + [
            ('{} ({})'.format(database_id, coding_system), c)
            for database_id, coding_system in databases
            for c in columns_per_database
        ] + [
            ('Average over databases', 'recall'),
            ('Average over databases', 'precision'),
        ]
    )

    str_of_list = lambda v: '{}: {}'.format(len(v), ' '.join(str(v0) for v0 in v))
    index, rows = [], []

    def average_if_notnull(series):
        series = series[series.notnull()]
        if len(series):
            return series.sum() / len(series)
        else:
            return None

    for variation_ix, variation_id in enumerate(evaluations['by_variation'].keys()):
        for_variation = evaluations['by_variation'][variation_id]
        if 0 < variation_ix:
            index.extend(['', ''])
            rows.extend([[None] * len(columns)] * 2)
        index.append(variation_id)
        rows.append([for_variation['name']] + [None] * (len(columns) - 1))
        measures_over_outcomes = {
            database_id: pd.DataFrame(columns=['recall', 'precision'])
            for database_id, _ in databases
        }
        for outcome_id in outcome_ids:
            for_outcome = for_variation['by_outcome'][outcome_id]
            row = [str_of_list(for_outcome['generated-cuis'])]
            measures_over_databases = pd.DataFrame(columns=['recall', 'precision'])
            for database_id, _ in databases:
                comparison = for_outcome['comparisons'][database_id]
                if comparison:
                    codes, measures = comparison['codes'], comparison['measures']
                    measures_over_databases.ix[database_id] = measures
                    measures_over_outcomes[database_id].ix[outcome_id] = measures
                    row.extend([
                        str_of_list(codes['TP']),
                        str_of_list(codes['FP']),
                        str_of_list(codes['FN']),
                        measures['precision'],
                        measures['recall'],
                    ])
                else:
                    row.extend([None] * len(columns_per_database))
                    # row.extend([for_database.get('comment')] + [None] * (len(columns_per_database) - 1))
            if len(measures_over_databases):
                precision = average_if_notnull(measures_over_databases.precision)
                recall = average_if_notnull(measures_over_databases.recall)
                row.extend([precision, recall])
            else:
                row.extend([None, None])
            index.append(outcomes[outcome_id]['name'] if outcomes else outcome_id)
            rows.append(row)

        row = [None]
        for database_id, _ in databases:
            precision = average_if_notnull(measures_over_outcomes[database_id].precision)
            recall = average_if_notnull(measures_over_outcomes[database_id].recall)
            row.extend([None] * (len(columns_per_database)-2) + [precision, recall])
        index.append('Average over outcomes')
        rows.append(row)

    writer = pd.ExcelWriter(filename)
    df = pd.DataFrame(rows, index=pd.Index(index), columns=columns)
    df.to_excel(writer, float_format='%.2f')
    writer.save()

evaluations_to_xls(redo.temp, evaluations,
                   databases=databases,
                   outcomes=outcomes)
