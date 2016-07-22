#!/usr/bin/env python3
import json, yaml
from pathlib import Path
import comap
import redo
from data import Concepts, Databases

def get_child_concepts(concepts, databases):
    client = comap.ComapClient()
    hyponyms_by_cui = client.hyponyms(concepts.cuis(), databases.coding_systems())
    return hyponyms_by_cui


if redo.running():

    project, event = redo.snippets
    project_path = Path('projects') / project

    with redo.ifchange(project_path / 'config.yaml') as f:
        config = yaml.load(f)
        databases = Databases.of_config(config)

    with redo.ifchange('{}.{}.concepts.json'.format(project, event)) as f:
        concepts = Concepts.of_data(json.load(f))

    coding_systems = sorted(set(config['coding-systems'].values()))
    concepts = get_child_concepts(concepts, databases)

    with redo.output() as f:
        json.dump(concepts, f)
