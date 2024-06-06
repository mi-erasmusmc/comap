mrconso.csv:
	sudo -u postgres psql umls2023aa -c "COPY (select distinct cui,sab,code,str,lat,tty from mrconso where sab in ('ICD10', 'ICD10CM', 'ICD9CM', 'ICPC', 'ICPC2EENG', 'ICPC2P', 'MTHICD9', 'RCD', 'SCTSPA', 'SNM', 'SNOMEDCT_US') order by sab,code) TO STDOUT DELIMITER ',' CSV HEADER" \
	  > $@

VOCS = ICD10DA MEDCODEID RCD2
EXPORTS = $(addprefix export/, $(addsuffix .csv, $(VOCS)))

export/non-umls.csv: $(EXPORTS)
	cat $^ > $@

.SECONDEXPANSION:
$(EXPORTS): export/%.csv: $$*/$$*.csv export/ids.txt
	ID=$(shell grep "$*" export/ids.txt|cut -d, -f1); \
	tail -n+2 $< | sed -e "s/^/$${ID},/" > $@

.PHONY:
import: export/non-umls.csv
	psql "COPY non_umls_codes (voc_id,code,term,rel,umls_code,umls_sab,cui) FROM '$<' with (format csv);
