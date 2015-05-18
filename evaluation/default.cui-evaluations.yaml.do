#!/usr/bin/env python3
from collections import OrderedDict, defaultdict
from pathlib import Path
import os
import json
import yaml
import re
import redo
redo.ifchange('comap.py'); import comap

project = redo.base
project_path = Path('projects') / project

with redo.ifchange(evaluation_config=project_path / 'evaluation-config.yaml',
                   max_recall_evaluation='{}.maximum-recall.evaluation.yaml'.format(project),
                   baseline_evaluation='{}.baseline.evaluation.yaml'.format(project)) \
        as files:
    evaluation_config = yaml.load(files['evaluation_config'])
    max_recall_evaluation = yaml.load(files['max_recall_evaluation'])
    baseline_evaluation = yaml.load(files['baseline_evaluation'])

outcome_ids = evaluation_config['outcome_ids']


class Variant(object):

    def vary(self, generated, reference):
        """Compute a variation of the generated CUIs."""
        return generated


def create_result(generated, reference, variant, outcome_id):

    generated = variant.vary(generated, reference)

    confusion = comap.confusion_matrix(generated, reference)
    measures = comap.measures(generated=generated, reference=reference)
    return OrderedDict([
        ('confusion', confusion),
        ('measures', measures),
    ])


def create_results(generated, references, variants, outcome_ids):
    res = OrderedDict([
        ('by-variant', OrderedDict())
    ])
    for variant_id, variant in variants.items():
        res_for_variant = res['by-variant'][variant_id] = OrderedDict([
            ('by-outcome', OrderedDict())
        ])
        for outcome_id in outcome_ids:
            res_for_outcome = create_result(generated[outcome_id], references[outcome_id], variant, outcome_id)
            res_for_variant['by-outcome'][outcome_id] = res_for_outcome
    return res

variants = OrderedDict([
    ('baseline', Variant())
])

generated = OrderedDict([
    (outcome_id, value['generated-cuis'])
    for outcome_id, value in baseline_evaluation['by-outcome'].items()
])

references = OrderedDict([
    (outcome_id, value['generated-cuis'])
    for outcome_id, value in max_recall_evaluation['by-outcome'].items()
])

result = create_results(generated, references, variants, outcome_ids)

with redo.output() as f:
    yaml.dump(result, f)
