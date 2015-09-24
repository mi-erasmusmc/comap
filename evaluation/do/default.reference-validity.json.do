#!/usr/bin/env python3
import yaml, json
import numpy as np
import redo
from data import Databases, Mappings, CodesInDbs
import normalize

all_databases = ['BIFAB', 'Medicare', 'IPCI', 'Lombardy', 'unknown', 'CPRD', 'Puglia', 'GePaRD', 'PHARMO']

def create(mappings, events, codes_in_dbs, databases):
    result = {}
    for database in all_databases:
        coding_system = databases.coding_system(database)
        all_codes = set()
        for event in events:
            mapping = mappings.get(event)
            if database in mapping.keys():
                codes = mapping.codes(database)
                if codes:
                    all_codes.update(codes)
        codes_in_db = codes_in_dbs.get(coding_system)
        filtered = { code for code in all_codes if code in codes_in_db }
        if all_codes:
            r = len(filtered) / len(all_codes)
        else:
            r = np.nan
        result["{} ({})".format(database, coding_system)] = r
            # 'codes': sorted(all_codes),
            # 'filtered': sorted(filtered),
    return result

if redo.running():
    project, = redo.snippets
    project_path = redo.path / 'projects' / project
    
    with redo.ifchange(project_path / 'config.yaml') as f:
        config = yaml.load(f)
        databases = Databases.of_config(config)
    with redo.ifchange(project_path / 'events.yaml') as f:
        events = yaml.load(f)
    with redo.ifchange(project_path / 'mappings.yaml') as f:
        mappings = Mappings.of_raw_data(yaml.load(f))
        mappings = normalize.mappings(mappings, databases)
    with redo.ifchange('codes-in-dbs.json') as f:
        codes_in_dbs = CodesInDbs.of_data(json.load(f))

    res = create(mappings, events, codes_in_dbs, databases)
    with redo.output() as f:
       json.dump(res, f) 

