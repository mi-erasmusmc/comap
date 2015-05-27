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

variation_ids = [
    'baseline',
    'maximum-recall',
    # 'maximum-precision',
    # '3-letter-codes',
    # 'expand-to-ref-RN-RB',
    # 'expand-to-ref-CHD-PAR',
    # 'expand-to-ref-RN-CHD',
    # 'expand-to-ref-RB-PAR',
    # 'expand-to-ref-RN-CHD-RB-PAR',
    # 'expand-to-ref-SIB-SY-RQ',
    'expand-1-to-dnf-RN-RB',
    'expand-1-to-dnf-CHD-PAR',
    'expand-1-to-dnf-RN-CHD',
    'expand-1-to-dnf-RB-PAR',
    'expand-1-to-dnf-RN-CHD-RB-PAR',
    'expand-2-to-dnf-RN-CHD-RB-PAR',
    'expand-3-to-dnf-RN-CHD-RB-PAR',
]

evaluation_filenames = [
    '{}.{}.evaluation.yaml'.format(project, variation_id)
    for variation_id in variation_ids
]

with redo.ifchange(evaluation_files=evaluation_filenames) as files:
    evaluations = {
        'by-variant': OrderedDict([
            (variation_id, yaml.load(f))
            for variation_id, f in zip(variation_ids, files['evaluation_files'])
        ])
    }

with redo.output() as f:
    yaml.dump(evaluations, f)

