#!/usr/bin/env python3
import pymysql
import hashlib
import argparse
import sys
from itertools import groupby


def sha256(password):
    return hashlib.sha256(password.encode()).hexdigest()


def read_password():
    print("Enter password: ", end='')
    password = sys.stdin.readline()
    return password[:-1]


def create_user(db, username, password):
    password = password or read_password()
    print(password, type(password))
    print("Create user {}? (y/*) > ".format(username), end='', flush=True)
    if sys.stdin.readline().strip() != 'y':
        return
    with db.cursor() as cur:
        cur.execute("INSERT INTO users (username, password) VALUES (%s, %s)",
                    [username, sha256(password)])
    print("Created user with ID", db.insert_id())
    db.commit()


def create_project(db, name):
    with db.cursor() as cur:
        cur.execute("INSERT INTO projects (name) VALUES (%s)",
                    [name])
    print("Created project with ID", db.insert_id())
    db.commit()


def get_user(db, username):
    with db.cursor() as cur:
        cur.execute("SELECT id FROM users WHERE username = %s", username)
        return cur.fetchone()['id']


def get_project(db, name):
    with db.cursor() as cur:
        cur.execute("SELECT id FROM projects where name = %s", [name])
        return cur.fetchone()['id']


def add_user_to_project(db, username, project, role):
    user_id = get_user(db, username)
    project_id = get_project(db, project)
    with db.cursor() as cur:
        cur.execute('INSERT INTO users_projects (user_id, project_id, role) '
                    'VALUES (%s, %s, %s) '
                    'ON DUPLICATE KEY UPDATE role = %s',
                    [user_id, project_id, role, role])
        print("Added user %d to project %d with ID %d" %
              (user_id, project_id, db.insert_id()))
    db.commit()


def show(db, users, projects, comments):

    if users is None and projects is None and comments is None:
        users = True
        projects = True
        comments = True

    with db.cursor() as cur:
        cur.execute('SELECT * FROM users ORDER BY id')
        all_users = list(cur.fetchall())

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
                cur.execute('SELECT * FROM case_definitions WHERE project_id = %s', [project['id']])
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


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--db-name', required=True)
    parser.add_argument('--db-user', required=True)
    parser.add_argument('--db-host', required=True)
    parser.add_argument('--db-port', type=int)
    parser.add_argument('--db-password', required=True)
    subparsers = parser.add_subparsers()

    parser_create_user = subparsers.add_parser('create-user')
    parser_create_user.add_argument('--username', required=True)
    parser_create_user.add_argument('--password')
    parser_create_user.set_defaults(func=create_user)

    parser_create_project = subparsers.add_parser('create-project')
    parser_create_project.add_argument('--name', required=True)
    parser_create_project.set_defaults(func=create_project)

    parser_add_user_to_project = subparsers.add_parser('add-user-to-project')
    parser_add_user_to_project.add_argument('--username', required=True)
    parser_add_user_to_project.add_argument('--project', required=True)
    parser_add_user_to_project.add_argument('--role', choices='CE', required=True)
    parser_add_user_to_project.set_defaults(func=add_user_to_project)

    parser_show = subparsers.add_parser('show')
    parser_show.add_argument("--users", action='store_true', default=None)
    parser_show.add_argument("--projects", action='store_true', default=None)
    parser_show.add_argument("--comments", action='store_true', default=None)
    parser_show.set_defaults(func=show)

    args = parser.parse_args()

    db_args = [args.db_host, args.db_user, args.db_password, args.db_name]
    if args.db_port:
        db_args += [args.db_port]
    db = pymysql.connect(*db_args, cursorclass=pymysql.cursors.DictCursor)
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
