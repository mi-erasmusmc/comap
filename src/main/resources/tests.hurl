POST {{URL}}/rest/authentification/login
Content-Type: application/x-www-form-urlencoded
`username={{USERNAME}}&password={{PASSWORD}}`
HTTP 200

GET {{URL}}/rest/authentification/user
HTTP 200
[Asserts]
jsonpath "$.username" == {{USERNAME}}

# UMLS version
GET {{URL}}/rest/code-mapper/version-info
HTTP 200
[Asserts]
jsonpath "$.umlsVersion" == "2023AA"

# Non-UMLS vocabularies included
GET {{URL}}/rest/code-mapper/coding-systems
HTTP 200
[Asserts]
jsonpath "$[*]" count > 100
jsonpath "$[*].abbreviation" includes "TEST"

# Non-UMLS codes included
GET {{URL}}/rest/code-mapper/autocomplete-code?str=3&codingSystem=TEST
HTTP 200
[Asserts]
jsonpath "$" count == 2
jsonpath "$[*].sourceConcepts[*].codingSystem" count == 4
jsonpath "$[0].sourceConcepts[0].codingSystem" == "TEST"
jsonpath "$[0].sourceConcepts[1].codingSystem" == "TEST"
jsonpath "$[0].sourceConcepts[2].codingSystem" == "TEST"
jsonpath "$[1].sourceConcepts[0].codingSystem" == "TEST"
jsonpath "$[0].sourceConcepts[0].id" matches "^3"
jsonpath "$[0].sourceConcepts[1].id" matches "^3"
jsonpath "$[0].sourceConcepts[2].id" matches "^3"
jsonpath "$[1].sourceConcepts[0].id" matches "^3"

# Non-UMLS umls concepts
POST {{URL}}/rest/code-mapper/umls-concepts
Content-Type: application/x-www-form-urlencoded
`cuis=C0001122&codingSystems=TEST`
HTTP 200
[Asserts]
jsonpath "$[*]" count == 1
jsonpath "$[0].cui" == "C0001122"
jsonpath "$[0].sourceConcepts" count == 1
jsonpath "$[0].sourceConcepts[0].codingSystem" == "TEST"
jsonpath "$[0].sourceConcepts[0].cui" == "C0001122"
jsonpath "$[0].sourceConcepts[0].id" == "30"

# Non-umls descendants (by concept)
GET {{URL}}/rest/code-mapper/descendants?codingSystem=TEST&codes=30
HTTP 200
[Asserts]
jsonpath "$[*]" count == 1
jsonpath "$.TEST[*]" count == 1
jsonpath "$.TEST['30']" count == 2
jsonpath "$.TEST['30'][0].cui" == "C0001122"
jsonpath "$.TEST['30'][0].id" == "31"
jsonpath "$.TEST['30'][1].cui" == "C0001122"
jsonpath "$.TEST['30'][1].id" == "32"
