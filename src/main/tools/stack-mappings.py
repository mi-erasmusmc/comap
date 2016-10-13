#!/usr/bin/env python3
import sys
import argparse
from os import path
from glob import glob
import pandas as pd

def merge(mappings_by_name):
    dfs = []
    for event in sorted(mappings_by_name):
        df = mappings_by_name[event]
        df.insert(0, 'Event', event)
        dfs.append(df)
    return pd.concat(dfs)

def fix_tags(tags):
    if tags == tags:
        return ', '.join([tag for tag in tags.split(', ') if tag.isupper()])
    else:
        return None

def read_mappings(directory):
    res = {}
    for filename in glob(path.join(directory, "*.xls")):
        event = path.basename(filename)[:-4]
        df = pd.read_excel(filename, sheetname='Codes')
        df['Tags'] = df.Tags.map(fix_tags)
        res[event] = df
    return res

def output(filename, res):
    if filename == '-':
        print(res.to_csv(index=False))
    elif filename.endswith('.xls') or filename.endswith('.xlsx'):
        res.to_excel(filename, index=False)
    elif filename.endswith('.csv'):
        res.to_csv(filename, index=False)
    else:
        print("Only xls, xlsx, csv output files possible")
        sys.exit(1)

def main():
    parser = argparse.ArgumentParser(description='Stack code sets')
    parser.add_argument('--mappings', metavar='DIR', required=True)
    parser.add_argument('--output', metavar='FILE', required=True)
    args = parser.parse_args()
    mappings_by_name = read_mappings(args.mappings)
    res = merge(mappings_by_name)
    output(args.output, res)

if __name__ == '__main__':
    main()
