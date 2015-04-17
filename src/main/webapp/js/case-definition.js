function CaseDefinitionCtrl($scope, $http, urls, dataService, blockUI) {

    $scope.text = "headache and fever and case definition";

    $scope.createIndexing = function(caseDefinition) {
        indexText($http, dataService.peregrineResource, dataService.stopwords, urls.umlsConcepts, caseDefinition)
            .then(function(item) {
                console.log(item);
                State.setIndexing($scope.state, caseDefinition, item.spans, item.concepts);
            });
    };
    
    $scope.resetIndexing = function() {
        var text = $scope.state.indexing.caseDefinition;
        State.resetIndexing($scope.state);
        $scope.text = text;
    }
}

function normalize(text) {
    return text
        .replace(/[„“”]/g, '"')
        .replace(/[‚‘’]/g, "'");
}

function indexText($http, peregrineResource, stopwords, umlsConceptsResource, text) {
    var data = {
        text: normalize(text)
    };
    return $http.post(peregrineResource + "/index", data, FORM_ENCODED_POST)
        .error(function(err, status) {
            if (status == 401) {
                alert("Your session has timed out :( You have to re-login!")
            } else {
                var msg = "ERROR: Couldn't search concepts in case definition at " + peregrineResource;
                console.log(msg, err);
                alert(msg);
            }
        })
        .then(function(result) { 
            var spans = result.data.spans
                .filter(function(span) {
                    var isStopword = stopwords.indexOf(span.text.toUpperCase()) != -1;
                    var isFiltered = STOPWORDS_REGEX.test(span.text);
                    if (isStopword || isFiltered) {
                        console.log("Filter span", span.text, isStopword ? "as stopword" : "", isFiltered ? "as regex" : "");
                    }
                    return !(isStopword || isFiltered);
                });
            var cuis = spans.map(function(span) { return cuiOfId(span.id); });
            var data = {
                cuis : cuis
            };
            return $http.post(umlsConceptsResource, data, FORM_ENCODED_POST)
                .then(function(result) {
                    return {
                        spans: spans,
                        concepts: result.data
                            .map(function(concept) {
                                return {
                                    cui: concept.cui,
                                    preferredName: concept.preferredName,
                                    semanticTypes: concept.semanticTypes
                                }
                            })
                    };
                });
        });
}