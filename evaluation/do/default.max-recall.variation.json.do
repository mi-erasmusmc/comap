#!/usr/bin/env python3
from collections import defaultdict
import json
import yaml
import redo
import comap
from data import Databases, Variation, CodesInDbs, Mappings, Concepts, Dnf
import normalize
import utils

logger = utils.get_logger(__name__)

def dnf_to_cosynonyms(dnf):
    result = defaultdict(lambda: defaultdict(set))
    for cuis in dnf.cui_sets():
        codes_by_voc = dnf.get(cuis)
        for voc, codes in codes_by_voc.items():
            for cui in cuis:
                result[cui][voc].update(codes)
    return {
        cui: dict(result[cui])
        for cui in result
    }

def get_minimal_covering_cuis(dnf, mapping, databases):
    coding_systems = databases.coding_systems_data()
    cosynonyms = dnf_to_cosynonyms(dnf)
    mapping = mapping.to_data()
    return comap.mapping_to_max_recall_cuis_aux(coding_systems, cosynonyms, mapping)

def get_concepts(dnf, mapping, databases):
    cuis = get_minimal_covering_cuis(dnf, mapping, databases)
    data = comap.get_client().umls_concepts(cuis, databases.coding_systems())
    return Concepts.of_raw_data(data)

if redo.running():
    
    project, event = redo.snippets
    project_path = redo.path / 'projects' / project

    with redo.ifchange(project_path / 'config.yaml') as f:
        databases = Databases.of_config(yaml.load(f))
    with redo.ifchange(project_path / 'mappings.yaml') as f:
        mappings = Mappings.of_raw_data(yaml.load(f))
        mappings = normalize.mappings(mappings, databases)
        mapping = mappings.get(event)
    with redo.ifchange('{}.{}.dnf.json'.format(project, event)) as f:
        dnf = Dnf.of_data(json.load(f))
    with redo.ifchange('codes-in-dbs.json') as f:
        codes_in_dbs = CodesInDbs.of_data(json.load(f))

    concepts = get_concepts(dnf, mapping, databases)
    variation = Variation(concepts, mapping)

    with redo.output() as f:
        json.dump(variation.to_data(), f)
