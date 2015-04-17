function CaseDefinitionCtrl($scope, $timeout, $http, urls, dataService, blockUI) {

    $scope.text = "";

    $scope.createIndexing = function(caseDefinition) {
        indexText($http, dataService.peregrineResource, dataService.stopwords, urls.umlsConcepts, caseDefinition)
            .then(function(item) {
                var spans = item.spans, concepts = item.concepts;
                console.log(item);
                $scope.state.indexing = {
                    caseDefinition: caseDefinition,
                    spans: spans,
                    concepts: concepts
                };
            });
    };
    
    $scope.resetIndexing = function() {
        $scope.text = angular.copy($scope.state.indexing.caseDefinition);
        $scope.state.indexing = null;
    }
    
    $scope.$watch('state.indexing', function(indexing) {
        $timeout(function() {
            console.log('### state.indexing changed', indexing);
            if (angular.isObject(indexing)) {
                var highlighting = highlight(dataService, indexing.caseDefinition, indexing.spans, indexing.concepts);
                console.log("Set highlightigh", highlighting);
                jQuery('#highlightedCaseDefinition').html(highlighting);
            } else {
                jQuery('#highlightedCaseDefinition').html("");
            }
        }, 0);
    });
}

function normalize(text) {
    // Python: print "".join(r"\u%x" % ord(c) for c in u"–—")
    return text
        .replace(/[\u201e\u201c\u201d]/g, '"')
        .replace(/[\u201a\u2018\u2019\u0060]/g, "'")
        .replace(/[\u2013\u2014]/g, "-");
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
