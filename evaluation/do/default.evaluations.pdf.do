# -*- mode: sh -*-
path=$(dirname $1)
export PYTHONPATH=$path/lib
export COMAP_PROJECT=$(basename $2)

 redo-ifchange "$path/$COMAP_PROJECT.evaluations.csv" "$path/$COMAP_PROJECT.code-stats.csv"

dir=$(mktemp -d "$COMAP_PROJECT.evaluation.XXXXX")
ipython nbconvert --execute --to pdf --output "$dir/evaluation" "$path/lib/CoMap evaluation.ipynb"

mv "$dir/evaluation.pdf" $3
echo rm -rf "$dir"


