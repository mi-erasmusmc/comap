#!/usr/bin/env python3
import logging
import json, yaml
import normalize
from data import Mappings, Dnf, Databases, Concepts
import redo

logger = logging.getLogger(__name__)

def create_dnf(mapping, cosynonyms, databases):
    result = Dnf()
    for database in databases.databases():
        coding_system = databases.coding_system(database)
        codes = mapping.codes(database)
        if codes is not None:
            for code in codes:
                cuis = []
                for cui in cosynonyms.cuis():
                    if code in cosynonyms.cui(cui).codes(coding_system):
                        cuis.append(cui)
                if cuis:
                    result.add(cuis, coding_system, code)
    return result

if redo.running():

    project, event = redo.snippets
    project_path = redo.path / 'projects' / project

    with redo.ifchange(project_path / 'config.yaml') as f:
        config = yaml.load(f)
        databases = Databases.of_config(config)
    with redo.ifchange(project_path / 'mappings.yaml') as f:
        mappings = Mappings.of_raw_data(yaml.load(f))
        mappings = normalize.mappings(mappings, databases)
        mapping = mappings.get(event)
    with redo.ifchange('{}.{}.cosynonyms.json'.format(project, event)) as f:
        cosynonyms = Concepts.of_data(json.load(f))

    dnf = create_dnf(mapping, cosynonyms, databases)
    
    with redo.output() as f:
        json.dump(dnf.to_data(), f)
