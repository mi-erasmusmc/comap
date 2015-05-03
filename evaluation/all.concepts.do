#!/bin/sh
for f in case-definitions/*; do
    echo $f
    redo-ifchange $(basename $f .yaml).concepts.json
done
