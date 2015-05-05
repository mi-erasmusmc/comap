#!/usr/bin/env python
import os
import sys
import requests
from pathlib import Path
import yaml
import comap
import redo

(project, casedef_id) = redo.base.split('.')

casedef_path = Path('projects') / project / 'case-definitions' / (casedef_id + '.yaml')
with redo.ifchange(peregrine_config = 'config/peregrine.yaml',
                   casedef = casedef_path.as_posix()) as files:
    print(files)
    peregrine_config = yaml.load(files['peregrine_config'])
    casedef = yaml.load(files['casedef'])

text = casedef['name'] + ' ' + casedef['definition']
spans = comap.peregrine_index(text, peregrine_config['api']['url'])

for span in spans:
    span['cui'] = comap.cui_of_id(span['id'])

result = {
    'spans': spans,
}

with redo.output() as f:
    yaml.dump(result, f)

