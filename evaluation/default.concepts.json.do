#!/usr/bin/env python3

import os
import sys
import json
import comap

(_, REDO_TARGET, REDO_BASE, REDO_TEMP) = sys.argv

VOCABULARIES = ['RCD', 'RCD2']
SEMANTIC_TYPES = [ "T020", "T190", "T049", "T019", "T047", "T050",
                   "T037", "T048", "T191", "T046", "T184", "T033", "T005", "T004",
                   "T204", "T007" ]

os.system('redo-ifchange comap.py {}.index.json'.format(REDO_BASE))

casedef = comap.load_casedef(REDO_BASE)
with open(REDO_BASE + '.index.json') as f:
    index = json.load(f)

client = comap.ComapClient()

concepts = [
    concept for concept in client.umls_concepts(index['cuis'], VOCABULARIES)
    if set(concept['semanticTypes']) & set(SEMANTIC_TYPES)
]

with open(REDO_TEMP, 'w') as f:
    json.dump(concepts, f)
