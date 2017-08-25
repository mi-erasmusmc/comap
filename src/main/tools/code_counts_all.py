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
