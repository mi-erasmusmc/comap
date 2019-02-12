/*******************************************************************************
 * Copyright 2017 Erasmus Medical Center, Department of Medical Informatics.
 *
 * This program shall be referenced as “Codemapper”.
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU Affero General Public License as published
 * by the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU Affero General Public License for more details.
 *
 * You should have received a copy of the GNU Affero General Public License
 * along with this program. If not, see <http://www.gnu.org/licenses/>.
 ******************************************************************************/

"use strict";

var relevantSemanticTypes =
        [ "T020", "T190", "T049", "T019", "T047", "T050", "T037", "T048",
          "T191", "T046", "T184", "T033", "T005", "T004", "T204", "T007" ];

var ASSIGNMENT_INCLUDE = "include";
var ASSIGNMENT_EXCLUDE = "exclude";

function conceptHasRelevantSemanticType(concept) {
	return concept.semanticTypes.some(function(type) {
		return relevantSemanticTypes.indexOf(type) != -1;
	});
}

function normalize(text) {
    // Python: print "".join(r"\u%x" % ord(c) for c in u"–—")
    return text
        .replace(/\s/g, ' ')
        .replace(/[\u201e\u201c\u201d]/g, '"')
        .replace(/[\u201a\u2018\u2019\u0060]/g, "'")
        .replace(/[\u2013\u2014]/g, "-")
        .replace(/[\u2265]/g, '>')
        .replace(/[\u2264]/g, '<')
        .replace(/[\u2264]/g, '<')
        .replace(/[\u2022]/g, '*')
        .replace(/[\u00e8\u00e9]/g, 'e')
        .replace(/[\u00e0\u00e1]/g, 'e');
}

function CaseDefinitionCtrl($scope, $timeout, $http, $compile, urls, dataService, blockUI) {

    $scope.text = "";

    $scope.createIndexing = function(caseDefinition) {
        indexText($http, dataService.peregrineResource, dataService.stopwords, urls.umlsConcepts, caseDefinition)
            .then(function(item) {
                console.log("createIndexing");
                $scope.state.indexing = {
                    caseDefinition: caseDefinition,
                    spans: item.spans,
                    concepts: item.concepts,
                    conceptsByCui: byKey(item.concepts, getCui)
                };
                if ($scope.state.cuiAssignment == null) {
                    $scope.state.cuiAssignment = {};
                }
                angular.forEach(item.concepts, function(concept) {
                    if (!$scope.state.cuiAssignment.hasOwnProperty(concept.cui)) {
                        $scope.state.cuiAssignment[concept.cui] = conceptHasRelevantSemanticType(concept) ? ASSIGNMENT_INCLUDE : ASSIGNMENT_EXCLUDE;
                    }
                });
            });
    };

    $scope.resetIndexing = function() {
        console.log("resetIndexing", $scope.$id);
        $scope.text = angular.copy($scope.state.indexing.caseDefinition);
        $scope.state.indexing = null;
    };

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

function indexText($http, peregrineResource, stopwords, umlsConceptsResource, text) {
    var data = {
        text: normalize(text)
    };
    return $http.post(peregrineResource + "/index", data, FORM_ENCODED_POST)
        .error(function(err, status) {
            if (status == 401) {
                alert("Your session has timed out :( You have to re-login!");
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
                                };
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
            $scope.someIncluded = function(cuis) {
                return cuis.some(function(cui) {
                    return $scope.$parent.state.cuiAssignment && $scope.$parent.state.cuiAssignment[cui] != ASSIGNMENT_EXCLUDE;
                });
            };
            $scope.toggle = function(cuis) {
                if ($scope.someIncluded(cuis)) {
                    console.log("Removing", cuis);
                    angular.forEach(cuis, function(cui) {
                        $scope.$parent.state.cuiAssignment[cui] = ASSIGNMENT_EXCLUDE;
                    });
                } else {
                    console.log("Adding", cuis);
                    angular.forEach(cuis, function(cui) {
                        $scope.$parent.state.cuiAssignment[cui] = ASSIGNMENT_INCLUDE;
                    });
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
    };
}

function highlight(dataService, text, spans, concepts) {
    var conceptsByCui = byKey(concepts, getCui);
    var spansByStart = group(spans, function(span) { return span.start; });

    var result = "";
    var ends = [];
    var here = 0;
    angular.forEach(text, function(c) {
        var hereStartSpans = spansByStart[here] || [];
        var hereStartSpansByEnd = group(hereStartSpans, function(span) { return span.end; });
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
        if (c == '\n' || c == '\r') {
            if (ends.length == 0) {
                result += "<br/>";
            } else {
                result += ' ';
            }
        } else {
            result += $('<div/>').text(c).html();
        }
        ends.sort();
        while (ends.length > 0 && ends[0] == here) {
            result += "</concept-in-case-def>";
            ends.shift();
        }
        here += 1;
    });
    while (ends.length > 0) {
        result += "</concept-in-case-def>";
        ends.shift();
    }
    return "<div class='highlight'>" + result + "</div>";
}
