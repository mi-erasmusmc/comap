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

comap.evaluations_to_xls(redo.temp, evaluations, databases, )
