#!/usr/bin/env python3
import pandas as pd
import yaml, json
import redo
from data import Databases, Mappings, Dnf, CodesInDbs

def make_code_stats(dnfs, mappings, databases):
    data = []
    for database in databases.databases():
        coding_system = databases.coding_system(database)
        mapping_codes = mappings.all_codes(database) or set()
        dnf_codes = {
            code
            for dnf in dnfs.values()
            for code in dnf.codes(coding_system) or set()
        }
        codes_in_db = codes_in_dbs.get(coding_system)
        for code in mapping_codes | dnf_codes:
            in_mapping = code in mapping_codes
            in_dnf = code in dnf_codes
            in_db = codes_in_db.exists(code)
            row = [database, code, in_mapping, in_dnf, in_db]
            data.append(row)
    columns = "Database Code InMapping InDnf InDatabase".split()
    return pd.DataFrame(data, columns=columns)

if redo.running():

    project, = redo.snippets
    project_path = redo.path / 'projects' / project

    with redo.ifchange(project_path / 'config.yaml') as f:
        databases = Databases.of_config(yaml.load(f))
    with redo.ifchange(project_path / 'events.yaml') as f:
        events = yaml.load(f)
    with redo.ifchange(project_path / 'mappings.yaml') as f:
        mappings = Mappings.of_raw_data_and_normalize(yaml.load(f), events, databases)
    with redo.ifchange('codes-in-dbs.json') as f:
        codes_in_dbs = CodesInDbs.of_data(json.load(f))    
    with redo.ifchange({
            event: '{}.{}.dnf.json'.format(project, event)
            for event in events
    }) as files:
        dnfs = {}
        for event in events:
            dnfs[event] = Dnf.of_data(json.load(files[event]))

    df = make_code_stats(dnfs, mappings, databases)

    with redo.output() as f:
        df.to_csv(f, index=False)
