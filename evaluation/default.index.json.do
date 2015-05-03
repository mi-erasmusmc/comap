#!/usr/bin/env python
import os
import sys
import requests
import yaml
import json
import comap

(_, REDO_TARGET, REDO_BASE, REDO_TEMP) = sys.argv

peregrine_config_file = 'config/peregrine.yaml'
casedef_file = os.path.join('case-definitions', REDO_BASE + '.yaml')

os.system('redo-ifchange comap.py {peregrine_config_file} {casedef_file}'.format(**locals()))

peregrine_api_url = yaml.load(open(peregrine_config_file))['api']['url']

casedef = yaml.load(open(casedef_file))

spans = comap.peregrine_index(casedef['name'] + ' ' + casedef['definition'], peregrine_api_url)

cuis = [ comap.cui_of_id(span['id']) for span in spans ]

result = {
    'cuis': cuis,
    'spans': spans,
}

with open(REDO_TEMP, 'w') as f:
    json.dump(result, f)

