#!/usr/bin/env python3
import pandas as pd
import numpy as np
import argparse

def code_counts_all(code_counts_by_db):
    res = (
        pd.concat([
            ccs.assign(Database=db)
            for db, ccs in code_counts_by_db.items()
        ], axis=0)
        .assign(**{
            'Concept': lambda df: df.Concept.fillna('???'),
            'Concept name': lambda df: df['Concept name'].fillna(''),
            'Tags': lambda df: df.Tags.fillna(''),
            'Codes': lambda df: (df.Count.astype(str) + ' (' + df.Vocabulary.fillna('') + ': ' + df.Code.fillna('-') + '/' + df['Extracted code'] + ')')
        })
        .pivot_table(values=['Count', 'Codes'], columns='Database', index=['Event', 'Concept', 'Concept name', 'Tags'], aggfunc=[np.sum, ', '.join])
        .sort_index(axis=1, level=1, ascending=False) # By Count/Codes
        # .sort_index(axis=1, level=2, ascending=False) # By database
    )
    res.columns = (
        res.columns
        .droplevel(0)
        # .swaplevel(0, 1)
    )
    return res


def main():
    parser= argparse.ArgumentParser()
    parser.add_argument('--code-counts', nargs='*', metavar='DB:FILE', required=True)
    parser.add_argument('--output', metavar='FILE', required=True)
    args = parser.parse_args()
    code_counts_by_db = {}
    for cc in args.code_counts:
        db, filename = cc.split(':')
        code_counts_by_db[db] = pd.read_excel(filename, sheetname='Codes')
    res = code_counts_all(code_counts_by_db)
    res.to_excel(args.output)


if __name__ == '__main__':
    main()
