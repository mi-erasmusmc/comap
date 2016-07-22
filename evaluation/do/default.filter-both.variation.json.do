#!/usr/bin/env python3
import json
import yaml
import redo
from data import Databases, Variation, CodesInDbs
import utils

logger = utils.get_logger(__name__)

if redo.running():

    project, event = redo.snippets[:2]
    variation0_id = '.'.join(redo.snippets[2:])

    project_path = redo.path / 'projects' / project

    with redo.ifchange(project_path / 'config.yaml') as f:
        databases = Databases.of_config(yaml.load(f))
    with redo.ifchange('{}.{}.{}.variation.json'.format(project, event, variation0_id)) as f:
        variation0 = Variation.of_data(json.load(f))
    with redo.ifchange('codes-in-dbs.json') as f:
        codes_in_dbs = CodesInDbs.of_data(json.load(f))

    concepts = variation0.concepts.filter_codes_in_dbs(codes_in_dbs)
    mapping = variation0.mapping.filter_codes_in_dbs(codes_in_dbs, databases)
    variation = Variation(concepts, variation0.mapping)

    with redo.output() as f:
        json.dump(variation.to_data(), f)

