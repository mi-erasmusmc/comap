#!/bin/sh
for f in case-definitions/*; do
    redo-ifchange $(basename $f .yaml).index.json
done
