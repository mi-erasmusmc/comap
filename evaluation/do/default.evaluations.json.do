#!/usr/bin/env python3
from pathlib import Path
import pandas as pd
import numpy as np
import json, yaml
import redo
from data import Databases, Variation, Evaluation, Evaluations
import utils

logger = utils.get_logger(__name__)

def evaluate(variations, databases):
    evaluations = Evaluations()
    for variation_id in variations:
        for event, variation in variations[variation_id].items():
            cuis = set(variation.concepts.cuis())
            for database in databases.databases():
                coding_system = databases.coding_system(database)
                generated = set(variation.concepts.codes(coding_system))
                reference = variation.mapping.codes(database)
                if reference is None:
                    evaluation = None
                else:
                    reference = set(reference)
                    tp = generated & reference
                    fp = generated - reference
                    fn = reference - generated
                    if generated:
                        precision = len(tp) / len(generated)
                    else:
                        precision = np.nan
                    if reference:
                        recall = len(tp) / len(reference)
                    else:
                        recall = np.nan
                    evaluation = Evaluation(cuis, generated, reference, tp, fp, fn, recall, precision)
                evaluations.add(variation_id, event, database, evaluation)
    return evaluations

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
                ]
            ] + [
                evaluation.recall,
                evaluation.precision,
            ]
        data.append(row)
    columns = [ 'variation', 'event', 'database', 'cuis',
                'generated', 'reference', 'tp', 'fp', 'fn',
                'recall', 'precision' ]
    return pd.DataFrame(data=data, columns=columns)

if redo.running():
    
    (project, ) = redo.snippets
    project_path = Path('projects') / project

    with redo.ifchange(project_path / 'config.yaml') as f:
        config = yaml.load(f)
        databases = Databases.of_config(config)
        
    with redo.ifchange(project_path / 'events.yaml') as f:
        events = yaml.load(f)

    with redo.ifchange(project_path / 'variations.yaml') as f:
        variation_ids = yaml.load(f)

    variations = {}
    for variation_id in variation_ids:
        variations[variation_id] = {}
        for event in events:
            with redo.ifchange("{}.{}.{}.variation.json".format(project, event, variation_id)) as f:
                variation_data = json.load(f)
                variation = Variation.of_data(variation_data)
                variations[variation_id][event] = variation

    evaluations = evaluate(variations, databases)
    
    with redo.output() as f:
        json.dump(evaluations.to_data(), f)

    df = evaluations_to_df(evaluations)
    csv_path = Path(redo.temp).parent / '{}.evaluations.csv'.format(project)
    df.to_csv(str(csv_path), index=False)
    
