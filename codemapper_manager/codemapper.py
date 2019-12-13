#!/usr/bin/env python3

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

import psycopg2
import psycopg2.extras
import hashlib
import argparse
import sys
import os
from itertools import groupby

# import psycopg2.extras
def connect(**kwargs):
    dsn="dbname={dbname} user={user} password={password} port={port} host={host}".format(**kwargs)
    return psycopg2.connect(dsn, cursor_factory=psycopg2.extras.DictCursor)


def sha256(password):
    return hashlib.sha256(password.encode()).hexdigest()


def read_password():
    print("Enter password: ", end='')
    password = sys.stdin.readline()
    return password[:-1]


def last_insert_id(cur):
    if DBDRIVER == 'postgres':
        cur.execute('SELECT LASTVAL()')
        return cur.fetchone()['lastval']
    else:
        return cur.fetchone()[0]


def create_user(db, username, password, email, ask):
    password = password or read_password()
    print("Create user {}/{}? (y/*) > ".format(username, email), end='', flush=True)
    if ask and sys.stdin.readline().strip() != 'y':
        return
    with db.cursor() as cur:
        cur.execute("INSERT INTO users (username, password, email) VALUES (%s, %s, %s)",
                    [username, sha256(password), email])
        insert_id = last_insert_id(cur)
        print("Created user", insert_id)
        db.commit()
        return insert_id


def create_user_in_projects(db, username, password, email, projects, role):
    id = create_user(db, username, password, email, ask=False)
    if not id:
        return
    for project in projects:
        add_user_to_project(db, username, project, role)

def set_password(db, username, password):
    password = password or read_password()
    print(password, type(password))
    print("Update password of {} ot {}? (y/*) > ".format(username, password), end='', flush=True)
    if sys.stdin.readline().strip() != 'y':
        return
    with db.cursor() as cur:
        cur.execute("UPDATE users SET password = %s WHERE username = %s",
                    [sha256(password), username])
    db.commit()

def create_project(db, name):
    with db.cursor() as cur:
        cur.execute("INSERT INTO projects (name) VALUES (%s)", (name,))
        insert_id = last_insert_id(cur)
        print("Created project with ID", insert_id)
    db.commit()
    return insert_id


def get_user(db, username):
    with db.cursor() as cur:
        cur.execute("SELECT id FROM users WHERE username = %s", (username,))
        return cur.fetchone()['id']


def get_project(db, name):
    with db.cursor() as cur:
        cur.execute("SELECT id FROM projects where name = %s", (name,))
        return cur.fetchone()['id']


def get_mapping(db, project_id, name):
    with db.cursor() as cur:
        cur.execute('SELECT id FROM case_definitions '
                    'WHERE project_id = %s '
                    'AND name = %s',
                    (project_id, name))
        return cur.fetchone()['id']


def get_mapping_content(db, mapping_id):
    with db.cursor() as cur:
        cur.execute('SELECT * '
                    'FROM case_definitions '
                    'WHERE id = %s',
                    (mapping_id,))
        return cur.fetchone()


def add_user_to_project(db, username, project, role):
    user_id = get_user(db, username)
    project_id = get_project(db, project)
    with db.cursor() as cur:
        cur.execute('INSERT INTO users_projects (user_id, project_id, role) '
                    'VALUES (%s, %s, %s) '
                    'ON CONFLICT (user_id, project_id) DO UPDATE '
                    'SET role = %s',
                    (user_id, project_id, role, role))
        # insert_id = cur.fetchone()[0]
        print("Added user %d to project %d" %
              (user_id, project_id))
    db.commit()


def move_mapping(db, project, mapping, target_project, target_mapping):
    if not target_mapping:
        target_mapping = mapping
    project_id = get_project(db, project)
    mapping_id = get_mapping(db, project_id, mapping)
    target_project_id = get_project(db, target_project)
    with db.cursor() as cur:
        cur.execute('UPDATE case_definitions '
                    'SET project_id = %s '
                    'WHERE id = %s',
                    (target_project_id, mapping_id))
        print("Moved mapping %d to project %d" %
              (mapping_id, target_project_id))
        db.commit()


def copy_mapping(db, mapping_id, target_project_id):
    mapping_content = get_mapping_content(db, mapping_id)
    with db.cursor() as cur:
        cur.execute('INSERT INTO case_definitions (project_id, name, state) '
                    'VALUES (%s, %s, %s)'
                    (target_project_id, m['name'], m['state']))
        insert_id = cur.fetchone()[0]
    db.commit()
    return insert_id
    # TODO copy comments


def get_mappings(db, project_id):
    with db.cursor() as cur:
        cur.execute('SELECT DISTINCT id FROM case_definitions '
                    'WHERE project_id = %s ',
                    (project_id,))
        return [r['id'] for r in cur.fetchall()]


def fork(db, source_project, target_project):
    source_project_id = get_project(db, source_project)
    mapping_ids = get_mappings(db, source_project_id)
    target_project_id = create_project(db, target_project)
    print("Created target project", target_project_id)
    for mapping_id in mapping_ids:
        target_mapping_id = copy_mapping(db, mapping_id, target_project_id)
        print("Copied mapping", mapping_id, "to", target_mapping_id)


def get_all_users(db):
    with db.cursor() as cur:
        cur.execute('SELECT id, username FROM users ORDER BY id')
        return list(cur.fetchall())

def show(db, users, projects, comments):

    if users is None and projects is None and comments is None:
        users = True
        projects = True
        comments = True

    all_users = get_all_users(db)

    with db.cursor() as cur:
        cur.execute('SELECT users.username, projects.name, projects.id, users_projects.role FROM users_projects '
                    'INNER JOIN users ON users_projects.user_id = users.id '
                    'INNER JOIN projects ON users_projects.project_id = projects.id '
                    'ORDER BY project_id')
        ups = list(cur.fetchall())

    if users:
        print("# USERS")
        for user in sorted(all_users, key=lambda user: user['username']):
            print("%s (%d)" % (user['username'], user['id']))
            for up in ups:
                if up['username'] == user['username']:
                    print(" - %s (%s)" % (up['name'], up['role']))

    if users and projects:
        print()

    if projects:
        print("# PROJECTS")
        grouper = lambda up: {'name': up['name'], 'id': up['id']}
        for project, ups_in_project in groupby(ups, grouper):
            print("\n## %s (%d)" % (project['name'], project['id']))
            print("\nUsers: %s" % ", ".join('%s (%s)' % (up['username'], up['role']) for up in ups_in_project))
            print("\nCase definitions\n")
            with db.cursor() as cur:
                cur.execute('SELECT * FROM case_definitions WHERE project_id = %s', (project['id'],))
                for cd in cur.fetchall():
                    print(" - %s" % cd['name'])

    if projects and comments:
        print()

    print('# COMMENTS')

    with db.cursor() as cur:
        cur.execute('select cd.name as cd_name, c.cui as cui, u.username as user, c.timestamp as timestamp, c.content as content '
                    'from comments as c inner join case_definitions as cd '
                    'on c.case_definition_id = cd.id '
                    'inner join users as u on c.author = u.id '
                    'order by timestamp, cd_name, cui')
        comments = cur.fetchall()
    for comment in comments:
        print()
        print("* {user} on {cd_name} ({timestamp}, {cui})".format(**comment))
        print(comment['content'])

def create_many_users(db, password, csv_file):
    import pandas as pd
    df = pd.read_csv(csv_file)
    for _, r in df.iterrows():
        if pd.isna(r.Login):
            print('Ignore {}, no login given'.format(r.Name))
        else:
            try:
                project = "EMA-Valproate-Retinoids"
                print("Add user --{}-- to project --{}--".format(r.Login, project), end=' (y/*) > ', flush=True)
                if sys.stdin.readline().strip() != 'y':
                    return
                add_user_to_project(db, username=r.Login, project=project, role='E')
        #     try:
        #         create_user(db, r.Login, password, r.Email)
            except psycopg2.Error as e:
                print(e.pgerror)
                db.rollback()

def main():
    parser = argparse.ArgumentParser(description='The CodeMapper management utility.', epilog='The database access is read from environment variables COMAP_DB_NAME, COMAP_DB_USER, COMAP_DB_HOST, COMAP_DB_PORT, COMAP_DB_PASSWORD if not given by the above command arguments.')
    parser.add_argument('--db-name', default=os.environ.get('COMAP_DB_NAME', None))
    parser.add_argument('--db-user', default=os.environ.get('COMAP_DB_USER', None))
    parser.add_argument('--db-host', default=os.environ.get('COMAP_DB_HOST', None))
    parser.add_argument('--db-port', type=int, default=os.environ.get('COMAP_DB_PORT', None))
    parser.add_argument('--db-password', default=os.environ.get('COMAP_DB_PASSWORD', None))
    subparsers = parser.add_subparsers()

    parser_create_user = subparsers.add_parser('create-user')
    parser_create_user.add_argument('--username', required=True)
    parser_create_user.add_argument('--password')
    parser_create_user.add_argument('--email', required=True)
    parser_create_user.set_defaults(func=create_user)

    parser_create_user = subparsers.add_parser('set-password')
    parser_create_user.add_argument('--username', required=True)
    parser_create_user.add_argument('--password')
    parser_create_user.set_defaults(func=set_password)

    parser_create_project = subparsers.add_parser('create-project')
    parser_create_project.add_argument('--name', required=True)
    parser_create_project.set_defaults(func=create_project)

    parser_add_user_to_project = subparsers.add_parser('add-user-to-project')
    parser_add_user_to_project.add_argument('--username', required=True)
    parser_add_user_to_project.add_argument('--project', required=True)
    parser_add_user_to_project.add_argument('--role', choices='CE', required=True)
    parser_add_user_to_project.set_defaults(func=add_user_to_project)

    parser_move_mapping = subparsers.add_parser('move-mapping')
    parser_move_mapping.add_argument('--project', required=True)
    parser_move_mapping.add_argument('--mapping', required=True)
    parser_move_mapping.add_argument('--target-project', required=True)
    parser_move_mapping.add_argument('--target-mapping')
    parser_move_mapping.set_defaults(func=move_mapping)

    parser_show = subparsers.add_parser('show')
    parser_show.add_argument("--users", action='store_true', default=None)
    parser_show.add_argument("--projects", action='store_true', default=None)
    parser_show.add_argument("--comments", action='store_true', default=None)
    parser_show.set_defaults(func=show)

    parser_fork = subparsers.add_parser('fork')
    parser_fork.add_argument('--source-project', required=True)
    parser_fork.add_argument('--target-project', required=True)
    parser_fork.set_defaults(func=fork)

    parser_create_many_users = subparsers.add_parser('create-many-users')
    parser_create_many_users.add_argument('--password', required=True)
    parser_create_many_users.add_argument('--csv-file', required=True)
    parser_create_many_users.set_defaults(func=create_many_users)

    args = parser.parse_args()

    db_kwargs = {
        'host': args.db_host,
        'user': args.db_user,
        'password': args.db_password,
        'dbname': args.db_name,
        'port': args.db_port
    }
    db = connect(**db_kwargs)
    try:
        kwargs = {
            key: value
            for key, value in vars(args).items()
            if key != "func" and not key.startswith('db_')
        }
        args.func(db, **kwargs)
    finally:
        db.close()

if __name__ == "__main__":
    main()
