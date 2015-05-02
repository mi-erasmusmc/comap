#!/usr/bin/env python3
import os
import sys
import requests
import yaml
import json
import comap

(_, REDO_TARGET, REDO_BASE, REDO_TEMP) = sys.argv

os.system('redo-ifchange comap.py {}'.format(os.path.join(comap.CASE_DEFINITIONS_FOLDER, REDO_BASE + '.yaml')))

casedef = comap.load_casedef(REDO_BASE)
cuis = [comap.cui_of_id(span['id']) for span in comap.peregrine_index(casedef)]

with open(REDO_TEMP, 'w') as f:
    json.dump(dict(cuis=cuis), f)

