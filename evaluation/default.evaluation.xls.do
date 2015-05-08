#!/usr/bin/env python3
import yaml
from pathlib import Path
import pandas as pd
import redo
import comap

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

comap.evaluations_to_xls(evaluations, databases, outcome_ids, redo.temp, outcomes)

# columns_per_database = ['TP', 'FP', 'FN', 'recall', 'precision']
# columns = pd.MultiIndex.from_tuples([
#     ('{} ({})'.format(database, coding_system), c)
#     for database, coding_system in databases
#     for c in columns_per_database
# ])

# index, rows = [], []
# for ix, (heading, results) in enumerate(evaluations.items()):
#     str_of_list = lambda v: ' '.join(str(v0) for v0 in v)
#     if ix:
#         index.extend(['', ''])
#         rows.extend([[None] * len(columns)] * 2)
#     index.append(heading)
#     rows.append([None] * len(columns))
#     for outcome_id in outcome_ids:
#         row = []
#         for database, _ in databases:
#             comparison = results[outcome_id][database]
#             if comparison is None:
#                 row.extend([None] * len(columns_per_database))
#             else:
#                 row.extend([
#                     str_of_list(comparison['codes']['TP']),
#                     str_of_list(comparison['codes']['FP']),
#                     str_of_list(comparison['codes']['FN']),
#                     comparison['measures']['recall'],
#                     comparison['measures']['precision'],
#                 ])
#         index.append(outcomes[outcome_id]['name'])
#         rows.append(row)

# writer = pd.ExcelWriter(redo.temp)
# df = pd.DataFrame(rows, index=pd.Index(index), columns=columns)
# df.to_excel(writer, float_format='%.2f')
# writer.save()
