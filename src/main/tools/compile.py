#!/usr/bin/env python3
import pandas as pd
import re
from io import StringIO
import argparse


EXCLUDE_RCD2_CODES = ['_DRUG', '_NONE']


VOCABULARY_DESCRIPTIONS = """
ICD10	ICD-10	https://www.nlm.nih.gov/research/umls/sourcereleasedocs/current/ICD10/
ICD10CM	ICD-10 CM	https://www.nlm.nih.gov/research/umls/sourcereleasedocs/current/ICD10CM/
ICD9CM	ICD-9 CM	https://www.nlm.nih.gov/research/umls/sourcereleasedocs/current/ICD9CM/
MTHICD9	ICD-9 CM	https://www.nlm.nih.gov/research/umls/sourcereleasedocs/current/MTHICD9/
ICPC	ICPC	https://www.nlm.nih.gov/research/umls/sourcereleasedocs/current/ICPC/, Local versions (e.g. ICPCDUT) can be added if necessary
ICPC2EENG	ICPC-2	https://www.nlm.nih.gov/research/umls/sourcereleasedocs/current/ICPC2EENG/
RCD	READ CTv3	https://www.nlm.nih.gov/research/umls/sourcereleasedocs/current/RCD/
RCD2	READ v2	Translation of RCD based on mappings by Health & Social Care Information Centre at https://isd.hscic.gov.uk
"""

SUBSUMPTION_BY_PREFIX = ['ICD9', 'ICD9CM', 'MTHICD9', 'ICD10', 'ICD10CM', 'RCD2']
IGNORE_SUFFIX_REGEX = {'RCD2': re.compile('\.+$')}


def ignore_suffix(code, vocabulary):
    if vocabulary in IGNORE_SUFFIX_REGEX:
        return IGNORE_SUFFIX_REGEX[vocabulary].sub('', code)
    else:
        return code

def is_code_range(code, vocabulary):
    return '-' in code

def is_subsumed(code, codes, vocabulary):
    if is_code_range(code, vocabulary):
        return False
    code = ignore_suffix(code, vocabulary)
    codes = [ignore_suffix(c, vocabulary) for c in codes]
    if vocabulary in SUBSUMPTION_BY_PREFIX:
        for code1 in codes:
            if code1 != code and len(code1) > 1 and code.startswith(code1):
                return True
    return False

def get_subsumed_codes(codes):
    grouped_codes = codes.groupby(['Event', 'Target']).Code.aggregate(lambda s: set(s))
    grouped_codes.map(', '.join).to_csv('/tmp/grouped_codes.csv')
    return codes.apply(lambda r: is_subsumed(r.Code, grouped_codes[r.Event, r.Target], r['Coding system']), axis=1)


def open_xls_files(xls_files):
    dfs = []
    for xls_file in xls_files:
        event_name = pd.read_excel(xls_file, sheetname='Info', header=None).iloc[0, 1]
        codes = (
            pd.read_excel(xls_file, sheetname='Codes', na_values='-')
            .pipe(lambda df: df[df.Code.notnull()])
            .assign(Event=event_name)
        )
        def relevant_tag(t):
            return not t or t.isupper()
        tag = (
            codes.Tags
            .fillna('').str.split(', ')
            .apply(lambda s: pd.Series(sorted({t for t in s if relevant_tag(t)})))
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
    res['Target (tag)'] = res.Target + res.Tag.fillna('').map(lambda t: ' (' + t + ')' if t else '')
    return res


def output(codes, mappings_df, subsumed_codes, high_level_rcd2_codes, out_xls_file):
    with pd.ExcelWriter(out_xls_file) as writer:
        for event in sorted(codes.Event.unique()):
            (codes[codes.Event == event]
             .sort_values(['Target (tag)', 'Code'])
             .set_index(['Target (tag)', 'Code', 'Code name'])
             [['Coding system', 'Concept', 'Concept name']]
             .to_excel(writer, event))
        descrs = pd.read_csv(StringIO(VOCABULARY_DESCRIPTIONS),
                             sep='\t', index_col=False,
                             names=["Coding system (CodeMapper/UMLS)",
                                    "Coding system family",
                                    "Description"])
        descrs.to_excel(writer, "Coding systems", index=False)
        mappings_df.to_excel(writer, "Coding systems", index=False, startrow=len(descrs)+2)
        subsumed_codes.to_excel(writer, "Subsumed codes", index=False)
        high_level_rcd2_codes.to_excel(writer, "High-level Read-v2 codes", index=False)


def reverse_voc_map(voc_map):
    return {
        voc0: voc
        for voc in voc_map
        for voc0 in voc_map[voc]
    }


def create_mappings_df(voc_map):
    return pd.DataFrame.from_records([
        (voc, "+".join(voc_map[voc]))
        for voc in voc_map
    ], columns=["Coding system (Resulting mapping)", "Coding systems (UMLS)"])


def run(xls_files, voc_map, out_xls_file):
    codes0 = open_xls_files(xls_files)
    codes1 = compile_codes(codes0, reverse_voc_map(voc_map))
    subsumed = get_subsumed_codes(codes1)
    excluded = (codes1['Coding system'] == 'RCD2') & codes1.Code.isin(EXCLUDE_RCD2_CODES)
    codes2 = codes1[~subsumed & ~excluded]
    cols = ['Event', 'Target', 'Code', 'Code name', 'Concept', 'Concept name']
    highlevel_rcd2 = (codes1['Coding system'] == 'RCD2') & codes1.Code.str.endswith('....')
    subsumed_codes = codes1[subsumed][cols].sort_values(['Event', 'Target', 'Code']).drop_duplicates()
    highlevel_rcd2_codes = codes1[highlevel_rcd2][cols].sort_values(['Event', 'Target', 'Code']).drop_duplicates()
    mappings_df = create_mappings_df(voc_map)
    output(codes2, mappings_df, subsumed_codes, highlevel_rcd2_codes, out_xls_file)


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
