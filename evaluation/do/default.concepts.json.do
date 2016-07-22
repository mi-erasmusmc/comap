#!/usr/bin/env python3
import json, yaml
from pathlib import Path
import comap
import redo
from data import Concepts, Databases
import utils


logger = utils.get_logger(__name__)


def get_concepts(index, databases):
    cuis = [s['cui'] for s in index['spans']]
    data = comap.get_client().umls_concepts(cuis, databases.coding_systems())
    concepts = Concepts.of_raw_data_and_normalize(data, databases.coding_systems())
    return concepts


if redo.running():

    project, event = redo.snippets
    project_path = Path('projects') / project

    with redo.ifchange(project_path / 'config.yaml') as f:
        config = yaml.load(f)
        databases = Databases.of_config(config)

    with redo.ifchange('{}.{}.index.json'.format(project, event)) as f:
        index = json.load(f)

    concepts = get_concepts(index, databases)

    with redo.output() as f:
        json.dump(concepts.to_data(), f)
