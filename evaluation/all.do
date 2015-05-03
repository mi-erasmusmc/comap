for f in case-definitions/*; do
    redo-ifchange $(basename $f .yaml).concepts.json
done
