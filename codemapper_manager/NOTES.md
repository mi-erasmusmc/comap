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
