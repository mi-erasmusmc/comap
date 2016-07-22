# -*- mode: sh -*-
path=$(dirname $1)
export PYTHONPATH=$path/lib
export COMAP_PROJECT=$(basename $2)
target_variation="3-RN-CHD-RB-PAR.expand"

redo-ifchange "$path/$COMAP_PROJECT.$target_variation.error-analyses.yaml" \
              "$path/$COMAP_PROJECT.types-distrs.json" \
              "$path/$COMAP_PROJECT.evaluations.csv" \
              "$path/$COMAP_PROJECT.code-stats.csv"

dir=$(mktemp -d "$COMAP_PROJECT.evaluation.XXXXX")
jupyter-nbconvert --execute --to pdf --output "$dir/evaluation" "$path/lib/CoMap evaluation.ipynb"

mv "$dir/evaluation.pdf" $3
echo rm -rf "$dir"


