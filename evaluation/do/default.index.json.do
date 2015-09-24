#!/usr/bin/env python3
import json, yaml
from pathlib import Path
import comap
import redo

def index(casedef):
    text = casedef['name'] + ' ' + casedef['definition']
    spans = comap.peregrine_index(text)
    for span in spans:
        span['cui'] = comap.cui_of_id(span['id'])
    return {
        'spans': spans,
    }

if redo.running():

    project, event = redo.snippets
    project_path = Path('projects') / project

    with redo.ifchange(project_path / 'case-definitions' / (event + '.yaml')) as f:
        casedef = yaml.load(f)

    result = index(casedef)

    with redo.output() as f:
        json.dump(result, f)
