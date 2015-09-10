#!/usr/bin/env python3
from collections import OrderedDict
from pathlib import Path
import yaml
import redo
import comap

project = redo.base
project_path = Path('projects') / project

with redo.ifchange(evaluation_config=project_path / 'evaluation-config.yaml') \
        as files:
    evaluation_config = yaml.load(files['evaluation_config'])

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

with redo.ifchange(cui_evaluations=['{}.{}.cui-evaluation.yaml'.format(project, outcome_id)
                                    for outcome_id in outcome_ids])\
        as files:
    cui_evaluations = OrderedDict([
        (outcome_id, yaml.load(f))
        for outcome_id, f in zip(outcome_ids, files['cui_evaluations'])
    ])

evaluations = OrderedDict([('by-variant', OrderedDict())])
for outcome_id, cui_evaluation in cui_evaluations.items():
    for variant_id, for_variant in cui_evaluation['by-variant'].items():
        if variant_id not in evaluations['by-variant']:
            evaluations['by-variant'][variant_id] = OrderedDict([('by-outcome', OrderedDict())])
        if outcome_id not in evaluations['by-variant'][variant_id]['by-outcome']:
            evaluations['by-variant'][variant_id]['by-outcome'][outcome_id] = OrderedDict([('by-database', OrderedDict())])
        evaluations['by-variant'][variant_id]['by-outcome'][outcome_id]['by-database']['UMLS'] = OrderedDict([
            ('confusion', for_variant['confusion']),
            ('measures', for_variant['measures']),
        ])

comap.evaluations_to_xls(redo.temp, evaluations, ['UMLS'], outcomes, show_generated_cuis=False)
