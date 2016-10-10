
"use strict";

var DEFAULT_CODING_SYSTEMS = ["ICD9CM", "ICD10", "ICD10CM", "MTHICD9", "ICPC2EENG", "ICPC2P", "RCD2"];

var SHOW_UMLS_COLUMN = false;
var FILTER_BY_STOPWORDS = false;

/**
 * Concepts found by Peregrine are filtered by a stopword list and by the
 * following regex matching three-digit numbers and two-letter words.
 */
var STOPWORDS_REGEX = /^(\d{1,3}|\S{1,2})$/;

function historyDatumToString(data) {
    if (data == null) {
        return null;
    } else if (angular.isString(data)) {
        return data;
    } else if (angular.isArray(data)) {
        return data.map(function(concept) { return (concept.preferredName || "?").replace(/,/g, " "); }).join(", ");
    } else if (angular.isObject(data)) {
        return data.preferredName;
    }
}

function handleError(err, status) {
    if (status == 401) {
        alert("Your session has timed out :( You have to re-login!");
    } else {
        alert(err, status);
    }
}

// Patch: adapt concepts for the code mapper application
function patchConcept(concept0, codingSystems, semanticTypesByType) {
    var concept = angular.copy(concept0);
    if (concept.preferredName == null) {
        concept.preferredName = concept.cui;
    }
    // Add field `codes` that is a mapping from coding systems to
    // source concepts
    concept.codes = {};
    codingSystems.forEach(function(codingSystem) {
        concept.codes[codingSystem] = concept.sourceConcepts
            .filter(function(sourceConcept) {
                return sourceConcept.codingSystem == codingSystem;
            })
            .map(function(sourceConcept) {
                // Select all codes by default
                sourceConcept.selected = true;
                return sourceConcept;
            });
    });
    // Add the count of source codes
    concept.sourceConceptsCount = concept.sourceConcepts.length;
    // Enrich information about semantic types by descriptions and
    // groups.
    var types = concept.semanticTypes
        .map(function(type) {
            return semanticTypesByType[type].description;
        })
        .filter(function(v, ix, arr) {
            return ix == arr.indexOf(v);
        });
    var groups = concept.semanticTypes
        .map(function(type) {
            return semanticTypesByType[type].group;
        })
        .filter(function(v, ix, arr) {
            return ix == arr.indexOf(v);
        });
    concept.semantic = {
        types: types,
        groups: groups
    };
    return concept;
}

function upgradeState(state) {
    state = angular.copy(state);
    if (!state.hasOwnProperty("cuiAssignment")) {
        console.log("Upgrade state: create cuiAssignment");
        state.cuiAssignment = {};
        angular.forEach(state.indexing.concepts, function(concept) {
            state.cuiAssignment[concept.cui] = conceptHasRelevantSemanticType(concept) ?
                ASSIGNMENT_INCLUDE : ASSIGNMENT_EXCLUDE;
        });
    }
    if (!state.hasOwnProperty("codingSystems")) {
        console.log("Upgrade state: move codingSystems");
        state.codingSystems = state.mapping.codingSystems;
        delete state.mapping.codingSystems;
    }
    if (state.mapping.concepts.some(function(concept) {
        return concept.sourceConcepts.some(function(sourceConcept) {
            return !sourceConcept.hasOwnProperty('codingSystem');
        });
    })) {
        console.log("Upgrade vocabulary field");
        angular.forEach(state.mapping.concepts, function(concept) {
            angular.forEach(concept.sourceConcepts, function(sourceConcept) {
                if (!sourceConcept.hasOwnProperty('codingSystem')) {
                    sourceConcept['codingSystem'] = sourceConcept['vocabulary'];
                }
            });
        });
    }
    if (!state.hasOwnProperty("targetDatabases")) {
        state.targetDatabases = {};
    }
    state.mapping.history.sort(function(s1, s2) {
        return -s1.date.localeCompare(s2.date);
    });
    return state;
}

function hasAnyTags(concepts) {
    var res = concepts && concepts.some(function(concept) {
        return concept.tags && concept.tags.length > 0;
    });
    return res;
}

function everyTags(concepts) {
    var res = [];
    if (concepts) {
        res = concepts[0].tags;
        concepts.forEach(function(concept) {
            if (res) {
                res = res.filter(function(t) {
                    return concept.tags.indexOf(t) != -1;
                });
            } else {
                res = [];
            }
        });
    }
    return res;
}

function anyTags(concepts) {
    return [].concat.apply([], concepts.map(function(concept) {
        return concept.tags || [];
    })).filter(function(v, ix, arr) {
        return ix == arr.indexOf(v);
    });
}

function getConceptsMissingCodes(state) {
    // console.log("getConceptsMissingCodes", state);
    var conceptGroups = {}; // {CUI|TAG: [CONCEPT]}
    state.mapping.concepts.forEach(function(concept) {
        var tags = (concept.tags || [])
            .filter(function(tag) {
                return !(/^[A-Z0-9_]+$/.test(tag));
            });
        if (tags.length > 0) {
            tags.forEach(function(tag) {
                if (!conceptGroups.hasOwnProperty(tag)) {
                    conceptGroups[tag] = [];
                }
                conceptGroups[tag].push(concept);
            });
        } else {
            conceptGroups[concept.cui] = [concept];
        }
    });

    var vocabularyGroups = {}; // {VOC|DB: [VOC]}
    state.codingSystems.forEach(function(voc) {
        if (state.targetDatabases.hasOwnProperty(voc)) {
            state.targetDatabases[voc].forEach(function(db) {
                if (!vocabularyGroups.hasOwnProperty(db)) {
                    vocabularyGroups[db] = [];
                }
                vocabularyGroups[db].push(voc);
            });
        } else {
            vocabularyGroups[voc] = [voc];
        }
    });


    // {CUI|TAG: {VOC|DB: [CODE]}}
    var codeSets = objectMap(conceptGroups, function(concepts) {
        return objectMap(vocabularyGroups, function(vocs) {
            return flatten(concepts.map(function(concept) {
                return flatten(vocs.map(function(voc) {
                    return concept.codes[voc]
                        .map(function(sourceConcept) {
                            return sourceConcept.id;
                        });
                }));
            })).filter(unique);
        });
    });

    // {CUI|TAG: [VOC|DB]}
    var missings = objectMap(codeSets, function(codesByDb, cuiTag) {
        var dbs = [];
        angular.forEach(codesByDb, function(codes, db) {
            if (codes.length == 0) {
                dbs.push(db);
            }
        });
        if (dbs.length > 0) {
            return dbs;
        } else {
            return undefined;
        }
    });

    var res = {};
    state.mapping.concepts.forEach(function(concept) {
        var forConcept = [];
        if (missings.hasOwnProperty(concept.cui)) {
            forConcept = forConcept.concat(missings[concept.cui]);
        }
        (concept.tags || []).forEach(function(tag) {
            if (missings.hasOwnProperty(tag)) {
                forConcept = forConcept.concat(missings[tag]);
            }
        });
        if (forConcept.length > 0) {
            res[concept.cui] = forConcept;
        }
    });

    return res;
}

function insertConcepts(concepts, selectedConcepts, scope, operation, descr) {

    // Inherit tags
    var tags = everyTags(concepts);
    selectedConcepts.forEach(function(concept) {
        concept.tags = tags;
    });

    // Search position of original inital concepts
    var conceptOffsets = {};
    concepts.map(getCui).forEach(function(cui) {
        scope.state.mapping.concepts.forEach(function(c, cIx) {
            if (c.cui == cui) {
                conceptOffsets[cui] = cIx;
            }
        });
    });
    console.log(conceptOffsets);

    // Insert each related concept in list of concepts
    selectedConcepts.forEach(function(related, ix) {
        var offset = ++conceptOffsets[related.origin.data.cui];
        scope.state.mapping.concepts.splice(offset, 0, related);
    });
    scope.setSelectedConcepts(selectedConcepts.map(getCui));

    scope.conceptsMissingCodes = getConceptsMissingCodes(scope.state);

    scope.historyStep(operation, concepts.map(reduceConcept), selectedConcepts.map(reduceConcept), descr);
}

function CodeMapperCtrl($scope, $rootScope, $http, $sce, $modal, $timeout, $interval, $q, $log, $routeParams, $location, config, urls, dataService, user) {

    $scope.user = user;
    $scope.project = $routeParams.project;
    $scope.caseDefinitionName = $routeParams.caseDefinitionName;

    var roles = user.projectPermissions[$scope.project];

    $rootScope.subsubtitle = $scope.project + ':';
    $rootScope.subtitle = $scope.caseDefinitionName;

    $scope.state = State.empty();
    $scope.conceptsMissingCodes = {};
    $scope.numberUnsafedChanges = 0;
    $scope.showVocabulary = {};

    dataService.completed
        .then(function() {
            $scope.loadTranslations();
        });

    $scope.activateTab = function(id) {
        $timeout(function() {
            $("#" + id + " > a").click();
        }, 0);
    };

    $scope.$on('$locationChangeStart', function(ev) {
        if ($scope.numberUnsafedChanges > 0) {
            var really = confirm("Your unsafed changes are lost when navigating away. Really?");
            if (!really) {
                ev.preventDefault();
            }
        }
    });

    $scope.userCanEdit = function() {
        return roles.indexOf('Editor') != -1;
    };

    /* KEYBOARD */

    var ctrlKeydownCallbacks = {
        48 /* 0 */: function() {
            console.log("State", $scope.state, $scope.conceptsMissingCodes);
        }
    };

    $rootScope.onKeydown = function(event) {
        if (event.ctrlKey) {
            var callback = ctrlKeydownCallbacks[event.keyCode];
            if (callback) {
                callback();
            }
        }
    };

    /* MESSAGE */

    $scope.message = null;
    var timeout = null;
    $scope.setMessage = function(message, timeout) {
        $scope.message = message;
        if (timeout) {
            if (timeout != null) {
                $timeout.cancel(timeout);
            }
            timeout = $timeout(function() {
                $scope.unsetMessage();
            }, timeout);
        }
    };
    $scope.unsetMessage = function(msg) {
        if (angular.isUndefined(msg) || $scope.message == msg) {
            $scope.message = null;
        }
    };

    /* HISTORY */

    /** Create a history step for $scope.state.history */
    $scope.historyStep = function(operation, argument, result, descr) {
        $scope.numberUnsafedChanges += 1;
        $scope.state.mapping.history.unshift({
            date: new Date().toJSON(),
            operation: operation,
            argument: argument,
            result: result,
            user: user.username
        });
    };

    $scope.historyGridOptions = {
        data: "state.mapping.history",
        rowHeight: 70,
        headerRowHeight: 35,
        columnDefs: historyColumnDefs,
        enableRowSelection: false
    };

    /* CONCEPTS */

    $scope.conceptsColumnDefs = createConceptsColumnDefs(false, [], true, false, {}, {});
    $scope.conceptsGridOptions = {
        data: "state.mapping.concepts",
        rowHeight: 70,
        headerRowHeight: 35,
        multiSelect: false,
        keepLastSelected: false,
        columnDefs: 'conceptsColumnDefs',
        enableRowSelection: $scope.userCanEdit,
        enableCellSelection: $scope.userCanEdit,
        filterOptions: { filterText: '' }
        //plugins: [new ngGridFlexibleHeightPlugin()]
    };

    $scope.$watch('state.mapping', function(mapping) {
        if (mapping == null) {
            $scope.selectedConcepts = [];
        } else {
            $timeout(function() {
                if (angular.isObject(mapping)) {
                    $scope.selectedConcepts = $scope.conceptsGridOptions.$gridScope.selectedItems;
                } else {
                    $scope.selectedConcepts = [];
                }
            }, 0);
        }
    });

    $scope.setSelectedConcepts = function(cuis) {
        $timeout(function() {
            $scope.conceptsGridOptions.selectAll(false);
            $scope.state.mapping.concepts.forEach(function(concept, index) {
                var selected = cuis.indexOf(concept.cui) != -1;
                $scope.conceptsGridOptions.selectItem(index, selected);
            });
        }, 0);
    };

    /* COMMENTS */

    $scope.showComments = function(concept) {
        if ($scope.state.mapping !== null) {
            $scope.updateComments()
                .success(function() {
                    showComments($modal, concept, true)
                        .then(function(comment) {
                            var url = urls.comments($scope.project, $scope.caseDefinitionName);
                            var data = {
                                cui: concept.cui,
                                comment: comment
                            };
                            console.log(url, data);
                            return $http.post(url, data, FORM_ENCODED_POST)
                                .error(function(err, code) {
                                    switch (code) {
                                    case 401:
                                        alert("You are not member for project " + $scope.project + ":(");
                                        break;
                                    default:
                                        alert("Unknow error", err, code);
                                    }
                                })
                                .success(function() {
                                    $scope.updateComments();
                                });
                        });
                });
        }
    };

    $scope.updateComments = function() {
        var message = "Cannot load comments :( The server might be unavailable.";
        if ($scope.state.mapping !== null) {
            return $http.get(urls.comments($scope.project, $scope.caseDefinitionName))
                .error(function(err, code) {
                    switch (code) {
                    case 401:
                        $scope.setMessage("Your session timed out :( Please reload.");
                        console.log("Not authorized.", err);
                        break;
                    default:
                        $scope.setMessage(message);
                        console.log("Cannot load comments.", err, code);
                    }
                })
                .success(function(comments) {
                    $scope.unsetMessage(message);
                    var commentsByCui = {};
                    angular.forEach(comments, function(comment) {
                        comment.timestamp = new Date(comment.timestamp);
                        if (!commentsByCui.hasOwnProperty(comment.cui)) {
                            commentsByCui[comment.cui] = [];
                        }
                        commentsByCui[comment.cui].push(comment);
                    });
                    $timeout(function() {
                        if ($scope.state.mapping != null) {
                            $scope.state.mapping.concepts.forEach(function(concept) {
                                var comments = [];
                                if (commentsByCui.hasOwnProperty(concept.cui)) {
                                    comments = commentsByCui[concept.cui];
                                }
                                concept.comments = comments;
                            });
                        }
                    }, 0);
                });
        } else {
            return null;
        }
    };

    var updateCommentsPromise = null;

    $scope.intervalUpdateComments = function(startNotStop) {
        if (startNotStop) {
            $scope.updateComments();
            if (updateCommentsPromise == null) {
                updateCommentsPromise = $interval($scope.updateComments, config.commentsReloadInterval);
            }
        } else {
            if (updateCommentsPromise != null) {
                $interval.cancel(updateCommentsPromise);
                updateCommentsPromise = null;
            }
        }
    };

    $scope.$on('$routeChangeStart', function(scope, next, current) {
        // Stop interval update comments when leaving
        $scope.intervalUpdateComments(false);
    });

    /* FUNCTIONS */

    /** Load coding or create new coding. */
    $scope.loadTranslations = function() {
        $http.get(urls.caseDefinition($scope.project, $scope.caseDefinitionName))
            .error(function(err, code, a2) {
                switch (code) {
                case 401:
                    alert("You are not member for project " + $scope.project + ":(");
                    $location.path('/overview');
                    break;
                case 404:
                    $scope.state.mapping = null;
                    $scope.state.indexing = null;
                    $scope.state.codingSystems = DEFAULT_CODING_SYSTEMS.slice();
                    $scope.showVocabularies = {};
                    angular.forEach($scope.state.codingSystems, function(voc) {
                        $scope.showVocabularies[voc] = true;
                    });
                    $scope.state.targetDatabases = {};
                    $scope.conceptsMissingCodes = {};
                    $scope.caseDefinition = "";
                    $rootScope.subtitle = $scope.caseDefinitionName + ' (NEW MAPPING)';
                    break;
                } 
            })
            .success(function(state) {
                console.log("Loaded", state);
                $scope.state = upgradeState(state);
                $scope.showVocabularies = {};
                angular.forEach($scope.state.codingSystems, function(voc) {
                    $scope.showVocabularies[voc] = true;
                });
                $scope.conceptsMissingCodes = getConceptsMissingCodes($scope.state);
                $scope.$broadcast("indexingUpdated", $scope.state.indexing);
                $scope.conceptsColumnDefs = createConceptsColumnDefs(false, $scope.state.codingSystems, true,
                        hasAnyTags($scope.state.mapping.concepts), $scope.state.targetDatabases, $scope.showVocabularies);
                $scope.activateTab("concepts-tab");
                if (angular.isArray(roles) && roles.indexOf('Commentator') != -1) {
                    $scope.setMessage("Click the speech baloon in the column on the right to view or add comments for a concept.");
                }
                $scope.intervalUpdateComments(true);
            })
        ['finally'](function() {
            $scope.numberUnsafedChanges = 0;
            $scope.conceptsColumnDefs = createConceptsColumnDefs(false, $scope.state.codingSystems, true,
                    hasAnyTags($scope.state.mapping.concepts), $scope.state.targetDatabases, $scope.showVocabularies);
        });
    };

    /** Ask a summary of recent changes and save/upload the coding. */
    $scope.saveMapping = function() {
        if ($scope.state.mapping == null) {
            error("CodeMapperCtrl.expandRelated called without state");
            return;
        }
        askSummary($modal, $scope.caseDefinitionName, $scope.state.mapping.history, $scope.numberUnsafedChanges)
            .then(function(summary) {
                $scope.historyStep("Summarize", summary, null);
                var state = angular.copy($scope.state);
                angular.forEach(state.concepts, function(concept) {
                    delete concept.comments;
                });
                var data = {
                    state: angular.toJson(state)
                };
                $http.post(urls.caseDefinition($scope.project, $scope.caseDefinitionName), data, FORM_ENCODED_POST)
                    .error(function(e, status) {
                        if (status == 401) {
                            alert("Your session has timed out :( You have to re-login!");
                        } else {
                            var msg = "ERROR: An error occurred while saving";
                            alert(msg);
                        }
                    })
                    .success(function() {
                        $scope.intervalUpdateComments(true);
                        $scope.numberUnsafedChanges = 0;
                        $rootScope.subtitle = $scope.caseDefinitionName; // Remove NEW (...) from fresh mappings
                    });
            });
    };

    $scope.changeCodingSystems = function() {
        console.log("changeCodingSystems", dataService);
        selectCodingSystemsDialog($modal, dataService.codingSystems, $scope.state.codingSystems, $scope.state.targetDatabases, $scope.showVocabularies)
            .then(function(res) {
                console.log("Change coding systems", res);
                var addCodingSystems = res.codingSystems
                                .filter(function(codingSystem) {
                                    return $scope.state.codingSystems.indexOf(codingSystem) == -1;
                                });
                var removeCodingSystems = $scope.state.codingSystems
                    .filter(function(codingSystem) {
                        return res.codingSystems.indexOf(codingSystem) == -1;
                    });
                if (addCodingSystems.length > 0 || removeCodingSystems.length > 0) {
                    console.log("change coding systems", res.codingSystems, addCodingSystems, removeCodingSystems);
                    var data = {
                        cuis: $scope.state.mapping.concepts.map(getCui),
                        codingSystems: addCodingSystems
                    };
                    $http.post(urls.umlsConcepts, data, FORM_ENCODED_POST)
                        .success(function(newConcepts) {
                            var newConceptsByCui = byKey(newConcepts, getCui);
                            $scope.showVocabularies = res.showVocabularies;
                            $scope.state.codingSystems = res.codingSystems;
                            $scope.state.targetDatabases = res.targetDatabases;
                            $scope.state.mapping.concepts = $scope.state.mapping.concepts.map(function(concept) {
                                // Remove source concepts
                                concept.sourceConcepts = concept.sourceConcepts
                                    .filter(function(sourceConcept) {
                                        return res.codingSystems.indexOf(sourceConcept.codingSystem) != -1;
                                    });
                                // Add source concepts
                                if (newConceptsByCui.hasOwnProperty(concept.cui)) {
                                    angular.forEach(newConceptsByCui[concept.cui].sourceConcepts, function(sourceConcept) {
                                        concept.sourceConcepts.push(sourceConcept);
                                    });
                                }
                                return patchConcept(concept, res.codingSystems, dataService.semanticTypesByType);
                            });
                            $scope.conceptsMissingCodes = getConceptsMissingCodes($scope.state);
                            $scope.conceptsColumnDefs = createConceptsColumnDefs(false, $scope.state.codingSystems, true,
                                    hasAnyTags($scope.state.mapping.concepts), $scope.state.targetDatabases, $scope.showVocabularies);
                            var argAdded = addCodingSystems.map(function(voc) { return "+"+voc; }).join(", ");
                            var argRemoved = removeCodingSystems.map(function(voc) { return "-"+voc; }).join(", ");
                            var arg =  argAdded + (argAdded && argRemoved ? ", " : "") + argRemoved;
                            var result = $scope.state.codingSystems.join(", ");
                            $scope.historyStep("Change coding systems", arg, result, null);
                        });
                } else {
                    $scope.showVocabularies = res.showVocabularies;
                    $scope.conceptsColumnDefs = createConceptsColumnDefs(false, $scope.state.codingSystems, true,
                            hasAnyTags($scope.state.mapping.concepts), $scope.state.targetDatabases, $scope.showVocabularies);
                    var changedTargetDatabases = false;
                    angular.forEach($scope.state.codingSystems, function(voc) {
                        if (!setEquals($scope.state.targetDatabases[voc]||[], res.targetDatabases[voc]||[])) {
                            changedTargetDatabases = true;
                        }
                    });
                    if (changedTargetDatabases) {
                        $scope.state.targetDatabases = res.targetDatabases;
                        $scope.conceptsMissingCodes = getConceptsMissingCodes($scope.state);
                        $scope.historyStep("Change target databases", null, null, null);
                    }
                }
            });
    };
    
    $scope.createInitalTranslations = function(caseDefinition) {
        $log.info("Create initial coding");
        if ($scope.state.mapping != null || $scope.state.indexing == null) {
            error("CodeMapperCtrl.searchConcepts called with state or without indexing", $scope.state);
            return;
        }
        $scope.state.mapping = {
            concepts: null,
            history: []
        };
        $scope.state.showVocabularies = {};
        angular.forEach($scope.state.codingSystems, function(voc) {
            $scope.state.showVocabularies[voc] = true;
        });
        $scope.conceptsColumnDefs = createConceptsColumnDefs(false, $scope.state.codingSystems, true,
                false, $scope.state.targetDatabases, $scope.showVocabularies);
        var concepts = $scope.state.indexing.concepts
            .filter(function(concept) {
                return $scope.state.cuiAssignment[concept.cui] != ASSIGNMENT_EXCLUDE;
            });
        var data = {
            cuis: concepts.map(getCui),
            codingSystems: $scope.state.codingSystems
        };
        $http.post(urls.umlsConcepts, data, FORM_ENCODED_POST)
            .success(function(concepts) {
                $scope.state.mapping.concepts = concepts
                    .map(function(concept0) {
                        var concept = patchConcept(concept0, $scope.state.codingSystems, dataService.semanticTypesByType);
                        concept.origin = {
                            type: "spans",
                            data: $scope.state.indexing.spans
                                .filter(function(span) {
                                    return cuiOfId(span.id) == concept.cui;
                                })[0],
                            root: null
                        };
                        return concept;
                    });
                $scope.conceptsMissingCodes = getConceptsMissingCodes($scope.state);
                var descr = "Automatic mapping created.";
                $scope.historyStep("Automatic coding", null, $scope.state.mapping.concepts.map(reduceConcept), descr);
                $scope.intervalUpdateComments(true);
            });
    };

    /** Generate a list of UMLS concept names with a given prefix. */
    $scope.autocompleteConcepts = function(str) {
        var params = {
            str: str
        };
        return $http.get(urls.autocomplete, { params: params })
            .then(function(completions) {
                if (completions.status == 200) {
                    var currentCuis = $scope.state.mapping.concepts.map(getCui);
                    return completions.data
                        .filter(function(c) {
                            return currentCuis.indexOf(c.cui) == -1;
                        })
                        .sort(function(s1, s2) {
                            return s1.preferredName.length - s2.preferredName.length
                                || s1.preferredName.localeCompare(s2.preferredName);
                        });
                } else {
                    return null;
                }
            });
    };

    /**
     * Index a given query string for concepts, retrieve information and select
     * concepts in a dialog for inclusion.
     */
    $scope.searchAndAddConcepts = function(searchQuery) {
        if ($scope.state.mapping == null) {
            error("CodeMapperCtrl.searchAndAddConcepts called without mapping");
            return;
        }
        var currentCuis = $scope.state.mapping.concepts.map(getCui);
        var filteredBySemanticType = [], filteredByCurrentConcepts = [];
        indexText($http, dataService.peregrineResource, dataService.stopwords, urls.umlsConcepts, searchQuery)
            .then(function(item) {
                return item.concepts
                    .filter(function(c, ix, a) {
                        var newInMapping = currentCuis.indexOf(c.cui) == -1;
                        if (!newInMapping) {
                            filteredByCurrentConcepts.push(c);
                        }
                        return newInMapping;
                    })
                    .map(getCui);
            })
            .then(function(cuis) {
                var data = {
                    cuis: cuis,
                    codingSystems: $scope.state.codingSystems
                };
                return $http.post(urls.umlsConcepts, data, FORM_ENCODED_POST)
                    .then(function(result) {
                        var concepts = result.data;
                        concepts = concepts
                            .map(function(concept0) {
                                var concept = patchConcept(concept0, $scope.state.codingSystems, dataService.semanticTypesByType);
                                concept.origin = {
                                    type: "search",
                                    data: searchQuery,
                                    root: null
                                };
                                return concept;
                            });
                        var comments = [];
                        if (filteredBySemanticType.length > 0) {
                            comments.push("filtered " + filteredBySemanticType.length + " by semantic types");
                        }
                        if (filteredByCurrentConcepts.length > 0) {
                            comments.push("filtered " + filteredByCurrentConcepts.length + " by current coding");
                        }
                        comments = comments.length > 0 ? " (" + comments.join(", ") + ")" : "";
                        if (concepts.length == 0) {
                            $scope.setMessage("No concepts found" + comments);
                            return null;
                        } else {
                            var title = "Concepts for search query \"" + searchQuery + "\"";
                            var message = "Found " + concepts.length + " concepts" + comments;
                            return selectConceptsInDialog($modal, concepts, title, true, message, $scope.state.codingSystems, $scope.state.targetDatabases)
                                .then(function(selectedConcepts) {
                                    if (angular.isArray(selectedConcepts)) {
                                        $scope.state.mapping.concepts = [].concat(selectedConcepts, $scope.state.mapping.concepts);
                                        $scope.conceptsMissingCodes = getConceptsMissingCodes($scope.state);
                                        $scope.setSelectedConcepts(selectedConcepts.map(getCui));
                                        var descr = "Added " + selectedConcepts.length + " concepts by search on \"" + searchQuery + "\"";
                                        $scope.historyStep("Search", searchQuery, selectedConcepts.map(reduceConcept), descr);
                                        $scope.searchQuery = "";
                                    }
                                });
                        }
                    });
            });
    };

    $scope.searchAndAddConceptDirect = function(concept0) {
        console.log("Search&add direct", concept0);
        var data = {
            cuis : [concept0.cui],
            codingSystems : $scope.state.codingSystems
        };
        $http.post(urls.umlsConcepts, data, FORM_ENCODED_POST)
            .error(handleError)
            .success(function(concepts) {
                var concept = patchConcept(concepts[0], $scope.state.codingSystems, dataService.semanticTypesByType);
                concept.origin = {
                    type: "add",
                    data: concept.preferredName,
                    root: null
                };
                $scope.state.mapping.concepts = [].concat([concept], $scope.state.mapping.concepts);
                $scope.conceptsMissingCodes = getConceptsMissingCodes($scope.state);
                $scope.setSelectedConcepts([concept.cui]);
                var descr = "Added concept " + concept.preferredName;
                $scope.historyStep("Add", null, reduceConcept(concept), descr);
                $scope.searchQuery = "";
            });
    };

    /** Reset the coding of the case definition by deleting the state. Re-enable
     * input for case definition, semantic types and coding systems. */
    $scope.discardMapping = function() {
        console.log("DISCARD");
        $scope.$apply(function() {
            $scope.intervalUpdateComments(false);
            $scope.state.mapping = null;
            $scope.conceptsMissingCodes = null;
            $scope.conceptsColumnDefs = createConceptsColumnDefs(false, [], false, false, {}, {});
        });
    };

    /** Delete a concepts from $scope.state.concepts by its cui. */
    $scope.operationDeleteConcepts = function(concepts) {
        if ($scope.state == null || $scope.state.mapping == null) {
            error("CodeMapperCtrl.deleteConcept called without mapping");
            return;
        }
        $scope.$apply(function() {
            var cuis = concepts.map(getCui);
            var deletedCuis = [];
            var deletedNames = [];
            $scope.state.mapping.concepts = $scope.state.mapping.concepts
                .filter(function(concept) {
                    if (cuis.indexOf(concept.cui) != -1) {
                        deletedNames.push(concept.preferredName);
                        deletedCuis.push(concept.cui);
                        return false;
                    } else {
                        return true;
                    }
                });
            $scope.conceptsMissingCodes = getConceptsMissingCodes($scope.state);
            $scope.setSelectedConcepts([]);
            var descr = "Deleted " + deletedCuis.length + " " + pluralize("concept", deletedCuis.length);
            $scope.historyStep("Delete", concepts.map(reduceConcept), null, descr);
        });
    };

    $scope.operationSuggestConcepts = function(concepts_) {
        if ($scope.state == null || $scope.state.mapping == null) {
            error("CodeMapperCtrl.expandRelated called without mapping");
            return;
        }
        if (concepts_.length != 1) {
            error("Suggest concepts must be called with one selected concept");
            return;
        }
        var concept = concepts_[0];
        var cuis = [concept.cui];
        var missingCodingSystems = ($scope.conceptsMissingCodes[concept.cui] || [])
            .map(function(vocOrDb) {
                if ($scope.state.codingSystems.indexOf(vocOrDb) != -1) {
                    // vocOrDb is a vocabulary
                    return [vocOrDb];
                } else {
                    // vocOrDb is a database
                    var forDb = [];
                    angular.forEach($scope.state.targetDatabases, function(databases, voc) {
                        if (databases.indexOf(vocOrDb) != -1) {
                            forDb.push(voc);
                        }
                    });
                    return forDb;
                }
                return $scope.state.targetDatabases[vocOrDb] || [vocOrDb];
            });
        missingCodingSystems = flatten(missingCodingSystems).filter(unique);
        var excludeCuis = $scope.state.mapping.concepts.map(getCui);
        var data = {
            cuis: cuis,
            codingSystems: $scope.state.codingSystems,
            missingCodingSystems: missingCodingSystems,
            relations: ["PAR", "CHD", "RN", "RB"],
            excludeCuis: excludeCuis
        };
        console.log("d", data);
        $http.post(urls.suggestConcepts, data, FORM_ENCODED_POST)
            .error(function(err, status) {
                if (status == 401) {
                    alert("Your session has timed out :( You have to re-login!");
                } else {
                    var msg = "ERROR: Couldn't lookup related concepts at " + urls.relatedConcepts;
                    alert(msg);
                    console.log(msg, err);
                }
            })
            .success(function(suggestedConcepts) {
                suggestedConcepts = suggestedConcepts
                    .map(function(concept) {
                        return patchConcept(concept, $scope.state.codingSystems, dataService.semanticTypesByType);
                    });
                suggestedConcepts.forEach(function(c) {
                    c.origin = {
                        type: "suggested",
                        data: {
                            cui: concept.cui,
                            preferredName: concept.preferredName
                        },
                        root: reduceConcept(concept)
                    };
                });
                var title = "Concepts suggested for " + concept.preferredName;
                console.log(suggestedConcepts);
                selectConceptsInDialog($modal, suggestedConcepts, title, true, null, $scope.state.codingSystems, $scope.state.targetDatabases)
                    .then(function(selectedConcepts) {
                        var operation = "suggest";
                        var descr = "Suggested " + selectedConcepts.length + " for " + concept.preferredName;
                        insertConcepts([concept], selectedConcepts, $scope, operation, descr);
                    });
            })
        ['finally'](function() {
            blockUI.stop();
        });
    };

    /**
     * Expand a given concept to its hypernyms or hyponyms, show selection
     * dialog and integrate in the list of concepts ($scope.state.concepts).
     */
    $scope.operationExpandRelatedConcepts = function(concepts, hyponymsNotHypernyms) {
        if ($scope.state == null || $scope.state.mapping == null) {
            error("CodeMapperCtrl.expandRelated called without mapping");
            return;
        }
        var conceptNames =concepts.length <= 3
            ? concepts.map(function(c) { return c.preferredName; }).join(", ")
        : concepts.length + " " + pluralize("concept", concepts);
        var hyponymOrHypernym = hyponymsNotHypernyms ? "hyponym" : "hypernym";
        var cuis = concepts.map(getCui);
        var data = {
            cuis: cuis,
            hyponymsNotHypernyms: hyponymsNotHypernyms,
            codingSystems: $scope.state.codingSystems
        };
        var currentCuis = $scope.state.mapping.concepts.map(getCui);
        // Retrieve related concepts from the API
        $http.post(urls.relatedConcepts, data, FORM_ENCODED_POST)
            .error(function(err, status) {
                if (status == 401) {
                    alert("Your session has timed out :( You have to re-login!");
                } else {
                    var msg = "ERROR: Couldn't lookup related concepts at " + urls.relatedConcepts;
                    alert(msg);
                    console.log(msg, err);
                }
            })
            .success(function(relatedConceptsByCuis) {
                var relatedConcepts = [];
                angular.forEach(relatedConceptsByCuis, function(relatedConceptsForCui, forCui) {

                    var relatedConceptsCuis = relatedConcepts.map(getCui);
                    relatedConceptsForCui = relatedConceptsForCui
                        .filter(function(c, ix, a) {
                            return currentCuis.indexOf(c.cui) == -1 // Not yet in mapping
                                && relatedConceptsCuis.indexOf(c.cui) == -1 // Not a duplication for another CUI
                                && isFirstOccurrence(c, ix, a) // Not a duplication for this CUI
                            ;
                        })
                        .map(function(concept) {
                            return patchConcept(concept, $scope.state.codingSystems, dataService.semanticTypesByType);
                        });

                    relatedConceptsForCui.forEach(function(c) {
                        c.origin = {
                            type: hyponymOrHypernym,
                            data: {
                                cui: forCui,
                                preferredName: concepts.filter(function(c1) { return forCui == c1.cui; })[0].preferredName
                            },
                            root: reduceConcept(concepts[concepts.map(getCui).indexOf(forCui)])
                        };
                    });
                    relatedConcepts = relatedConcepts.concat(relatedConceptsForCui);
                });
                var specificOrGeneral = hyponymsNotHypernyms ? "specific" : "general";
                var title = "Concepts that are more " + specificOrGeneral + " than " + conceptNames;
                selectConceptsInDialog($modal, relatedConcepts, title, true, null, $scope.state.codingSystems, $scope.state.targetDatabases)
                    .then(function(selectedConcepts) {
                        var descr = "Expanded " + conceptNames +
                            " with " + selectedConcepts.length +
                            " " + pluralize(hyponymOrHypernym, selectedConcepts);
                        var operation = hyponymsNotHypernyms ? "Expand to more specific" : "Expand to more general";
                        insertConcepts(concepts, selectedConcepts, $scope, operation, descr);
                    });
            })
        ['finally'](function() {
            blockUI.stop();
        });
    };

    $scope.operationEditTags = function(concepts, allConcepts) {
        editTags($modal, concepts, allConcepts)
            .then(function(newTags) {
                console.log("Set tags", concepts, newTags);
                concepts.forEach(function(concept) {
                    concept.tags = newTags;
                });
                var tagsString = "";
                newTags.forEach(function(t) {
                    if (tagsString != "") {
                        tagsString += ", ";
                    }
                    tagsString += t;
                });
                $scope.conceptsMissingCodes = getConceptsMissingCodes($scope.state);
                $scope.historyStep("Set tags", concepts.map(reduceConcept), tagsString);
                $scope.conceptsColumnDefs = createConceptsColumnDefs(false, $scope.state.codingSystems, true,
                                                                     hasAnyTags($scope.state.mapping.concepts), $scope.state.targetDatabases, $scope.state.showVocabularies);
            });
    };

    $scope.operationEditCodes = function(concepts) {
        editCodes($modal, concepts, $scope.state.codingSystems)
            .then(function(codes) {
                function isSelected(cui, codingSystem, id) {
                    return codes.filter(function(code) {
                        return code.cui == cui && code.codingSystem == codingSystem && code.id == id;
                    }).length > 0;
                };
                var added = [];
                var removed = [];
                concepts.forEach(function(concept) {
                    $scope.state.codingSystems.forEach(function(codingSystem) {
                        concept.codes[codingSystem].forEach(function(code) {
                            var selected = isSelected(code.cui, code.codingSystem, code.id);
                            if (!code.selected && selected) {
                                added.push({
                                    code: code,
                                    concept: concept
                                });
                            }
                            if (code.selected && !selected) {
                                removed.push({
                                    code: code,
                                    concept: concept
                                });
                            }
                            code.selected = selected;
                        });
                    });
                });
                if (added.length == 0 && removed.length == 0) {
                    //                    $scope.setMessage("No codes changed");
                } else {
                    var descr, result;
                    var resultCodes = function(codes, preposition) {
                        return codes.map(function(cc) {
                            return cc.code.id + " (" + cc.code.codingSystem + ") " + preposition + " " + cc.concept.preferredName;
                        }).join(", ");
                    };
                    if (removed.length == 0) {
                        descr = "Added " + added.length + " codes";
                        result = "added: " + resultCodes(added, "to");
                    } else if (added.length == 0) {
                        descr = "Removed " + removed.length + " codes";
                        result = "removed: " + resultCodes(removed, "from");
                    } else {
                        descr = "Added " + added.length + " and removed " + removed.length + " codes";
                        result = "added: " + resultCodes(added, "to") + ", removed: " + resultCodes(removed, "from");
                    }
                    $scope.conceptsMissingCodes = getConceptsMissingCodes($scope.state);
                    $scope.historyStep("Edit codes", concepts.map(reduceConcept), result, descr);
                }
            });
    };

    $scope.downloadConceptsAsExcel = function() {
        var url = urls.downloadExcel +
            '?project=' + encodeURIComponent($scope.project) +
            '&caseDefinition=' + encodeURIComponent($scope.caseDefinitionName) +
            '&url=' + encodeURIComponent(window.location.href);
        window.open(url, '_blank');
    };
};

function selectCodingSystemsDialog($modal, codingSystems, currentCodingSystems, targetDatabases, showVocabularies) {
    var dialog = $modal.open({
        templateUrl: 'partials/coding-systems.html',
        controller: 'SelectCodingSystemsCtrl',
        size: 'lg',
        resolve: {
            codingSystems: function() { return codingSystems; },
            currentCodingSystems: function() { return currentCodingSystems; },
            targetDatabases: function() { return targetDatabases; },
            showVocabularies: function() { return showVocabularies; }
        }
    });
    return dialog.result;
};

function SelectCodingSystemsCtrl($scope, $modalInstance, $timeout, codingSystems, currentCodingSystems, targetDatabases, showVocabularies) {

    $scope.codingSystems = codingSystems;
    $scope.currentCodingSystems = currentCodingSystems;
    $scope.codingSystemsByName = byKey(codingSystems, getAbbreviation);
    $scope.targetDatabases = objectMap(targetDatabases, function(dbs) { return dbs.join(", "); });
    $scope.showVocabularies = showVocabularies;

    $scope.gridOptions = {
        data: "codingSystems",
        rowHeight: 35,
        showSelectionCheckbox: true,
        filterOptions: { filterText: '' },
        columnDefs: [
            { displayName: 'Name', field: 'name' },
            { displayName: 'Abbreviation', field: 'abbreviation' },
        ]
    };

    $timeout(function() {
        angular.forEach($scope.codingSystems, function(codingSystem, index) {
            if (currentCodingSystems.indexOf(codingSystem.abbreviation) != -1) {
                $scope.gridOptions.selectItem(index, true);
            }
        });
        console.log($scope.gridOptions);
    }, 0);

    $scope.unselect = function(abbreviation) {
        $scope.codingSystems.forEach(function(voc1, index) {
            if (abbreviation == voc1.abbreviation) {
                $scope.gridOptions.selectItem(index, false);
            }
        });
    };

    $scope.ok = function (newCodingSystems, newTargetDatabases, newShowVocabularies) {
        var targetDatabases = {};
        console.log(newTargetDatabases);
        angular.forEach(newTargetDatabases, function(dbs, voc) {
            targetDatabases[voc] = dbs
                .split(",")
                .map(function(s) {
                    return s.trim();
                })
                .filter(function(s) {
                    return s;
                });
        });
        $modalInstance.close({
            codingSystems: newCodingSystems.map(getAbbreviation),
            targetDatabases: targetDatabases,
            showVocabularies: newShowVocabularies
        });
    };
    $scope.cancel = function () {
        $modalInstance.dismiss();
    };
}

/** The controller for the dialog to select hyper-/hyponyms. */
function ShowConceptsCtrl($scope, $modalInstance, $timeout, concepts, codingSystems, title, selectable, message, targetDatabases) {

    $scope.message = message;
    $scope.concepts = concepts;
    $scope.title = title;
    $scope.selectable = selectable;

    var showVocabularies = {};
    angular.forEach(codingSystems, function(voc) {
        showVocabularies[voc] = true;
    });

    $scope.conceptsGridOptions = {
        data: "concepts",
        rowHeight: 70,
        headerRowHeight: 30,
        filterOptions: { filterText: '' },
        enableRowSelection: $scope.selectable,
        showSelectionCheckbox: $scope.selectable,
        columnDefs: createConceptsColumnDefs(false, codingSystems, false, false, targetDatabases, showVocabularies)
    };

    $scope.ok = function () {
        $modalInstance.close(selectable ? $scope.conceptsGridOptions.$gridScope.selectedItems : concepts);
    };

    $scope.cancel = function () {
        console.log("yyy");
        $modalInstance.dismiss('cancel');
    };
};

function selectConceptsInDialog($modal, concepts, title, selectable, message, codingSystems, targetDatabases) {
    // Display retrieved concepts in a dialog
    var dialog = $modal.open({
        templateUrl: 'partials/ShowConcepts.html',
        controller: 'ShowConceptsCtrl',
        size: 'lg',
        resolve: {
            title: function() { return title; },
            concepts: function() { return concepts.sort(compareByCodeCount); },
            codingSystems: function() { return codingSystems; },
            selectable: function() { return selectable; },
            message: function() { return message; },
            targetDatabases: function() { return targetDatabases; }
        }
    });
    return dialog.result;
};

function EditTagsCtrl($scope, $modalInstance, concepts, tags, allTags) {

    $scope.concepts = concepts;

    $scope.tags = tags;

    $scope.offTags = allTags.filter(function(tag) {
        return $scope.tags.indexOf(tag) == -1;
    });
    $scope.offTags.sort();

    console.log("Tags", $scope.tags, $scope.offTags);

    $scope.ok = function() {
        $modalInstance.close($scope.tags);
    };
    $scope.cancel = function() {
        $modalInstance.dismiss('cancel');
    };
    $scope.add = function(tag) {
        $scope.newTag = "";
        $scope.tags.push(tag);
        $scope.tags.sort();
        $scope.offTags = $scope.offTags.filter(function(tag0) {
            return tag0 != tag;
        });
    };
    $scope.remove = function(tag) {
        $scope.tags = $scope.tags.filter(function(tag0) {
            return tag0 != tag;
        });
        $scope.offTags.splice(0, 0, tag);
        $scope.offTags.sort();
    };
    var re = /^[A-Za-z0-9_-]*$/;
    $scope.validNewTag = function(newTag) {
        return newTag
            && $scope.tags.indexOf(newTag) == -1
            && re.test(newTag);
    };
}

function editTags($modal, concepts, allConcepts) {
    var tags = everyTags(concepts);
    var allTags = anyTags(allConcepts);
    console.log("Modal edit tags", concepts, tags, allTags);
    return $modal.open({
        templateUrl: 'partials/EditTags.html',
        controller: 'EditTagsCtrl',
        size: 'sm',
        resolve: {
            concepts: function() {
                return concepts;
            },
            tags: function() {
                return tags;
            },
            allTags: function() {
                return allTags;
            }
        }
    }).result;
}

function EditCodesCtrl($scope, $modalInstance, $timeout, concepts, codes) {
    $scope.concepts = concepts;
    $scope.codes = codes.map(function(code) {
        code.conceptName = code.concept.preferredName;
        return code;
    });
    $scope.gridOptions = {
        data: "codes",
        filterOption: { filterText: '' },
        enableRowSelection: true,
        showSelectionCheckbox: true,
        columnDefs: [
            { displayName: 'Coding system', field: 'codingSystem' },
            { displayName: 'Code', field: 'id',
              cellTemplate:
              "<span ng-bind='row.getProperty(col.field)' title='{{row.entity.preferredTerm}}' " +
              "class='code' ng-class=\"row.selected ? 'selected' : 'unselected'\"></span>"
            },
            { displayName: 'Preferred term (in coding system)', field: 'preferredTerm' },
            { displayName: 'Concept', field: 'conceptName' }
        ]
    };
    $timeout(function() {
        codes.forEach(function(code, index) {
            $scope.gridOptions.selectItem(index, code.selected);
        });
    }, 0);
    $scope.ok = function() {
        $modalInstance.close($scope.gridOptions.$gridScope.selectedItems);
    };
    $scope.cancel = function() {
        $modalInstance.dismiss('cancel');
    };
}

function editCodes($modal, concepts, codingSystems) {
    var dialog = $modal.open({
        templateUrl: 'partials/EditCodes.html',
        controller: 'EditCodesCtrl',
        size: 'lg',
        resolve: {
            concepts: function() {
                return concepts;
            },
            codes: function() {
                var codes = [];
                concepts.forEach(function(concept) {
                    codingSystems.forEach(function(codingSystem) {
                        concept.codes[codingSystem].forEach(function(code0) {
                            var code = angular.copy(code0);
                            code.concept = concept;
                            codes.push(code);
                        });
                    });
                });
                return codes;
            }
        }
    });
    return dialog.result;
}

function ChangePasswordCtrl($scope, $modalInstance, $http, urls) {

    $scope.change = function(oldPassword, newPassword) {
        console.log(oldPassword, newPassword);
        var data = {
            oldPassword: oldPassword,
            newPassword: newPassword
        };
        $http.post(urls.changePassword, data, FORM_ENCODED_POST)
            .error(function(err, code) {
                alert("Unknow error", err, code);
            })
            .success(function(result) {
                console.log("ChangePasswordCtrl.success", result);
                if (result.ok) {
                    $modalInstance.close();
                } else {
                    $scope.message = result.message || "Couldn't change password (password OK?)";
                }
            });
    };

    $scope.cancel = function () {
        $modalInstance.dismiss();
    };
}

function changePassword($modal) {

    var dialog = $modal.open({
        templateUrl: 'partials/ChangePassword.html',
        controller: 'ChangePasswordCtrl',
        size: 'sm'
    });
    return dialog.result;
}

function AskChangesSummaryCtrl($scope, $http, $modalInstance, $timeout, caseDefinitionName, changes) {

    $scope.summary = "";
    $scope.caseDefinitionName = caseDefinitionName;
    $scope.changes = changes;

    $scope.changesGridOptions = {
        data: "changes",
        enableRowSelection: false,
        columnDefs: historyColumnDefs
    };

    $scope.save = function (summary) {
        $modalInstance.close(summary);
    };

    $scope.cancel = function () {
        $modalInstance.dismiss();
    };
}

function askSummary($modal, caseDefinitionName, history, numberUnsafedChanges) {
    var dialog = $modal.open({
        templateUrl: 'partials/AskChangesSummary.html',
        controller: 'AskChangesSummaryCtrl',
        size: 'lg',
        resolve: {
            caseDefinitionName: function() { return caseDefinitionName; },
            changes: function() {
                return history.slice(history.length - numberUnsafedChanges);
            }
        }
    });
    return dialog.result;
}

function ShowCommentsCtrl($scope, $http, $modalInstance, concept, canEnterNewComment) {
    $scope.concept = concept;
    $scope.canEnterNewComment = canEnterNewComment;
    $scope.newComment = { text: "" };
    $scope.save = function(newComment) {
        $modalInstance.close(newComment.text);
    };
    $scope.cancel = function() {
        $modalInstance.dismiss();
    };
}

function showComments($modal, concept, canEnterNewComment) {
    var dialog = $modal.open({
        templateUrl: 'partials/ShowComments.html',
        controller: 'ShowCommentsCtrl',
        size: 'lg',
        resolve: {
            concept: function() { return concept; },
            canEnterNewComment: function() { return canEnterNewComment; }
        }
    });
    return dialog.result;
}

var originColumnDef = {
    displayName: 'Origin',
    cellClass: 'scroll-y',
    field: 'origin',
    cellTemplate: "partials/originColumn.html",
    sortFn: function(ss1, ss2) {
        ss1 = ss1.map(function(s) { return s.text; });
        ss2 = ss2.map(function(s) { return s.text; });
        if (ss1.length != ss2.length) {
            return ss2.length - ss1.length;
        } else {
            var s1 = ss1.join();
            var s2 = ss2.join();
            return s1 < s2 ? -1 : (s2 < s1 ? 1 : 0);
        }
    }
};

var tagsColumnDef = {
    displayName: 'Tags',
    field: 'tags',
    cellTemplate: 'partials/tagsColumn.html'
};

/** Generate column definitions */
function createConceptsColumnDefs(showOrigin, codingSystems, showComments, showTags, targetDatabases, showVocabularies) {

    var name = { displayName: "Concept", field: 'preferredName', cellClass: 'cellToolTip', cellTemplate: "partials/nameCell.html"};

    var cuiCellTemplate = "<span class='cui' ng-bind='row.entity.cui' title='{{row.entity.preferredName}}'></span>";
    var cui = { displayName: "UMLS", field: 'cui', cellTemplate: cuiCellTemplate };

    codingSystems = angular.copy(codingSystems);
    codingSystems.sort(function(cs1, cs2) {
        var s1 = cs1, s2 = cs2;
        if (targetDatabases.hasOwnProperty(cs1) && targetDatabases[cs1].length > 0) {
            s1 = targetDatabases[cs1][0];
        }
        if (targetDatabases.hasOwnProperty(cs2) && targetDatabases[cs2].length > 0) {
            s2 = targetDatabases[cs2][0];
        }
        return s1.localeCompare(s2);
    });
    var codingSystemsColumnDefs = codingSystems
        .filter(function(codingSystem) {
            return showVocabularies[codingSystem];
        })
        .map(function(codingSystem) {
            var targetDatabase = "";
            if (targetDatabases.hasOwnProperty(codingSystem)) {
                targetDatabase = " (" + targetDatabases[codingSystem].join(", ") + ")";
            }
            return {
                displayName: codingSystem + targetDatabase,
                field: "codes." + codingSystem,
                cellClass: 'scroll-y',
                cellTemplate: "partials/code-cell.html",
                sortFn: function(cs1, cs2) {
                    if (cs1.length != cs2.length) {
                        return cs2.length - cs1.length;
                    } else {
                        var s1 = cs1.join();
                        var s2 = cs2.join();
                        return s1 < s2 ? -1 : (s2 < s1 ? 1 : 0);
                    }
                }
            };
        });

    var comments = {
        width: 75,
        displayName: "",
        field: "comments",
        cellTemplate: "partials/commentsCell.html"
    };

    return [].concat(
        [name],
        showOrigin ? [originColumnDef] : [],
        showTags ? [tagsColumnDef] : [],
        SHOW_UMLS_COLUMN ? [cui] : [],
        codingSystemsColumnDefs,
        showComments ? [comments] : []);
}

var historyColumnDefs = [
    { field: "date", displayName: "Date" },
    { field: "user", displayName: "User" },
    { field: "operation", displayName: "Operation" },
    { field: "argument", displayName: "Argument",
      cellTemplate: "<span>{{row.entity[col.field] | historyDatumToString}}</span>" },
    { field: "result", displayName: "Result",
      cellTemplate: "<span>{{row.entity[col.field] | historyDatumToString}}</span>" }
];
