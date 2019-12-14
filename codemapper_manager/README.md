# Administration of CodeMapper

The CodeMapper administration is available here: https://app.vac4eu.org/codemapper-admin/

It allows adding and removing projects and users in CodeMapper (heading _CODEMAPPER_), and
adding and removing administrator users (heading _AUTHENTICATION AND AUTHORIZATION_).

## Add user

1. Goto https://app.vac4eu.org/codemapper-admin/codemapper/user/
2. Click _Add user_, fill in, optionally select related projects, and click _SAVE_.

## Add project 

1. Goto https://app.vac4eu.org/codemapper-admin/codemapper/project/
2. Click _Add project_, fill in, optionally select members, click _SAVE_.

## Add user to project
1. Goto https://app.vac4eu.org/codemapper-admin/codemapper/project/
2. Select the project by clicking on it.
3. Under _MEMBERS_, select the user in an unitialized membership ("--------").
4. Click _SAVE_ on the bottom.
5. Inform the user that it is necessary to logout and login again to be able to access the
   project.

## Remove user from project
1. Goto https://app.vac4eu.org/codemapper-admin/codemapper/project/
2. Select the project by clicking on it.
3. Under _MEMBERS_, check the box on the right for all members that should be removed from
   the project.
4. Click _SAVE_ on the bottom.

## Reset CodeMapper password for user
1. Goto https://app.vac4eu.org/codemapper-admin/codemapper/user/
2. Select user to change by clicking on it.
3. Click _Reset password_
4. Note down the four-word password shown in light-green message which appears on the top
   of the site: _Password of user XYZ was changed to: WORD WORD WORD WORD_
   
## Delete mapping

1. Goto https://app.vac4eu.org/codemapper-admin/codemapper/project/
2. Select the project by clicking on it.
3. Under _MAPPINGS_, check the box on the right for all mappings that should be deleted
4. Click _SAVE_ on the bottom.

## Create new admin user who can carry out the above tasks

1. Goto https://app.vac4eu.org/codemapper-admin/auth/user/
2. Click _Add user_, fill in, and click _SAVE_.
3. Add _Staff status_, and click _SAVE_ on the bottom.

# Setup

## Dependencies

```shell
sudo apt install wamerican  # For xkcd-style password generator
virtualenv -p python3 venv
source venv/bin/activate
pip3 install Django==3.0 psycopg2==2.8.4
```

## Database

```shell
sudo -u postgres psql
  CREATE DATABASE "codemapper";
  GRANT ALL PRIVILEGES ON DATABASE "codemapper" TO "codemapper";
psql -u codemapper < codemapper-20191212.sql
psql -u codemapper codemapper
  ALTER TABLE "code-mapper"."users_projects" ADD COLUMN ID SERIAL;
```

## Before run

```shell
mkdir static
./manage collectstatic
./manage createsuperuser
./manage migrate
./manage.py runserver --settings codemapper_manager.settings_production
```
