#!/usr/bin/env python3
import json
import json, yaml
import redo
from data import Variation, Mappings, Concepts, Databases
import utils

logger = utils.get_logger(__name__)

if redo.running():

    project, event = redo.snippets
    project_path = redo.path / 'projects' / project

    with redo.ifchange(project_path / 'config.yaml') as f:
        config = yaml.load(f)
        databases = Databases.of_config(config)
        semantic_types = config['semantic-types']
    with redo.ifchange(project_path / 'events.yaml') as f:
        events = yaml.load(f)
    with redo.ifchange('{}.{}.concepts.json'.format(project, event)) as f:
        concepts = Concepts.of_data(json.load(f))
    with redo.ifchange('{}.mappings.json'.format(project)) as f:
        mappings = Mappings.of_data(json.load(f))
        mapping = mappings.get(event)

    variation = Variation(concepts.filter_by_semantic_types(semantic_types), mapping)

    with redo.output() as f:
        json.dump(variation.to_data(), f)

