#!/usr/bin/env python3
from collections import OrderedDict, defaultdict
from pathlib import Path
import os
import json
import yaml
import re
import redo
redo.ifchange('comap.py'); import comap

project, outcome_id = redo.base.split('.')

project_path = Path('projects') / project

with redo.ifchange(
    baseline="safeguard.baseline.evaluation.yaml",
    evaluation_config=project_path / "evaluation-config.yaml"
) as files:
    baseline = yaml.load(files['baseline'])
    evaluation_config = yaml.load(files['evaluation_config'])

outcome_ids = evaluation_config['outcome_ids']

if outcome_id == "ALL":
    redo.delegate(**{
        outcome_id: '{}-{}.max-recall-dnf.yaml'.format(project, outcome_id)
        for outcome_id in outcome_ids
    })
    exit()

databases = OrderedDict(evaluation_config['databases'])

coding_systems = sorted(set(databases.values()))

mapping = {}
for database_id in databases.keys():
    confusion = baseline['by-outcome'][outcome_id]['by-database'][database_id]['codes']
    codes = confusion['TP'] + confusion['FN']
    mapping[database_id] = codes

def create_dnf(cosynonyms, mapping):
    res = defaultdict(lambda: defaultdict(set))
    for database_id in databases:
        codes = mapping.get(database_id)
        if codes is not None:
            for code in codes:
                cuis = []
                for cui in cosynonyms:
                    if code in cosynonyms[cui].get(databases[database_id], []):
                        cuis.append(cui)
                if cuis:
                    res[frozenset(cuis)][databases[database_id]].add(code)
    return [
        sorted(cuis)
        # OrderedDict([
        #     ('cuis', sorted(cuis)),
        #     ('codes', OrderedDict([
        #         (voc, sorted(res[cuis][voc]))
        #         for voc in res[cuis]
        #     ])),
        # ])
        for cuis in res
    ]

cosynonyms = comap.all_cosynonyms(mapping, databases)
dnf = create_dnf(cosynonyms, mapping)

# synonyms = {
#     code + ('*' if code in codes else '')
#     for code in cosynonyms[cui][coding_system]
# }

result = OrderedDict([
    ('mapping', OrderedDict([
        (database_id, sorted(mapping[database_id]))
        for database_id in mapping
    ])),
    ('cosynonyms', OrderedDict([
        (cui, OrderedDict([
            (voc, [
                code + (
                    '*' if any(code in mapping[db]
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
