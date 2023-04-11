# UMLS update procedure

The following steps are necessary to upgrade the UMLS version. The `$VERSION` in
these steps is a string `yyyyXX`, e.g. `2022aa`.

1. Download https://download.nlm.nih.gov/umls/kss/$VERSION/umls-$VERSION-metathesaurus.zip and extract, or
   ```
   read API_KEY
   VERSION=2022AB
   wget -o umls-$VERSION-full.zip "https://uts-ws.nlm.nih.gov/download?apiKey=$API_KEY&url=https://download.nlm.nih.gov/umls/kss/$VERSION/umls-$VERSION-full.zip"
   ```
2. Setup data
   ```
   gunzip -c MRCONSO.RRF.??.gz > MRCONSO.RRF
   gunzip -c MRREL.RRF.??.gz > MRREL.RRF
   gunzip MRDEF.RRF.gz
   gunzip MRSAB.RRF.gz
   gunzip MRSTY.RRF.gz
   ```
2. Add transitive closures for UMLS
   - `cd src/main/resources/umls-transitive-closure`
   - `cargo run --release -- --mrconso $UMLSMETA/MRCONSO.RRF --mrrel $UMLSMETA/MRREL.RRF --sabs "$(cat sabs.txt)" --write-auis --output $UMLSMETA/TC.RRF`
     (the vocabularies in `sabs.txt` should match those used with the `UmlsTCDescender` in `CodeMapperApplication`)
   - `sed "s!{{TRANSITIVE_CLOSURE}}!$TCRRF!" | psql $UMLSDB`
2. Prepare database
   ```shell
   VERSION=umls20??a?
   sudo -u postgres psql -c "create database umls$VERSION"
   sudo -u postgres psql umls$VERSION < src/main/resources/codemapper.sql
   ```
3. Copy RRF data into table, drop dummy column
   ```shell
   UMLSMETA=path/to/umls/version/meta # which contains *.RRF
   cd ~postgres
for table in MRCONSO MRREL MRDEF MRSAB MRSTY; do \
echo Importing table $table ...
     sudo -u postgres \
       psql "umls$VERSION" \
         -c "\COPY $table FROM STDIN WITH DELIMITER AS '|' NULL AS '' CSV QUOTE AS E'\b' ESCAPE '\'" \
         -c "ALTER TABLE $table DROP COLUMN dummy" \
       < "$UMLSMETA"/"$table".RRF
done
   ```
   If certain lines have formatting problems and are dispensable: `sed -i '$d' $UMLSMETA/$table.RRF`
4. Create indices
   ```sql
   CREATE EXTENSION pg_trgm;
   CREATE INDEX mrconso_ix_cui ON mrconso(cui);
   CREATE INDEX mrconso_ix_sab ON mrconso(sab);
   CREATE INDEX mrconso_ix_tty ON mrconso(tty);
   CREATE INDEX mrconso_ix_str ON mrconso(str);
   CREATE INDEX mrconso_ix_code ON mrconso(code);
   CREATE INDEX mrconso_ix_aui ON mrconso(aui);
   CREATE INDEX mrconso_ix_str_gin ON mrconso USING gin (str gin_trgm_ops);
   CREATE INDEX mrconso_ix_code_gin ON mrconso USING gin (code gin_trgm_ops);
   CREATE INDEX mrsty_ix_cui ON mrsty(cui);
   CREATE INDEX mrrel_ix_cui1 ON mrrel(cui1);
   CREATE INDEX mrrel_ix_cui2 ON mrrel(cui2);
   CREATE INDEX mrrel_ix_aui1 ON mrrel(aui1);
   CREATE INDEX mrrel_ix_aui2 ON mrrel(aui2);
   CREATE INDEX mrrel_ix_rel ON mrrel(rel);
   CREATE INDEX mrrel_ix_rela ON mrrel(rela);
   CREATE INDEX mrrel_ix_sab ON mrrel(sab);
   CREATE INDEX mrsab_ix_curver ON mrsab(curver);
   CREATE INDEX mrdef_ix_cui ON mrdef(cui);
   ```
5. Create database
   ```sql
   -- CREATE USER codemapper WITH LOGIN;
   -- \password codemapper
   -- CREATE DATABASE umls$VERSION;
   GRANT CONNECT ON DATABASE umls$VERSION TO codemapper;
   GRANT USAGE ON SCHEMA public TO codemapper;
   GRANT SELECT ON ALL TABLES IN SCHEMA public TO codemapper;
   ```
6. Copy database
   ```shell
    # On source (biosemantics.org)
    sudo -u postgres pg_dump umls$VERSION|gzip > umls$VERSION.sql.gz
    # On target (advance)
    zcat umls$VERSION.sql.gz|sudo -u postgres psql umls$VERSION
    sudo -u postgres psql umls$VERSION < $CODEMAPPER/src/main/resources/umls-functions.sql
    ```
7. Add transitive closures for SNOMED-CT
   - follow instructions in `src/main/resources/snomedct-transitive-closure/README.md`
8. Reflect the version update in the variables `codemapper-umls-version` and
   `umls-db-uri` in `code-mapper-*.properties`. This will result in an update of
   `src/main/resources/code-mapper.properties`.
9. Set permissions
   ```sql
   grant usage on schema public to codemapper;
   grant select on all tables in schema public to codemapper;
   ```
