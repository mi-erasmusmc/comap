# CodeMapper tools

The [pandas](http://pandas.pydata.org/) library is required for the Python
tools. `pandas` can be installed with the following command:

    pip3 install --user pandas
    
The examples below require that mappings have been downloaded from CodeMapper as
XLS files in a dedicated directory (`mappings/`), and the name of each file is
just the event name with an `.xls` extension.

## Batch download mappings

Code sets for events mapped in CodeMapper can be downloaded as XLS files from
the web application programmatically, for example using [httpie](https://httpie.org/):

    http -v --form --session /tmp/s POST http://localhost:8080/CodeMapper/rest/authentification/login username=$username password=$password

    project=ADVANCE-POC
    events=(ADEM CONVULS DEATH FCONVULS FEVER GCONVULS HHE ISR PCRYING PERTUSSIS PNEUMONIA SOMNOL)
    casedefat="https://euadr.erasmusmc.nl/CodeMapper"
    downloadfrom="https://euadr.erasmusmc.nl/CodeMapper"
    for event in $events; do
        http --session /tmp/s "$downloadfrom/rest/services/download/case-definition-xls" \
            project=="$project" caseDefinition=="$event" url=="$casedefat/#/case-definition/$project/$event" > "$event".xls
    done
    
## Post processing of generated mapping

### Compile

The script `compile.py` puts together the code sets of multiple events into one
XLS file for easy distribution of codes to databases. The name of the input
files must be the event name (+ .xls extension). Each event is in a separate
worksheet of the resulting Excel file.

A vocabulary map is used to assign codes from a set of CodeMapper/UMLS
vocabularies to databases.

Codes that correspond to concepts with tags are grouped together. Only tags that
start with an upper-case letter are taken into consideration.

Use `./compile.py --help` for a full description of functionality and options.

#### Example

    ./compile.py --inputs mappings/*.xls --voc-map 'ICD-9/CM:ICD9CM+MTHICD9' \
      'Read-v2:RCD2' 'Read-CTv3:RCD' 'ICD-10/CM:ICD10+ICD10CM' 'ICPC-2:ICPC+ICPC2EENG' \
      --output mapings.xls

### Code counts

The script `code-counts.py` connects the code counts resulting from the event
fingerprinting with the code sets generated with CodeMapper. It runs on the code
counts from *all events* of *one database* at once.

Use `./code-counts.py --help` for a full description of functionality and
options. Pyinstaller can be used to compile it into a single (windows) .exe
file.

#### Example

Precondition: The UMLS vocabularies ICD10 and ICD10CM where combined before
extractions (using the `./compile.py` script)

    ./code-counts.py --vocabulariees ICD10+ICD10CM --code-counts SSI-code-counts.txt \
      --mappings mappings/ --output mappings-with-code-counts.xls

### Stack mappings

The script `stack-mappings.py` combines a set of CodeMapper mappings in XLS
files into one XLS file, in long-form, adding a column to indicate the event.

#### Example

    ./stack-mappings.py --mappings mappings/ --output mappings-stacked.xls
    
## Internal use

### Validation

The script `validate.py` validates the database storage of mappings against a
JSON schema (in `state-schema.yaml`).
