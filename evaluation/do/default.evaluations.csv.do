#!/usr/bin/env python3
import redo
import json
import pandas as pd
from data import Evaluations

def evaluations_to_df(evaluations):
    data = []
    def f(s):
        return json.dumps(sorted(s))
    for (variation_id, event, database), evaluation in evaluations.all():
        row = [
            variation_id,
            event,
            database,
        ]
        if evaluation is None:
            row += [None] * 8
        else:
            row += [
                f(v) for v in [
                    evaluation.cuis,
                    evaluation.generated,
                    evaluation.reference,
                    evaluation.tp,
                    evaluation.fp,
                    evaluation.fn,
                    evaluation.error_analysis.fn_inclusion_in_umls,
                ]
            ] + [
                evaluation.recall,
                evaluation.precision,
                evaluation.error_analysis.recall_in_umls,
                evaluation.error_analysis.recall_without_exclusions,
                evaluation.error_analysis.recall_without_exclusions_in_umls,
                evaluation.error_analysis.precision_over_dnf,
            ]
        data.append(row)
    columns = [ 'variation', 'event', 'database', 'cuis',
                'generated', 'reference', 'tp', 'fp', 'fn',
                'fn_inclusion_in_umls',
                'recall', 'precision',
                'recall_in_umls', 'recall_without_exclusions', 'recall_without_exclusions_in_umls',
                'precision_over_dnf' ]
    return pd.DataFrame(data=data, columns=columns)


if redo.running():

    (project, ) = redo.snippets

    with redo.ifchange('{}.evaluations.json'.format(project)) as f:
        evaluations = Evaluations.of_data(json.load(f))

    df = evaluations_to_df(evaluations)
    df.to_csv(redo.temp, index=False)
    

    
