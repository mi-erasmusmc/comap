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