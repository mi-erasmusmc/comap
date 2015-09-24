#!/usr/bin/env python3
from pathlib import Path
from collections import defaultdict
import logging
import json, yaml
import normalize
from comap import cosynonym_codes
from data import Databases, Mappings, Concepts
import redo

logger = logging.getLogger(__name__)

def all_cosynonyms(mapping, databases):

    res = defaultdict(lambda: defaultdict(set))
    for database in databases.databases():
        coding_system = databases.coding_system(database)
        codes = mapping.codes(database)
        if codes is not None:
            cosynonyms = cosynonym_codes(codes, coding_system, databases.coding_systems())
            for cui in cosynonyms:
                for coding_system in cosynonyms[cui]:
                    synonyms = cosynonyms[cui][coding_system]
                    if synonyms:
                        res[cui][coding_system].update(synonyms)

    # Cleanup noise (introduced by RCD2/3 translations)
    for cui in list(res):
        cui_has_reference = False
        for database in databases.databases():
            coding_system = databases.coding_system(database)
            reference = mapping.codes(database)
            if reference is not None:
                for_cui = res[cui].get(coding_system, [])
                if set(for_cui) & set(reference):
                    cui_has_reference = True
        if not cui_has_reference:
            del res[cui]

    return Concepts.of_data(res)

    
if redo.running():

    project, event = redo.snippets
    project_path = Path('projects') / project
    
    with redo.ifchange(project_path / 'config.yaml') as f:
        config = yaml.load(f)
        databases = Databases.of_config(config)
    with redo.ifchange(project_path / 'mappings.yaml') as f:
        mappings = Mappings.of_raw_data(yaml.load(f))
        mappings = normalize.mappings(mappings, databases)
        mapping = mappings.get(event)

    cosynonyms = all_cosynonyms(mapping, databases)

    with redo.output() as f:
        json.dump(cosynonyms.to_data(), f)
