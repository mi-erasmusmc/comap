# ADVANCE Code Mapper

Using servlet 3.0.1 -- requires Tomcat7

## Build

- maven2
- `mvn package`

# Database
## Migration

    mysqldump --user=root --host=127.0.0.1 --port=3307 --default-character-set=utf8 "code-mapper" -p > code-mapper.sql
    mysql -u root -h 127.0.0.1 -P 3308 -p < code-mapper.sql
    
## Database UMLS-ext

The database `UMLS-ext` contains data complementary to the UMLS.

### Table `ctv3rctmap_uk` for mapping Read-CTv3 to Read-v2

In `nhs_datamigration_22.0.0_20161001000001/Mapping Tables/Updated/Clinically Assured`

	CREATE TABLE `ctv3rctmap_uk_YYYMMDD` (`MAPID` varchar(38), `V2_CONCEPTID` varchar(5), `V2_TERMID` varchar(5), `CTV3_TERMID` varchar(5), `CTV3_TERMTYP` varchar(1), `CTV3_CONCEPTID` varchar(5), `USE_CTV3_TERMID` varchar(5), `STAT` varchar(1), `MAPTYP` varchar(3), `MAPSTATUS` int(11), `EFFECTIVEDATE` int(11), `ISASSURED` int(11)) ENGINE=InnoDB DEFAULT CHARSET=latin1;

    database=umls_ext
    file=ctv3rctmap_uk_YYYMMDD.txt
    mysqlimport --delete \
        --columns=$(head -n1 "$file"|sed "s/$(printf '\t')/,/g") \
        --ignore-lines=1 --lines-terminated-by='\r\n' \
        --local "$database" "$file"

### Table `Corev2` for Read-v2 labels

NHS-READv2-20.0.0/V2/Unified/Corev2.all

    CREATE TABLE `Corev2` (`CODE` VARCHAR(5), `DESCRIPTION` VARCHAR(100), `C3` VARCHAR(100), `C4` VARCHAR(250), `C5` VARCHAR(20), `C6` INTEGER, `C7` VARCHAR(20), `C8` VARCHAR(2), `C9` VARCHAR(20), `C10` VARCHAR(2), `C11` VARCHAR(10), `C12` VARCHAR(2), `C13` VARCHAR(2));

	mysqlimport --delete \
        --columns=CODE,DESCRIPTION,C3,C4,C5,C6,C7,C8,C9,C10,C11,C12,C13 \
        --fields-enclosed-by='"' --fields-terminated-by=',' --lines-terminated-by='\r\n' \
        --local "$database" Corev2.all
