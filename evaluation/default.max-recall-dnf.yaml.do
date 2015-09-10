#!/usr/bin/env python3
from collections import OrderedDict, defaultdict
from pathlib import Path
import os
import json
import yaml
import re
import redo
import comap

project, outcome_id = redo.base.split('.')
project_path = Path('projects') / project

with redo.ifchange(
    baseline="{}.baseline.evaluation.yaml".format(project),
    evaluation_config=project_path / "evaluation-config.yaml"
) as files:
    baseline = yaml.load(files['baseline'])
    evaluation_config = yaml.load(files['evaluation_config'])

outcome_ids = evaluation_config['outcome_ids']
databases = OrderedDict(evaluation_config['databases'])
coding_systems = sorted(set(databases.values()))

if outcome_id == "ALL":
    redo.delegate([
        '{}-{}.max-recall-dnf.yaml'.format(project, outcome_id)
        for outcome_id in outcome_ids
    ])
    exit()


def get_mapping(baseline_variation, databases):
    res = {}
    for database_id in databases:
        for_database = baseline_variation['by-outcome'][outcome_id]['by-database'].get(database_id)
        if for_database:
            codes = for_database['confusion']['TP'] + \
                    for_database['confusion']['FN']
            res[database_id] = codes
    return res


mapping = get_mapping(baseline_variation, databases)
cosynonyms = comap.all_cosynonyms(mapping, databases)
dnf = [sorted(cuis) for cuis in comap.create_dnf(mapping, cosynonyms)]

result = OrderedDict([
    ('mapping', OrderedDict([
        (database_id, sorted(mapping[database_id]))
        for database_id in mapping
    ])),
    ('cosynonyms', OrderedDict([
        (cui, OrderedDict([
            (voc, [
                code + (
                    '*' if any(code in mapping.get(db, [])
                               for db in databases
                               if databases[db] == voc) else ''
                )
                for code in cosynonyms[cui][voc]
            ])
            for voc in cosynonyms[cui]
            if cosynonyms[cui][voc]
        ]))
        for cui in sorted(cosynonyms)
    ])),
    ('dnf', dnf),
])

with redo.output() as f:
    yaml.dump(result, f)
