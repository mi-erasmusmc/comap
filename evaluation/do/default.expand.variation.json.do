#!/usr/bin/env python3
import json
import yaml
import redo
import comap
from data import Databases, Variation, Concepts, Mappings
import utils
logger = utils.get_logger(__name__)

def expand_concepts_by_codes(concepts, relations, databases, mapping):

    "Expand concepts towards related that contribute TP codes to the mapping."
    
    cuis = set(concepts.cuis())
    relateds = comap.get_client().related(cuis, relations, databases.coding_systems())
    
    for cui in relateds:
        for rel in relateds[cui]:
            for related in relateds[cui][rel]:
                for database in databases.databases():
                    codes = comap.codes_of_raw_concept(related, databases.coding_system(database))
                    reference = mapping.codes(database)
                    if reference is not None and codes & reference:
                        cuis.add(related['cui'])
                        break

    data = comap.get_client().umls_concepts(cuis, databases.coding_systems())
    varied_concepts = Concepts.of_raw_data_and_normalize(data, databases.coding_systems())

    return varied_concepts

def expand_concepts_by_dnf(concepts, relations, dnf):
    generated_cuis = set(concepts.cuis())
    reference_cuis = {cui for cuis in dnf.cui_sets() for cui in cuis}

    client = comap.get_client()
    
    relateds = client.related(generated_cuis, relations, [])
    for cui in relateds:
        for rel in relateds[cui]:
            for related in relateds[cui][rel]:
                if related['cui'] in reference_cuis:
                    generated_cuis.add(related['cui'])

    data = client.umls_concepts(generated_cuis, databases.coding_systems())
    varied_concepts = Concepts.of_raw_data_and_normalize(data, databases.coding_systems())

    return varied_concepts

if redo.running():
    
    project, event, n_relations = redo.snippets
    n_relations = n_relations.split('-')
    n, relations = int(n_relations[0]), n_relations[1:]
    project_path = redo.path / 'projects' / project

    with redo.ifchange(project_path / 'config.yaml') as f:
        databases = Databases.of_config(yaml.load(f))
    with redo.ifchange(project_path / 'events.yaml') as f:
        events = yaml.load(f)
    if n == 1:
        variation0_id = 'baseline'
    else:
        variation0_id = '{}-{}.expand'.format(n-1, '-'.join(relations))
    with redo.ifchange('{}.{}.{}.variation.json'.format(project, event, variation0_id)) as f:
        variation0 = Variation.of_data(json.load(f))
    with redo.ifchange(project_path / 'mappings.yaml') as f:
        mappings = Mappings.of_raw_data_and_normalize(yaml.load(f), events, databases)
        mapping = mappings.get(event)

    concepts = expand_concepts_by_codes(variation0.concepts, relations, databases, mapping)
    
    variation = Variation(concepts, variation0.mapping)
    
    with redo.output() as f:
        json.dump(variation.to_data(), f)

