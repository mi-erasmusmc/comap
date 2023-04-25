# UMLS transitive closure

This program requires a Rust installation. Instructions for the installation
are available at <https://www.rust-lang.org/tools/install>.

To generate AUI-based table of descendants use this command:

`cargo run --release -- --mrconso path/to/MRCONSO.RRF --mrrel path/to/MRREL.RRF --sabs SABS --write-auis --output TC.RRF`

Without `--write-auis`, the descendant codes of the database are written.

The argument `SABS` must be a comma-separated list of UMLS vocabulary names.
This should match the vocabularies used with the `UmlsTCDescender` in
`CodeMapperApplication`.


```sql
drop table if exists transitiveclosure;
create table transitiveclosure (
  sup char(9) not null,
  sub char(9) not null
);
grant ALL on all tables in schema public to codemapper;
```

```shell
  psql "umls$VERSION" \
    -c "\COPY transitiveclosure FROM STDIN WITH DELIMITER AS '|' NULL AS '' CSV QUOTE AS E'\b' ESCAPE '\'" \
    < TC.RRF
```

Here is a script to find the vocabularies that are actually used in CodeMapper:

```
echo 'select state from case_definitions ' \
| psql codemapper \
| head -n-1 | tail -n+3 \
| jq '.codingSystems' \
| grep '^  "' | sed 's/^  "\([^"]*\)",*$/\1/' \
| sort | uniq -c | sort -h
```
