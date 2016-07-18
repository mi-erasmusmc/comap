#!/usr/bin/env python3
from collections import defaultdict
import pandas as pd
import argparse

EXCLUDE_RCD2_CODES = ['_DRUG', '_NONE', '2....']

def open_xls_files(xls_files):
    dfs = []
    for xls_file in xls_files:
        event_name = pd.read_excel(xls_file, sheetname='Info', header=None).iloc[0, 1]
        codes = (
            pd.read_excel(xls_file, sheetname='Codes', na_values='-')
            .pipe(lambda df: df[df.Code.notnull()])
            .assign(Event=event_name)
        )
        tag = (
            codes.Tags
            .fillna('').str.split(', ')
            .apply(lambda s: pd.Series(sorted(set(s))))
            .stack()
            .reset_index(level=1, drop=True)
            .to_frame('Tag')
        )
        df = pd.merge(codes, tag, how='outer', left_index=True, right_index=True)
        dfs.append(df)
    return pd.concat(dfs, axis=0)

def compile_codes(codes, rev_voc_map):
    res = (
        codes
        .assign(Target=lambda df: df['Coding system'].map(rev_voc_map))
        .pipe(lambda df: df[df.Target.notnull()])
    )
    res['Coding system (tag)'] = res.Target + res.Tag.map(lambda t: ' (' + t + ')' if t else '')
    return res

def output(codes, out_xls_file):
    with pd.ExcelWriter(out_xls_file) as writer:
        for event in sorted(codes.Event.unique()):
            _ = (
                codes[(codes.Event == event) & ((codes['Coding system'] != 'RCD2') | ~codes.Code.isin(EXCLUDE_RCD2_CODES))]
                .sort_values(['Coding system (tag)', 'Code'])
                .set_index(['Coding system (tag)', 'Code', 'Code name'])
                [['Coding system', 'Concept', 'Concept name']]
                .to_excel(writer, event)
            )

def reverse_voc_map(voc_map):
    return {
        voc0: voc
        for voc in voc_map
        for voc0 in voc_map[voc]
    }

def run(xls_files, voc_map, out_xls_file):
    codes0 = open_xls_files(xls_files)
    codes1 = compile_codes(codes0, reverse_voc_map(voc_map))
    output(codes1, out_xls_file)

def parse_voc_map(voc_map):
    return {
        v1: v2s.split('+')
        for s in voc_map
        for v1, v2s in [s.split(':')]
    }

def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--inputs', metavar='FILE', nargs='+', required=True,
                        help='CodeMapper XLS files')
    parser.add_argument('--voc-map', dest='voc_map', nargs='*', required=True,
                        help='A mapping like ICD9:ICD9CM+MTHICD9 READ2:RCD2 ICD10:ICD10CM ICPC2:ICPC2EENG')
    parser.add_argument('--output', metavar='FILE', required=True,
                        help='Output XLS file')
    args = parser.parse_args()
    run(args.inputs, parse_voc_map(args.voc_map), args.output)

if __name__ == '__main__':
    main()
