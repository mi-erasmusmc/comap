#!/usr/bin/env python3
from pathlib import Path
import pandas as pd
import json, yaml
import logging
import redo
from data import Databases

logger = logging.getLogger(__name__)

def average_and_format(df, variation_ids, events, databases):
    databases_with_coding_systems = {
        database: '{} ({})'.format(database, databases.coding_system(database))
        for database in databases.databases()
    }
    columns = pd.MultiIndex.from_tuples([('', 'variation'), ('', 'event'), ('Generated', 'cuis')] + [
        (databases_with_coding_systems[database], column)
        for database in databases.databases()
        for column in ['generated', 'reference', 'TP', 'FP', 'FN', 'recall', 'precision']
    ] + [('Average', 'recall'), ('Average', 'precision')])
    
    def format_list(v):
        if v != v: # is nan
            return v
        else:
            assert type(v) == str
            li = json.loads(v)
            return len(li)
    
    result = pd.DataFrame(columns=columns)
    for variation in variation_ids:
        variation_data = []
        for event in events:
            cuis = df[(df['variation'] == variation) & (df['event'] == event)].iloc[0].cuis
            row = [variation, event, format_list(cuis)]
            recalls, precisions = [], []
            for database in databases.databases():
                s = df[(df['variation'] == variation) & (df['event'] == event) & (df['database'] == database)].iloc[0]
                recalls.append(s['recall'])
                precisions.append(s['precision'])
                for col in ['generated', 'reference', 'tp', 'fp', 'fn']:
                    row.append(format_list(s[col]))
                row += [s['recall'], s['precision']]
            recall = pd.Series(recalls).mean()
            precision = pd.Series(precisions).mean()
            row += [recall, precision]
            variation_data.append(row)
        for_variation = pd.DataFrame(data=variation_data, columns=columns)
        average_row = [variation, 'Average', '']
        for database in databases.databases():
            recall = for_variation[(databases_with_coding_systems[database], 'recall')].mean()
            precision = for_variation[(databases_with_coding_systems[database], 'precision')].mean()
            average_row += ['', '', '', '', '', recall, precision]
        average_row += [
            for_variation[('Average', 'recall')].mean(),
            for_variation[('Average', 'precision')].mean(),
        ]
        for_variation.ix[len(for_variation)] = average_row
        # header_row = pd.DataFrame([[variation] + ([''] * (len(columns)-1))], columns=columns)
        # for_variation = pd.concat([header_row, for_variation])
        result = result.append(for_variation)
    return result.set_index([('', 'variation'), ('', 'event')])

if redo.running():

    (project,) = redo.snippets
    project_path = Path('projects') / project

    with redo.ifchange(project_path / 'config.yaml') as f:
        config = yaml.load(f)
        databases = Databases.of_config(config)
    with redo.ifchange(project_path / 'events.yaml') as f:
        events = yaml.load(f)
    with redo.ifchange(project_path / 'variations.yaml') as f:
        variation_ids = yaml.load(f)
    with redo.ifchange('{}.evaluations.csv'.format(project)) as f:
        df = pd.read_csv(f)

    df = average_and_format(df, variation_ids, events, databases)

    df.to_excel(redo.temp) #float_format='%.2f'
