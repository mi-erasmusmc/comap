# -*- mode: sh -*-

export PYTHONPATH=$PWD/lib
export COMAP_PROJECT=safeguard
redo-ifchange $COMAP_PROJECT.evaluations.xls $COMAP_PROJECT.evaluations.pdf
