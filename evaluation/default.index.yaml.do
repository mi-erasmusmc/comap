#!/usr/bin/env python
import os
import sys
import requests
from pathlib import Path
import yaml
import comap
import redo

peregrine_config_filename = 'config/peregrine.yaml'
(project, casedef_id) = redo.base.split('.')
casedef_path = Path('case-definitions') / project / (casedef_id + '.yaml')

with redo.ifchange(peregrine_config_filename, casedef_path.as_posix()) \
     as (peregrine_config_file, casedef_file):
    peregrine_api_url = yaml.load(peregrine_config_file)['api']['url']
    casedef = yaml.load(casedef_file)

text = casedef['name'] + ' ' + casedef['definition']
spans = comap.peregrine_index(text, peregrine_api_url)

for span in spans:
    span['cui'] = comap.cui_of_id(span['id'])

result = {
    'spans': spans,
}

with open(redo.temp, 'w') as f:
    yaml.dump(result, f)

