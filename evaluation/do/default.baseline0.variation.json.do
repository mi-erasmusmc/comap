#!/usr/bin/env python3
import json
import yaml
import redo
from data import Variation, Mappings, Concepts, Databases
import utils

logger = utils.get_logger(__name__)

if redo.running():

    project, event = redo.snippets
    project_path = redo.path / 'projects' / project

    with redo.ifchange(project_path / 'config.yaml') as f:
        databases = Databases.of_config(yaml.load(f))
    with redo.ifchange(project_path / 'events.yaml') as f:
        events = yaml.load(f)
    with redo.ifchange('{}.{}.concepts.json'.format(project, event)) as f:
        concepts = Concepts.of_data(json.load(f))
    with redo.ifchange(project_path / 'mappings.yaml') as f:
        mappings = Mappings.of_raw_data_and_normalize(yaml.load(f), events, databases)
        mapping = mappings.get(event)

    variation = Variation(concepts, mapping)

    with redo.output() as f:
        json.dump(variation.to_data(), f)

