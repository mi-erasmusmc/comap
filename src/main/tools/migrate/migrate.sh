#!/bin/bash

# export sourcepass="$(pass show euadr.erasmusmc.nl/mysql/root)"
# export targetpass="$(pass show advance/postgresql/codemapper)"

# export sourcepass
# export targetpass
export source
export target

migrate() {
 tmp=$(mktemp)
 echo $tmp
 cat migrate.load|envsubst > $tmp
 cat $tmp
 pgloader $tmp
}

echo "*** Migrating CodeMapper ***"
source=code-mapper target=codemapper sourceschema=code-mapper migrate

echo "*** UMLS-ext-mappings ***"
source=UMLS_ext_mappings target=umls-ext-mappings sourceschema=umls_ext_mappings migrate

echo "*** UMLS-ext-mappings ***"
source=UMLS2014AB_CoMap target=umls2014ab-codemapper sourceschema=umls2014ab_comap migrate

# echo 'Now run in target postgresql:'
# echo 'ALTER ROLE codemapper SET search_path TO "umls2014ab_comap","code-mapper","umls_ext_mappings";'

echo 'Check migration'
echo 'Source MySQL:    SELECT TABLE_NAME,TABLE_ROWS FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_SCHEMA = 'UMLS2014AB_CoMap' ORDER BY TABLE_ROWS;'
echo 'Target Postgres: SELECT schemaname,relname,n_live_tup FROM pg_stat_user_tables WHERE schemaname != 'public' ORDER BY n_live_tup DESC;'

