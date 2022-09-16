# Generate SNOMED-CT transitive closures from RF2 files

## Prerequisits

Requires [SNOMED CT TRANSITIVE
CLOSURE](https://github.com/WestCoastInformatics/SNOMED-CT-Transitive-Closure),
compile and put the directory `com/wcinformatics/snomed/` on the class path.

## Running

```
./Single.sh SnomedCT_USEditionRF2_PRODUCTION_20220301T120000Z.zip snomedct_us
./Single.sh SnomedCT_InternationalRF2_PRODUCTION_20220430T120000Z.zip snomedct_int
./International.sh SnomedCT_InternationalRF2_PRODUCTION_20220430T120000Z.zip SnomedCT_SpanishRelease-es_PRODUCTION_20220430T120000Z.zip snomedct_spa
```

Adapted from
<https://github.com/WestCoastInformatics/SNOMED-CT-Transitive-Closure> and
<https://www.westcoastinformatics.com/resources>.
