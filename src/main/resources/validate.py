#!/usr/bin/env python3
"""
Check the states stored in a database against a JSON schema.
"""
import argparse
import pymysql
from pymysql.cursors import DictCursor
import json
import jsonschema
import yaml
from os import path
from getpass import getpass
import sys

SCHEMA_FILE = 'state-schema-v1.1.yaml'

QUERY = "SELECT id, name, state FROM `case_definitions`"

def main():
    parser = argparse.ArgumentParser(description='Validate CodeMapper mappings in database')
    parser.add_argument('--host', type=str, default='127.0.0.1')
    parser.add_argument('--port', type=int, default=3306)
    parser.add_argument('--user', type=str, required=True)
    parser.add_argument('--database', type=str, required=True)
    parser.add_argument('--password', type=str)
    parser.add_argument('--outdir', type=str)
    args = parser.parse_args()
    if not args.password:
        args.password = getpass('Database password: ')
    connection = pymysql.connect(host=args.host, port=args.port,
                                 user=args.user, password=args.password, database=args.database,
                                 cursorclass=DictCursor)
    with open(SCHEMA_FILE) as f:
        schema = yaml.load(f)
    if args.outdir and not path.isdir(args.outdir):
        error("outdir not a directory")
    validate_mappings(connection, schema, args.outdir)


def validate_mappings(connection, schema, outdir):
    for mapping in mappings(connection):
        name = mapping['name']
        state = json.loads(mapping['state'])
        print('#', name)
        validate(state, schema)
        if outdir:
            with open(path.join(outdir, name + '.json'), 'w') as f:
                json.dump(state, f, indent=2)


def mappings(connection):
    with connection.cursor() as cursor:
        cursor.execute(QUERY)
        for mapping in cursor.fetchall():
            yield mapping


def validate(state, schema):
    try:
        jsonschema.validate(state, schema)
    except jsonschema.ValidationError as e:
        print(e.message)
        print(e.context)
        print(e.cause)


def error(message):
    print("ERROR:", message)
    sys.exit(1)


if __name__ == "__main__":
    main()
