# Copyright 2017 Erasmus Medical Center, Department of Medical Informatics.
# 
# This program shall be referenced as “Codemapper”.
# 
# This program is free software: you can redistribute it and/or modify
# it under the terms of the GNU Affero General Public License as published
# by the Free Software Foundation, either version 3 of the License, or
# (at your option) any later version.
# 
# This program is distributed in the hope that it will be useful,
# but WITHOUT ANY WARRANTY; without even the implied warranty of
# MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
# GNU Affero General Public License for more details.
# 
# You should have received a copy of the GNU Affero General Public License
# along with this program. If not, see <http://www.gnu.org/licenses/>.

#!/usr/bin/env python3
import pandas as pd
import argparse
import sys


def read_compiled_codes(xls_filename):
    dfs = []
    with pd.ExcelFile(xls_filename) as xls:
        for s in xls.sheet_names:
            if s.isupper():
                dfs.append(xls.parse(s)
                           .fillna(method='ffill')
                           .assign(Event=s))
    return pd.concat(dfs)


def diff_compiled_codes(old_codes_filename, new_codes_filename):
    cols = ['Event', 'Coding system', 'Code']
    old_codes = read_compiled_codes(old_codes_filename)[cols].drop_duplicates().assign(Old=True)
    new_codes = read_compiled_codes(new_codes_filename)[cols].drop_duplicates().assign(New=True)
    res = (pd.merge(old_codes, new_codes, how='outer', on=cols)
           .assign(Old=lambda df: df.Old.fillna(False),
                   New=lambda df: df.New.fillna(False)))
    res.loc[ res.Old &  res.New, 'State'] = 'Keep'
    res.loc[ res.Old & ~res.New, 'State'] = 'Remove'
    res.loc[~res.Old &  res.New, 'State'] = 'Add'
    return res.drop(['Old', 'New'], axis=1)


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--old', metavar='FILE', required=True)
    parser.add_argument('--new', metavar='FILE', required=True)
    args = parser.parse_args()
    diff_compiled_codes(args.old, args.new).to_csv(sys.stdout, index=False)


if __name__ == '__main__':
    main()
