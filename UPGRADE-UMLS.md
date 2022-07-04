# UMLS update procedure

The following steps are necessary to upgrade the UMLS version. The `$VERSION` in
these steps is a string `yyyyXX`, e.g. `2022aa`.

1. Download https://download.nlm.nih.gov/umls/kss/$VERSION/umls-$VERSION-metathesaurus.zip and extract
2. Prepare database
   ```shell
   sudo -u postgres psql -c "create database umls$VERSION"
   ```

   ```sql
   DROP TABLE IF EXISTS mrdef;
   CREATE TABLE mrdef (
     cui char(8) NOT NULL,
     aui varchar(9) NOT NULL,
     atui varchar(11) NOT NULL,
     satui varchar(50),
     sab varchar(40) NOT NULL,
     def text NOT NULL,
     suppress char(1) NOT NULL,
     cvf bigint,
     dummy char(1)
   );
   DROP TABLE IF EXISTS mrsab;
   CREATE TABLE mrsab (
     vcui char(8),
     rcui char(8),
     vsab varchar(40) NOT NULL,
     rsab varchar(40) NOT NULL,
     son text NOT NULL,
     sf varchar(40) NOT NULL,
     sver varchar(40),
     vstart char(8),
     vend char(8),
     imeta varchar(10) NOT NULL,
     rmeta varchar(10),
     slc text,
     scc text,
     srl bigint NOT NULL,
     tfr bigint,
     cfr bigint,
     cxty varchar(50),
     ttyl varchar(400),
     atnl text,
     lat varchar(3),
     cenc varchar(40) NOT NULL,
     curver char(1) NOT NULL,
     sabin char(1) NOT NULL,
     ssn text NOT NULL,
     scit text NOT NULL,
     dummy char(1)
   );
   DROP TABLE IF EXISTS mrsty;
   CREATE TABLE mrsty (
     cui char(8) NOT NULL,
     tui varchar(4) NOT NULL,
     stn varchar(100), --  NOT NULL
     sty varchar(50),  --  NOT NULL
     atui varchar(11), --  NOT NULL
     cvf bigint,
     dummy char(1)
   );
   DROP TABLE IF EXISTS mrrel;
   CREATE TABLE mrrel (
     cui1 char(8), --  NOT NULL
     aui1 varchar(9),
     stype1 varchar(50), --  NOT NULL
     rel varchar(4) NOT NULL,
     cui2 character(8) NOT NULL,
     aui2 varchar(9),
     stype2 varchar(50), --  NOT NULL
     rela varchar(100),
     rui varchar(10) NOT NULL,
     srui varchar(50),
     sab varchar(40), --  NOT NULL
     sl varchar(40), --  NOT NULL
     rg varchar(10),
     dir varchar(1),
     suppress char(1) NOT NULL,
     cvf bigint,
     dummy char(1)
   );
   DROP TABLE IF EXISTS mrconso;
   CREATE TABLE mrconso (
     cui      char(8) NOT NULL,
     lat      char(3) NOT NULL,
     ts       char(1) NOT NULL,
     lui      char(9) NOT NULL,
     stt      varchar(3) NOT NULL,
     sui      char(9) NOT NULL,
     ispref   char(1) NOT NULL,
     aui      varchar(9) NOT NULL,
     saui     varchar(50),
     scui     varchar(50),
     sdui     varchar(50),
     sab      varchar(20) NOT NULL,
     tty      varchar(20) NOT NULL,
     code     varchar(100) NOT NULL,
     str      text NOT NULL,
     srl      int NOT NULL,
     suppress char(1) NOT NULL,
     cvf      int,
     dummy    char(1)
   );
   ```
3. Copy RRF data into table, drop dummy column
   ```shell
   UMLSMETA=path/to/umls/version/meta # which contains $VERSION/META
   cd ~postgres
   for table in MRCONSO MRREL MRDEF MRSAB MRSTY; do \
     sudo -u postgres \
       psql "umls$VERSION" \
         -c "\COPY $table FROM STDIN WITH DELIMITER AS '|' NULL AS '' CSV QUOTE AS E'\b' ESCAPE '\'" \
         -c "ALTER TABLE $table DROP COLUMN dummy" \
       < "$UMLSMETA"/"$table".RRF
   done
   ```
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
7. Reflect the version update in the variables `codemapper-umls-version` and
   `umls-db-uri` in `code-mapper-*.properties`. This will result in an update of
   `src/main/resources/code-mapper.properties`.
