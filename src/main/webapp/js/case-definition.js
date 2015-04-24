function CaseDefinitionCtrl($scope, $timeout, $http, $compile, urls, dataService, blockUI) {

    $scope.text = "";

    $scope.createIndexing = function(caseDefinition) {
        indexText($http, dataService.peregrineResource, dataService.stopwords, urls.umlsConcepts, caseDefinition)
            .then(function(item) {
                var spans = item.spans, concepts = item.concepts;
                console.log(item);
                $scope.state.indexing = {
                    caseDefinition: caseDefinition,
                    spans: spans,
                    concepts: concepts,
                    conceptsByCui: byKey(concepts, getCui)
                };
            });
    };
    
    $scope.resetIndexing = function() {
        $scope.text = angular.copy($scope.state.indexing.caseDefinition);
        $scope.state.indexing = null;
    }
    
    $scope.$watch('state.indexing', function(indexing) {
        $timeout(function() {
            if (angular.isObject(indexing)) {
                var highlighting = highlight(dataService, indexing.caseDefinition, indexing.spans, indexing.concepts);
                jQuery('#highlightedCaseDefinition').html($compile(highlighting)($scope));
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
        .replace(/[\u2013\u2014]/g, "-")
        .replace(/[\u2265]/g, '>')
        .replace(/[\u2264]/g, '<');
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
                    var isStopword = FILTER_BY_STOPWORDS && stopwords.indexOf(span.text.toUpperCase()) != -1;
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

function ConceptInCaseDefDirective() {
    return {
        restrict: 'E',
        transclude: true,
        replace: true,
        templateUrl: 'partials/ConceptInCaseDef.html',
        scope: {
            cuis: '&',
            types: '&',
            state: '='
        },
        link: function(scope, elem, attrs, ctrl) {
            scope.cuis = [];
            scope.type = [];
            attrs.$observe('cuis', function(cuis) {
                scope.cuis = angular.isUndefined(cuis) ? [] : JSON.parse(cuis);
            });
            attrs.$observe('types', function(types) {
                scope.types = angular.isUndefined(types) ? [] : JSON.parse(types);
            });
        },
        controller: function($scope, $timeout, dataService) {
            $scope.isIncluded = function(cuis, types) {
                var scope = $scope.$parent;
                if (angular.isArray(scope.selected.semanticTypes) && angular.isArray(types)) {
                    return 0 < intersection(types, scope.selected.semanticTypes.map(getType)).length
                } else {
                    return true;
                }
            };
            $timeout(function() {
                var title = function(cuis) {
                    var scope = $scope.$parent;
                    if (angular.isArray(cuis) && angular.isObject(scope.state.indexing.conceptsByCui)) {
                        var res = "";
                        return cuis.map(function(cui) {
                            var c = scope.state.indexing.conceptsByCui[cui];
                            var types = c.semanticTypes.map(function(type) {
                                return dataService.semanticTypesByType[type].description;
                            }).join(", ");
                            return (c.preferredName || c.cui) + " (" + types + ")"; 
                        }).join(", ");
                    } else {
                        return null;
                    }
                };
                $scope.title = title($scope.cuis);
            }, 0);
        }
    }
}

function highlight(dataService, text, spans, concepts) {
    var conceptsByCui = byKey(concepts, getCui);
    var spansByStart = group(spans, function(span) { return span.start; });
    
    var result = "";
    var ends = [];
    var here = 0;
    angular.forEach(text, function(c) {
        var hereStartSpans = spansByStart[here] || [];
        hereStartSpansByEnd = group(hereStartSpans, function(span) { return span.end; });
        angular.forEach(hereStartSpansByEnd, function(spans, end) {
            var cuis = spans
                .map(function(span) {
                    return cuiOfId(span.id);
                });
            var concepts = cuis
                .map(function(cui) {
                    return conceptsByCui[cui];
                });
            var types = []
                .concat.apply([], concepts.map(function(concept) {
                    return concept.semanticTypes;
                }))
                .filter(isFirstOccurrence);
            var groups = types
                .map(function(type) {
                    return dataService.semanticTypesByType[type].group;
                })
                .filter(isFirstOccurrence);
            var title = cuis
                .map(function(cui) {
                    var concept = conceptsByCui[cui];
                    var typeNames = concept.semanticTypes
                        .map(function(type) {
                            return dataService.semanticTypesByType[type].description;
                        });
                    return concept.preferredName + " (" + typeNames.join(", ") + ")";
                })
                .join(", ");
            var cuisStr = JSON.stringify(cuis);
            var typesStr = JSON.stringify(types); 
            result += "<concept-in-case-def cuis='" + cuisStr + "' types='" + typesStr + "'>";
            ends.push(end);
        });
        if (c == '\n') {
            result += "<br/>";
        } else {
            result += $('<div/>').text(c).html();
        }
        ends.sort();
        while (ends.length > 0 && ends[0] == here) {
            result += "</concept-in-case-def>"
            ends.shift();
        }
        here += 1;
    });
    while (ends.length > 0) {  
        result += "</concept-in-case-def>"
        ends.shift();
    }
    return "<div class='highlight'>" + result + "</div>";
}