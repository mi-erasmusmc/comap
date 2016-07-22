#!/usr/bin/env python3
from pathlib import Path
import yaml, json
import redo
from normalize import get_normalizer
from data import Mappings, Mapping, Databases


def normalize(mappings, databases):
    result = Mappings()
    for event, mapping in mappings._by_events.items():
        result_mapping = Mapping()
        for database in databases.databases():
            coding_system = databases.coding_system(database)
            normalizer = get_normalizer(coding_system)
            codes = mapping.codes(database)
            if codes is None:
                result_mapping.add(database, None)
            else:
                codes = normalizer(codes)
                result_mapping.add(database, codes)
            exclusion_codes = mapping.exclusion_codes(database)
            if exclusion_codes is None:
                result_mapping.add_exclusion(database, None)
            else:
                exclusion_codes = normalizer(exclusion_codes)
                result_mapping.add_exclusion(database, exclusion_codes)
        result.add(event, result_mapping)
    return result


def expand_wildcards(mappings):
    return mappings


if redo.running():

    project, = redo.snippets
    project_path = Path('projects') / project

    with redo.ifchange(project_path / 'config.yaml') as f:
        config = yaml.load(f)
        databases = Databases.of_config(config)

    with redo.ifchange(project_path / 'events.yaml') as f:
        events = yaml.load(f)

    with redo.ifchange(project_path / 'mappings.yaml') as f:
        mappings0 = Mappings.of_raw_data(yaml.load(f), events, databases)

    mappings1 = normalize(mappings0, databases)
    mappings2 = expand_wildcards(mappings1)

    with redo.output() as f:
        json.dump(mappings2.to_data(), f)
