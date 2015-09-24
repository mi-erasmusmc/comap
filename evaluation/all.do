# -*- mode: sh -*-

export PYTHONPATH=$PWD/lib
redo-ifchange safeguard.evaluations.xls safeguard.evaluations.csv lib/plots.ipynb
ipython nbconvert --execute --to html --output plots.html lib/plots.ipynb
