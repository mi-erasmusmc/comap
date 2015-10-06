#!/usr/bin/env python3
from pathlib import Path
import pandas as pd
import numpy as np
import json, yaml
import redo
from data import Databases, Variation, Evaluation, Evaluations, Mappings, ErrorAnalysis
from utils import get_logger
from comap import known_codes

logger = get_logger(__name__)

def evaluate(variations, databases, mappings):
    evaluations = Evaluations()
    for variation_id in variations:
        for event, variation in variations[variation_id].items():
            mapping = mappings.get(event)
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
                    exclusion_codes = mapping.exclusion_codes(database)
                    max_recall_codes = variations['max-recall'][event].concepts.codes(coding_system)
                    analysis = error_analysis(tp, fp, fn, coding_system, max_recall_codes, exclusion_codes)
                    evaluation = Evaluation(cuis, generated, reference, tp, fp, fn, recall, precision, analysis)
                evaluations.add(variation_id, event, database, evaluation)
    return evaluations


def error_analysis(tp, fp, fn, coding_system, max_recall_codes, exclusion_codes):

    generated = tp | fp
    reference = tp | fn

    # False negative codes that are not in UMLS
    fn_not_in_umls = fn - known_codes(fn, coding_system)

    # False negative codes that are exclusion codes
    fn_exclusions = fn & exclusion_codes

    # False negative codes that are in UMLS and inclusion codes
    fn_inclusion_in_umls = fn - exclusion_codes - fn_not_in_umls
    
    # False positive codes that in the maximum recall
    fp_in_dnf = fp & max_recall_codes

    # The recall over codes that are in UMLS/RCD2
    reference_in_umls = reference - fn_not_in_umls
    if reference_in_umls:
        recall_in_umls = len(tp) / len(reference_in_umls)
    else:
        recall_in_umls = float('nan')

    # Recall over disregarding exclusion codes
    reference_without_exclusions = reference - fn_exclusions
    if reference_without_exclusions:
        recall_without_exclusions = len(tp - exclusion_codes) / len(reference_without_exclusions)
    else:
        recall_without_exclusions = float('nan')

    reference_without_exclusions_in_umls = reference - fn_not_in_umls - fn_exclusions
    if reference_without_exclusions_in_umls:
        recall_without_exclusions_in_umls = len(tp - exclusion_codes) / len(reference_without_exclusions_in_umls)
    else:
        recall_without_exclusions_in_umls = float('nan')

    # Precision over DNF
    if generated:
        precision_over_dnf = len(generated & max_recall_codes) / len(generated)
    else:
        precision_over_dnf = float('nan')
    
    return ErrorAnalysis(fp_in_dnf, fn_not_in_umls, fn_exclusions, fn_inclusion_in_umls,
                         recall_in_umls, recall_without_exclusions, recall_without_exclusions_in_umls,
                         precision_over_dnf)

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
                evaluation.error_analysis.recall_in_umls,
                evaluation.error_analysis.recall_without_exclusions,
                evaluation.error_analysis.precision_over_dnf,
            ]
        data.append(row)
    columns = [ 'variation', 'event', 'database', 'cuis',
                'generated', 'reference', 'tp', 'fp', 'fn',
                'recall', 'precision',
                'recall_in_umls', 'recall_without_exclusions',
                'precision_over_dnf' ]
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
    with redo.ifchange(project_path / 'mappings.yaml') as f:
        mappings = Mappings.of_raw_data_and_normalize(yaml.load(f), events, databases)
        
    variations = {}
    for variation_id in variation_ids:
        variations[variation_id] = {}
        for event in events:
            with redo.ifchange("{}.{}.{}.variation.json".format(project, event, variation_id)) as f:
                variation_data = json.load(f)
                variation = Variation.of_data(variation_data)
                variations[variation_id][event] = variation

    evaluations = evaluate(variations, databases, mappings)
    
    with redo.output() as f:
        json.dump(evaluations.to_data(), f)

    df = evaluations_to_df(evaluations)
    csv_path = Path(redo.temp).parent / '{}.evaluations.csv'.format(project)
    df.to_csv(str(csv_path), index=False)
    
