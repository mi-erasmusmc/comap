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

variant_ids = [
    'baseline',
    'expand-to-ref-RN-CHD-RB-PAR',
]

with redo.ifchange(evaluation_config=project_path / 'evaluation-config.yaml',
                   max_recall_evaluation='{}.{}.max-recall-dnf.yaml'.format(project, outcome_id),
                   variant_evaluations=[
                       '{}.{}.evaluation.yaml'.format(project, variant_id)
                       for variant_id in variant_ids
                   ]) \
        as files:
    evaluation_config = yaml.load(files['evaluation_config'])
    reference_dnf = yaml.load(files['max_recall_evaluation'])['dnf']
    varied_generated_cuis = OrderedDict([
        (variant_id, yaml.load(f)['by-outcome'][outcome_id]['generated-cuis'])
        for variant_id, f in zip(variant_ids, files['variant_evaluations'])
    ])


def create_result(generated_cuis, reference_dnf):
    reference_cuis = set()
    for cuis in reference_dnf:
        intersection = set(generated_cuis) & set(cuis)
        if intersection:
            reference_cuis.update(intersection)
        else:
            reference_cuis.add(cuis[0])
    print(reference_cuis)
    confusion = comap.confusion_matrix(generated_cuis, reference_cuis)
    measures = comap.measures(generated=generated_cuis, reference=reference_cuis)
    return OrderedDict([
        ('confusion', confusion),
        ('measures', measures),
    ])


def create_results(varied_generated_cuis, reference_dnf):
    res = OrderedDict([
        ('by-variant', OrderedDict())
    ])
    for variant_id in varied_generated_cuis:
        generated_cuis = varied_generated_cuis[variant_id]
        res['by-variant'][variant_id] = create_result(generated_cuis, reference_dnf)
    return res


result = create_results(varied_generated_cuis, reference_dnf)

with redo.output() as f:
    yaml.dump(result, f)
