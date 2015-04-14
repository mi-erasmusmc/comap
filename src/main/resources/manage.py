#!/usr/bin/env python2

from __future__ import print_function
import MySQLdb
from sql import *
import hashlib
import argparse
import sys
from itertools import groupby

db = MySQLdb.connect("mi-bios1","root","","code-mapper")
cur = db.cursor(MySQLdb.cursors.DictCursor)

def sha256(password):
    return hashlib.sha256(password).hexdigest()

def read_password():
    print("Enter password: ", end='')
    password = sys.stdin.readline()
    return password[:-1]

def create_user(username, password):
    password = password or read_password()
    cur.execute("INSERT INTO users (username, password) VALUES (%s, %s)",
                [username, sha256(password)])
    print("Created project with ID", db.insert_id())
    db.commit()

def create_project(name):
    cur.execute("INSERT INTO projects (name) VALUES (%s)",
                [name])
    print("Created project with ID", db.insert_id())
    db.commit()

def get_user(username):
    cur.execute("SELECT id FROM users WHERE username = %s", username)
    return cur.fetchone()['id']

def get_project(name):
    cur.execute("SELECT id FROM projects where name = %s", [name])
    return cur.fetchone()['id']

def add_user_to_project(username, project):
    user_id = get_user(username)
    project_id = get_project(project)
    cur.execute("INSERT INTO users_projects (user_id, project_id) VALUES (%s, %s)",
                [user_id, project_id])
    print("Added user %d to project %d with ID %d" %
          (user_id, project_id, db.insert_id()))
    db.commit()

def show():
    print("# USERS")
    cur.execute('SELECT * FROM users ORDER BY id')
    for user in cur.fetchall():
        print("%s (%d)" % (user['username'], user['id']))
    print()
    print("# PROJECTS")
    cur.execute('SELECT users.username, projects.name, projects.id FROM users_projects '
                'INNER JOIN users ON users_projects.user_id = users.id '
                'INNER JOIN projects ON users_projects.project_id = projects.id '
                'ORDER BY project_id')
    ups = list(cur.fetchall())
    longest = max(len(up['name']) for up in ups)
    grouper = lambda up: {'name': up['name'], 'id': up['id']}
    for project, ups_in_project in groupby(ups, grouper):
        prefix = " " * (longest - len(project['name']))
        print("\n## %s (%d)" % (project['name'], project['id']))
        print("\nUsers: %s" % ", ".join(up['username'] for up in ups_in_project))
        print("\nCase definitions\n")
        cur.execute('SELECT * FROM case_definitions WHERE project_id = %s', [project['id']])
        for cd in cur.fetchall():
            print(" - %s" % cd['name'])
        

    
def main():
    parser = argparse.ArgumentParser()
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
    parser_add_user_to_project.set_defaults(func=add_user_to_project)

    parser_show = subparsers.add_parser('show')
    parser_show.set_defaults(func=show)

    args = parser.parse_args()
    kwargs = {
        key: value
        for key, value in vars(args).iteritems()
        if key != "func"
    }
    args.func(**kwargs)

    
if __name__ == "__main__":
    main()
