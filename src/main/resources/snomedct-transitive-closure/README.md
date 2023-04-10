# Generate SNOMED-CT transitive closures from RF2 files

## Prerequisits

Requires [SNOMED CT TRANSITIVE
CLOSURE](https://github.com/WestCoastInformatics/SNOMED-CT-Transitive-Closure),
compile and put the directory `com/wcinformatics/snomed/` on the class path.

and the SNOMED-CT files from

```
wget -O SnomedCT_ManagedServiceUS_PRODUCTION_US1000124_20230301T120000Z.zip \
  "https://uts-ws.nlm.nih.gov/download?apiKey=$API_KEY&url=https://download.nlm.nih.gov/mlb/utsauth/USExt/SnomedCT_ManagedServiceUS_PRODUCTION_US1000124_20230301T120000Z.zip"

wget -O SnomedCT_InternationalRF2_PRODUCTION_20230331T120000Z.zip \
  "https://uts-ws.nlm.nih.gov/download?apiKey=$API_KEY&url=https://download.nlm.nih.gov/umls/kss/IHTSDO2023/IHTSDO20230331/SnomedCT_InternationalRF2_PRODUCTION_20230331T120000Z.zip"

wget -O SnomedCT_SpanishRelease-es_PRODUCTION_20221031T120000Z.zip \
  "https://uts-ws.nlm.nih.gov/download?apiKey=$API_KEY&url=https://download.nlm.nih.gov/umls/kss/IHTSDO2022/Spanish/SnomedCT_SpanishRelease-es_PRODUCTION_20221031T120000Z.zip" 
```

## Running

```
version=20230301
sudo -u postgres psql -c "create database snomedct_int_$version
./Single.sh SnomedCT_ManagedServiceUS_PRODUCTION_*.zip snomedct_us_$version
./Single.sh SnomedCT_InternationalRF2_PRODUCTIONRFC2_PRODUCTION_*.zip snomedct_int_$version
./International.sh SnomedCT_InternationalRF2_PRODUCTION_*.zip SnomedCT_SpanishRelease-es_PRODUCTION_*.zip snomedct_spa_$version
```

Adapted from
<https://github.com/WestCoastInformatics/SNOMED-CT-Transitive-Closure> and
<https://www.westcoastinformatics.com/resources>.
