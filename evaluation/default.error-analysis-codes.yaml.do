#!/usr/bin/env python3
from collections import OrderedDict, defaultdict
from itertools import chain
import os
import re
import yaml
from pathlib import Path
import pandas as pd
import redo
redo.ifchange('comap.py'); import comap

project, evaluation_name = redo.base.split('.')
project_path = Path('projects') / project

with redo.ifchange(
        evaluation_config=project_path / 'evaluation-config.yaml',
        evaluation=project + '.evaluation.yaml') as files:
    evaluation_config = yaml.load(files['evaluation_config'])
    evaluations = yaml.load(files['evaluation'])[evaluation_name]

databases = evaluation_config['databases']
outcome_ids = evaluation_config['outcome_ids']

hierarchies = {
    'ICD9CM': comap.RegexHierarchy('DDD'),
    'ICD10CM': comap.RegexHierarchy('LDD'),
    'ICPC': comap.RegexHierarchy('LDD'),
}


def error_analysis(hierarchy, codes):

    related_codes, derivated_codes = comap.normalize_related(hierarchy, codes)
    measures = comap.measures(codes=related_codes, f=lambda f: round(f, 2))

    original_codes_with_derivated = OrderedDict(codes.items())
    for key, codes_by_rel in derivated_codes.items():
        original_codes_with_derivated[key] = OrderedDict()
        for rel, codes in codes_by_rel.items():
            original_codes_with_derivated[key][rel] = list(codes)

    return OrderedDict([
        ('codes', OrderedDict([(key, sorted(related_codes[key]))
                               for key in related_codes.keys()])),
        ('measures', measures),
        ('original-codes', original_codes_with_derivated),
    ])

if os.getenv('DOCTEST'):
    import doctest
    doctest.testmod()

error_analyses = OrderedDict()
for outcome_id in outcome_ids:
    error_analyses[outcome_id] = OrderedDict()
    for database, coding_system in databases:
        codes = evaluations[outcome_id][database]['codes']
        analysis = error_analysis(hierarchies[coding_system], codes)
        error_analyses[outcome_id][database] = analysis

with redo.output() as f:
    yaml.dump(error_analyses, f)

comap.evaluations_to_xls({ evaluation_name: error_analyses },
                         databases, outcome_ids,
                         redo.target.replace('.yaml', '.xls'))


