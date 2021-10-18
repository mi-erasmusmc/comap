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
import csv
import yaml
import pymysql

from nltk.tokenize.moses import MosesTokenizer
tokenizer = MosesTokenizer()

from nltk.stem import LancasterStemmer
stemmer = LancasterStemmer()

with open('comap-database.yaml') as f:
    comap_database = yaml.load(f)

connection = pymysql.connect(**comap_database)

SQL = """select CUI, SAB, CODE, STR from MRCONSO"""

def get_stems(str):
    str = str.replace('-', ' ').replace('.', ' ')
    tokens = tokenizer.tokenize(str)
    return [stemmer.stem(t) for t in tokens]

counter = 0
with open('cuis-words.csv', 'w', newline='') as f:
    writer = csv.writer(f, quoting=csv.QUOTE_MINIMAL)
    writer.writerow(['CUI', 'VOCABULARY', 'CODE', 'STR', 'STEMS'])
    with connection.cursor() as cursor:
        print("Executing...", end='', flush=True)
        cursor.execute(SQL)
        print("")
        while True:
            rows = cursor.fetchmany(size=1000)
            if rows:
                for cui, sab, code, str in rows:
                    counter += 1
                    if counter % 1000000 == 0:
                        print('X', end='', flush=True)
                    elif counter % 100000 == 0:
                        print('+', end='', flush=True)
                    elif counter % 1000 == 0:
                        print('.', end='', flush=True)
                    stems = get_stems(str)
                    writer.writerow([cui, sab, code, str, '|'.join(stems)])
            else:
                break


