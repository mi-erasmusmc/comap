# -*- mode: sh -*-

export PYTHONPATH="$PWD/lib"
export COMAP_PROJECT="safeguard"
TARGET_VARIATION="3-RN-CHD-RB-PAR.expand"

redo-ifchange \
    codes-in-dbs.json \
    $COMAP_PROJECT.types-distrs.json \
    $COMAP_PROJECT.code-stats.csv \
    $COMAP_PROJECT.evaluations.csv \
    $COMAP_PROJECT.$TARGET_VARIATION.error-analyses.yaml \
    $COMAP_PROJECT.evaluations.pdf
