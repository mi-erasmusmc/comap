
"use strict";

/**
 * The initial state that is used when no state is found for the case
 * definition.
 */
var INITIAL = {
	caseDefinition: "",
	history: [],
	concepts: [],
	codingSystems: [ "ICD10CM", "ICD9CM", "ICPC2P", "RCD", "MSH" ],
	semanticTypes:
	    // Group "DISO" ("Findings": T033)
		[ "T020", "T190", "T049", "T019", "T047", "T050", "T037", "T048", "T191", "T046", "T184", "T033" ]
	 + [ "T005", "T004", "T204", "T007" ] // Some from group "LIVB",
};

/**
 * Concepts found by Peregrine are filtered by a stopword list and by the
 * following regex matching three-digit numbers and two-letter words.
 */
var STOPWORDS_REGEX = /^(\d{1,3}|\S{1,2})$/;

function pluralize(noun, arrayOrNumber) {
    var count = angular.isArray(arrayOrNumber) ? arrayOrNumber.length : arrayOrNumber; 
    if (count == 1) {
        return noun;
    } else {
        return noun + "s";
    }
}

function historyDatumToString(data) {
    if (data == null) {
        return null;
    } else if (angular.isString(data)) {
        return data;
    } else if (angular.isArray(data)) {
        return data.map(function(concept) { return concept.preferredName.replace(/,/g, " "); }).join(", ");
    } else if (angular.isObject(data)) {
        return data.preferredName;
    }
}

function CodingSystemsCtrl($scope, $timeout, dataService) {
	
	dataService.codingSystemsPromise.then(function() {
		$scope.all = dataService.codingSystems;
	});
	
	$scope.gridOptions = {
			data: "all",
			rowHeight: 35,
			filterOptions: { filterText: '' },
			columnDefs: [
              { displayName: 'Name', field: 'name' },
              { displayName: 'Abbreviation', field: 'abbreviation' },
            ]
	};
	
	$timeout(function() {
		$scope.selected.codingSystems =
			$scope.gridOptions.$gridScope.selectedItems;
	}, 0);

	$scope.unselect = function(abbreviation) {
		$scope.all.forEach(function(voc1, index) {
			if (abbreviation == voc1.abbreviation) {
				$scope.gridOptions.selectItem(index, false);
			}
		});
	};
	
	$scope.$on("setSelectedCodingSystems", function(event, abbreviations) {
		$scope.all.forEach(function(voc, ix) {
			var selected = abbreviations.indexOf(voc.abbreviation) != -1;
			$scope.gridOptions.selectItem(ix, selected);
		});
	});
};

/** *************** */
/* SEMANTIC TYPES */
/** *************** */

function SemanticTypesCtrl($scope, $timeout, dataService) {

	dataService.semanticTypesPromise.then(function() {
		$scope.all = dataService.semanticTypes;
	});

	$scope.gridOptions = {
	     data: "all",
	     rowHeight: 35,
	     filterOptions: { filterText: '' },
	     columnDefs: [
    		 { displayName: 'Type', field: 'type' },
    		 { displayName: 'Description', field: 'description' },
    		 { displayName: 'Group', field: 'group'},
		 ],
	 };
	
	$timeout(function() {
		$scope.selected.semanticTypes =
			$scope.gridOptions.$gridScope.selectedItems;
	}, 0);
	
	$scope.unselect = function(semanticType) {
		$scope.all.forEach(function(semanticType1, index) {
			if (semanticType.type == semanticType1.type) {
				$scope.gridOptions.selectItem(index, false);
			}
		});
	};
	
	$scope.$on("setSelectedSemanticTypes", function(event, semanticTypes) {
		$scope.all.forEach(function(semanticType, index) {
			var selected = semanticTypes.indexOf(semanticType.type) != -1;
            $scope.gridOptions.selectItem(index, selected);
        });
	});
};

function CodeMapperCtrl($scope, $rootScope, $http, $sce, $modal, $timeout, $q, $log, $routeParams, $location, blockUI, urls, dataService, user) {
	
	$scope.user = user;
	$scope.project = $routeParams.project;
	$scope.caseDefinitionName = $routeParams.caseDefinitionName;

	$scope.caseDefinition = "";
	$rootScope.subtitle = $scope.caseDefinitionName + " (" + $scope.project + ")";
	
	// Reflects the abbreviations and current selection of coding systems and
	// semantic types
    $scope.selected = {
		codingSystems: null,
		semanticTypes: null
    };
    $scope.state = null; // State of the current translations
	$scope.numberUnsafedChanges = 0; // Changes since last save

    var inputBlockUi = blockUI.instances.get('inputBlockUi');
    
    blockUI.start("Loading configuration ...");
    dataService.completed
        .then(function() {
            blockUI.stop();
            $scope.loadTranslations();
        });
    
    $scope.activateTab = function(id) {
    	$timeout(function() {
    		$("#" + id + " > a").click();
    	}, 0);
    };
    
    /* KEYBOARD */
    
    var ctrlKeydownCallbacks = {
    	48 /* 0 */: function() {
    		console.log("Case definition name", $scope.caseDefinitionName);
    		console.log("Case definition", $scope.caseDefinition);
    		console.log("Selected coding systems", $scope.selected.codingSystems);
    		console.log("Selected semantic types", $scope.selected.semanticTypes);
    		console.log("Grid options", $scope.conceptsGridOptions);
    		console.log("Columns", $scope.conceptsColumnDefs);
    		console.log("Selected concepts", $scope.selectedConcepts);
    		console.log("State", $scope.state);
    		console.log("numberUnsafedChanges", $scope.numberUnsafedChanges);
    	},
    	49 /* 1 */: function() {
    		$scope.activateTab("case-definition-tab");
    	},
    	50 /* 2 */: function() {
    		$scope.activateTab("semantics-tab");
    	},
    	51 /* 3 */: function() {
    		$scope.activateTab("coding-systems-tab");
    	},
    	52 /* 4 */: function() {
    		$scope.activateTab("concepts-tab");
    	},
    	53 /* 5 */: function() {
    		$scope.activateTab("history-tab");
    	}  	
    };
    
    $rootScope.onKeydown = function(event) {
    	if (event.ctrlKey) {
    		var callback = ctrlKeydownCallbacks[event.keyCode];
    		if (callback) {
    			callback();
    		} else {
    			console.log("No callback for keyCode", event.keyCode);
    		}
    	}
    };
    
    /* MESSAGE */
    
    $scope.message = null;
    $scope.setMessage = function(message) {
        $scope.message = message;
    };
    $scope.unsetMessage = function() {
        $scope.message = null;
    }
    
    /* CONCEPTS */
	
	$scope.conceptsColumnDefs = createConceptsColumnDefs(true, true, []);
	$scope.conceptsGridOptions = {
		data: "state.concepts",
        rowHeight: 70,
        headerRowHeight: 35,
		columnDefs: 'conceptsColumnDefs',
		enableRowSelection: true,
		enableCellSelection: true,
	    filterOptions: { filterText: '' }
	};
	$scope.$watch('state', function(newState) {
		if (newState == null) {
			$scope.selectedConcepts = [];
		} else {
			$timeout(function() {
				$scope.selectedConcepts = $scope.conceptsGridOptions.$gridScope.selectedItems;
			});
		}
	});
	/** Set the selected concepts */
	$scope.setSelectedConcepts = function(cuis) {
	    $timeout(function() {
            $scope.state.concepts.forEach(function(concept, index) {
                var selected = cuis.indexOf(concept.cui) != -1;
                $scope.conceptsGridOptions.selectItem(index, selected);
            });
	    }, 0);
	}
    
    /* HISTORY */
    
    /** Create a history step for $scope.state.history */
    $scope.historyStep = function(name, argument, result, descr) {
        $scope.setMessage(descr);
        $scope.numberUnsafedChanges += 1;
        $scope.state.history.push({
            date: new Date().toJSON(),
            name: name,
            argument: argument,
            result: result,
            user: user.username
        });
    };
	
	$scope.historyGridOptions = {
		data: "state.history",
		rowHeight: 70,
		headerRowHeight: 35,
		columnDefs: historyColumnDefs,
		enableRowSelection: false,
	};

	/* FUNCTIONS */
	
	/** Load coding or create new coding. */
	$scope.loadTranslations = function() {
	    blockUI.start("Loading codings ...");
		$http.get(urls.caseDefinition($scope.project, $scope.caseDefinitionName))
			.error(function(err, code, a2) {
				switch (code) {
					case 401:
						alert("You are not member for project " + $scope.project + ":(");
						$location.path('/dashboard');
						break;
					case 404:
						$scope.state = null;
						$scope.$broadcast("setSelectedSemanticTypes", INITIAL.semanticTypes);
				        $scope.$broadcast("setSelectedCodingSystems", INITIAL.codingSystems);
						$scope.caseDefinition = "" + INITIAL.caseDefinition;
						$scope.setMessage("Coding for " + $scope.caseDefinitionName + " initialized.");
						break;
				} 
			})
			.success(function(state) {
				console.log("Loaded", state);
				$scope.state = state;
				$scope.caseDefinition = "" + state.caseDefinition;
				$scope.$broadcast("setSelectedSemanticTypes", state.semanticTypes);
				$scope.$broadcast("setSelectedCodingSystems", state.codingSystems);
				$scope.activateTab("concepts-tab");
				$scope.setMessage("Coding for " + $scope.caseDefinitionName + " loaded.");
				inputBlockUi.start("Reset the current coding to edit");
			})
			.finally(function() {
			    blockUI.stop();
				$scope.numberUnsafedChanges = 0;
				$scope.conceptsColumnDefs = createConceptsColumnDefs(true, true, $scope.state.codingSystems);
			});
	};
	
	/** Ask a summary of recent changes and save/upload the coding. */ 
	$scope.saveTranslations = function() {
		if ($scope.state == null) {
			error("CodeMapperCtrl.expandRelated called without state");
			return;
		}
        var modalInstance = $modal.open({
            templateUrl: 'partials/AskChangesSummary.html',
            controller: 'AskChangesSummaryCtrl',
            size: 'lg',
            resolve: {
            	caseDefinitionName: function() { return $scope.caseDefinitionName; },
            	changes: function() {
            		var history = $scope.state.history;
            		return history.slice(history.length - $scope.numberUnsafedChanges);
        		},
            }
          });       
        modalInstance.result.then(function(summary) {
        	console.log("SUMMARY", summary);
            $scope.historyStep("Summarize", summary, null, "Saved with summary: " + summary);
			var data = {
				state: angular.toJson($scope.state)
			};
			blockUI.start("Saving ...");
			$http.post(urls.caseDefinition($scope.project, $scope.caseDefinitionName), data, FORM_ENCODED_POST)
				.error(function(e) {
					console.log(e);
				})
				.success(function() {
					$scope.numberUnsafedChanges = 0;
				})
				.finally(function() {
				   blockUI.stop(); 
				});
        });
	};
	
	/** Search UMLS concepts in `text` and give results to function `onConcepts`. */
	var searchConcepts = function(text, onConcepts) {
		
		if ($scope.state == null) {
			error("CodeMapperCtrl.searchConcepts called without state");
			return;
		}

		// Index case definition with peregrine
		var data = {
			text: text
		};
		blockUI.start("Indexing ...");
		$http.post(dataService.peregrineResource + "/index", data, FORM_ENCODED_POST)
			.error(function(err) {
				var msg = "ERROR: Couldn't search concepts in case definition at " + dataService.peregrineResource;
				console.log(msg, err);
				alert(msg);
			})
			.success(function(result) { 
				var spans = result.spans.filter(function(span) {
					var isStopword = dataService.stopwords.indexOf(span.text.toUpperCase()) != -1;
					var isFiltered = STOPWORDS_REGEX.test(span.text);
					if (isStopword || isFiltered) {
						console.log("Filter span", span.text, isStopword ? "as stopword" : "", isFiltered ? "as regex" : "");
					}
					return !(isStopword || isFiltered);
				});
				var cuis = [];
				spans.forEach(function(span) {
					var cui = cuiOfId(span.id);
					if (cuis.indexOf(cui) == -1) {
						cuis.push(cui);
					}
				});
				var data = {
					cuis : cuis,
					codingSystems : $scope.state.codingSystems
				};
				blockUI.start("Loading concept ...");
				$http.post(urls.umlsConcepts, data, FORM_ENCODED_POST)
					.error(function(err) {
						var msg = "ERROR: Couldn't lookup concepts";
						alert(msg, err);
					})
					.success(function(concepts0) {
					    var filteredBySemanticType = [],
					        filteredByCurrentConcepts = [];
						var concepts = $scope.filterAndPatch(concepts0, null, filteredBySemanticType, filteredByCurrentConcepts);
			            concepts.forEach(function(concept) {
			                concept.origin = {
			                    type: "spans",
			                    data: spans.filter(function(span) {
			                        return cuiOfId(span.id) == concept.cui;
			                    })
			                };
						});
						onConcepts(concepts, filteredBySemanticType, filteredByCurrentConcepts);
					})
		            .finally(function() {
		                blockUI.stop();
		            });
			})
			.finally(function() {
			    blockUI.stop();
			});
	};
	
	/**
     * Index the case definition for concepts, retrieve information about those
     * concepts and display.
     */ 
	$scope.createInitalTranslations = function(caseDefinition) {
		$log.info("Create initial coding");
		if ($scope.state != null) {
			error("CodeMapperCtrl.searchConcepts called with state");
			return;
		}
		$scope.state = {
			concepts: [],
			caseDefinition: $scope.caseDefinition,
			codingSystems: $scope.selected.codingSystems.map(getAbbreviation),
			semanticTypes: $scope.selected.semanticTypes.map(getType),
			history: []
		};
		$scope.conceptsColumnDefs = createConceptsColumnDefs(true, true, $scope.state.codingSystems);
		searchConcepts(caseDefinition, function(concepts, filteredBySemanticType, filteredByCurrentConcepts) {
			$scope.state.initialCuis = concepts.map(getCui);
			$scope.state.concepts = concepts.sort(compareByCodeCount);
			$scope.conceptsGridOptions.sortInfo = { fields: ["sourceConceptsCount", "preferredName"], directions: [ "desc", "desc" ] };
			var descr = "Found " + concepts.length + " concepts in case definition";
			if (filteredBySemanticType.length > 0) {
			    descr += ", filtered " + filteredBySemanticType.length + " by semantic type";
			}
			if (filteredByCurrentConcepts.length > 0) {
			    descr += ", filtered " + filteredByCurrentConcepts.length + " by current coding";
			}
			$scope.historyStep("Automatic coding", null, concepts.map(reduceConcept), descr);
			inputBlockUi.start("Reset concepts to edit!");
		});
	};
	
	/**
     * Index a given query string for concepts, retrieve information and select
     * concepts in a dialog for inclusion.
     */
	$scope.searchAndAddConcepts = function(searchQuery) {
		$log.info("Search and add concepts", searchQuery, $scope);
		if ($scope.state == null) {
			error("CodeMapperCtrl.searchAndAddConcepts called without state");
			return;
		}
        searchConcepts(searchQuery, function(concepts, filteredBySemanticType, filteredByCurrentConcepts) {
            console.log(searchQuery, concepts, filteredBySemanticType, filteredByCurrentConcepts);
		    if (concepts.length == 0) {
		          $scope.setMessage("No concepts found for query \"" + searchQuery + "\".");
		    } else {
    			var title = "Concepts for search \"" + searchQuery + "\"";
    			var message = "Found " + concepts.length + " concepts";
    			if (filteredBySemanticType.length > 0) {
    			    message  += ", filtered " + filteredBySemanticType.length + " by semantic types";
    			}
    			if (filteredByCurrentConcepts.length > 0) {
    			    message += ", filtered " + filteredByCurrentConcepts.length + " by current coding"; 
    			} 
    			$scope.selectConceptsInDialog(concepts, title, true, message,
			        function(selectedConcepts) {
        		        if (angular.isArray(selectedConcepts)) {
            				selectedConcepts.forEach(function(concept) {
            					concept.origin = {
            						type: "search",
            						data: searchQuery
            					};
            				});
            				$scope.state.concepts = selectedConcepts.concat($scope.state.concepts);
            				$scope.setSelectedConcepts(selectedConcepts.map(getCui));
            				var descr = "Added " + selectedConcepts.length + " concepts by search on \"" + searchQuery + "\"";
            				$scope.historyStep("Search", search, selectedConcepts.map(reduceConcept), descr);
            				$scope.searchQuery = "";
        		        }
        			});
		    }
		});
	};
	
	$scope.searchAndAddConceptDirect = function(concept0) {
	    console.log("Search&add direct", concept0);
	    var data = {
            cuis : [concept0.cui],
            codingSystems : $scope.state.codingSystems
        };
	    blockUI.start("Search concept ...");
        $http.post(urls.umlsConcepts, data, FORM_ENCODED_POST)
            .error(function(err) {
                var msg = "ERROR: Couldn't lookup concepts";
                alert(msg, err);
            })
            .success(function(concepts0) {
                var filteredBySemanticType = [],
                    filteredByCurrentConcepts = [];
                var concepts = $scope.filterAndPatch(concepts0, null, filteredBySemanticType, filteredByCurrentConcepts);
                if (concepts.length == 0) {
                    var message = "Concept not found";
                    if (filteredBySemanticTypes.length > 0) {
                        message  += "(filtered  by semantic types)";
                    }
                    if (filteredByCurrentConcepts.length > 0) {
                        message += "(filtered by current coding)"; 
                    } 
                    $scope.setMessage(message);
                } else {
                    var concept = concepts[0];
                    concept.origin = {
                        type: "add",
                        data: concept.preferredName
                    };
                    $scope.state.concepts = [concept].concat($scope.state.concepts);
                    $scope.setSelectedConcepts([concept.cui]);
                    var descr = "Added concept " + concept.preferredName;
                    $scope.historyStep("Add", null, reduceConcept(concept), descr);
                    $scope.searchQuery = "";
                }
            })
            .finally(function() {
                blockUI.stop();
            });
	};
	
	/** Generate a list of UMLS concept names with a given prefix. */
	$scope.autocompleteConcepts= function(str) {
	    var params = {
            str: str,
            codingSystems: $scope.state.codingSystems,
            semanticTypes: $scope.state.semanticTypes
        };
	    return $http.get(urls.autocomplete, { params: params })
	        .then(function(completions) {
	            if (completions.status == 200) {
	                var currentCuis = $scope.state.concepts.map(getCui);
	                return completions.data
	                    .filter(function(c) {
	                        return currentCuis.indexOf(c.cui) == -1;
	                    })
	                    .sort(function(s1, s2) {
    	                    return s1.preferredName.length - s2.preferredName.length
    	                        || s1.preferredName.localeCompare(s2.preferredName);
    	                });
	            }
	        });
	}
	
	/** Reset the coding of the case definition by deleting the state. Re-enable
	 * input for case definition, semantic types and coding systems. */
	$scope.resetConcepts = function() {
		console.log("RESET");
		$scope.$apply(function($scope) {
			$scope.numberUnsafedChanges = 0;
			$scope.state = null;
			$scope.conceptsColumnDefs = createConceptsColumnDefs(true, true, []);
			$scope.setMessage("Current codings have been reset.");
			inputBlockUi.reset();
		});
	};
	
	/** Delete a concepts from $scope.state.concepts by its cui. */
	$scope.operationDeleteConcepts = function(concepts) {
		if ($scope.state == null) {
			error("CodeMapperCtrl.deleteConcept called without state");
			return;
		}
		$scope.$apply(function() {
		    var cuis = concepts.map(getCui);
		    var deletedCuis = [];
		    var deletedNames = [];
    		$scope.state.concepts = $scope.state.concepts
    			.filter(function(concept) {
    				if (cuis.indexOf(concept.cui) != -1) {
    					deletedNames.push(concept.preferredName);
    					deletedCuis.push(concept.cui);
    					return false;
    				} else {
    					return true;
    				}
    			});
    		$scope.setSelectedConcepts([]);
    		var descr = "Deleted " + deletedCuis.length + " " + pluralize("concept", deletedCuis.length); 
    		$scope.historyStep("Delete", concepts.map(reduceConcept), null, descr);
		});
	};
	
	/**
     * Expand a given concept to its hypernyms or hyponyms, show selection
     * dialog and integrate in the list of concepts ($scope.state.concepts).
     */
    $scope.operationExpandRelatedConcepts = function(concepts, hyponymsNotHypernyms) {
		if ($scope.state == null) {
			error("CodeMapperCtrl.expandRelated called without state");
			return;
		}
		var conceptNames = concepts.map(function(c) { return c.preferredName; }).join(", ");
		var hyponymOrHypernym = hyponymsNotHypernyms ? "hyponym" : "hypernym";
    	var cuis = concepts.map(getCui);
    	var data = {
			cuis: cuis,
			hyponymsNotHypernyms: hyponymsNotHypernyms,
			codingSystems: $scope.state.codingSystems
		};
    	// Retrieve related concepts from the API
    	blockUI.start("Load related concept ...");
    	$http.post(urls.relatedConcepts, data, FORM_ENCODED_POST)
    		.error(function(err) {
    			var msg = "ERROR: Couldn't lookup related concepts at " + urls.relatedConcepts;
    			alert(msg);
    			console.log(msg, err);
    		})
    		.success(function(relatedConceptsByCuis) {
    			
    			var relatedConcepts = [];
    			var filteredBySemanticTypes = [];
    			var filteredByCurrentConcepts = [];
    			angular.forEach(relatedConceptsByCuis, function(relatedConceptsForCui, forCui) {
    				
    				var relatedConceptsCuis = relatedConcepts.map(getCui);
    				relatedConceptsForCui = relatedConceptsForCui
    					.filter(function(c, ix, a) {
							return a.map(getCui).indexOf(c.cui) == ix && // Exclude
                                                                            // duplicates
                                                                            // in
                                                                            // relatedConceptsForCui0
								relatedConceptsCuis.indexOf(c.cui) == -1; // Include
                                                                            // only
                                                                            // novel
                                                                            // concepts
                                                                            // (not
                                                                            // yet
                                                                            // in
                                                                            // relatedConcepts)
						});	
    				
    				relatedConceptsForCui = $scope.filterAndPatch(relatedConceptsForCui, filteredBySemanticTypes, filteredByCurrentConcepts);

    				relatedConceptsForCui.forEach(function(c) {
    					c.origin = {
							type: hyponymOrHypernym,
							data: {
								cui: forCui,
								preferredName: concepts.filter(function(c1) { return forCui == c1.cui; })[0].preferredName
							}
    					};
    				});
    				relatedConcepts = relatedConcepts.concat(relatedConceptsForCui);
    			});
    				
                var message = "Found " + relatedConcepts.length + " " + pluralize(hyponymOrHypernym, relatedConcepts);
                if (filteredBySemanticTypes.length > 0) {
                    message  += ", filtered " + filteredBySemanticTypes.length + " by semantic types";
                }
                if (filteredByCurrentConcepts.length > 0) {
                    message += ", filtered " + filteredByCurrentConcepts.length + " by current coding"; 
                } 
					
    			var title = "H" + hyponymOrHypernym.slice(1) + "s of " + conceptNames;
    			
    			$scope.selectConceptsInDialog(relatedConcepts, title, true, message, function(selectedRelatedConcepts) {
    				
    				// Search position of original inital concepts
    				var conceptOffsets = {};
    				cuis.forEach(function(cui) {
	    				$scope.state.concepts.forEach(function(c, cIx) {
	    					if (c.cui == cui) {
	    						conceptOffsets[cui] = cIx;
	    					}
	    				});
    				});

    				// Insert each related concept in list of concepts
    				selectedRelatedConcepts.forEach(function(related, ix) {
    				    var offset = ++conceptOffsets[related.origin.data.cui];
    					$scope.state.concepts.splice(offset, 0, related);
    				});
    				$scope.setSelectedConcepts(selectedRelatedConcepts.map(getCui));
    				
    				var descr = "Expanded " +
    				    (concepts.length <= 3 
    				            ? pluralize("concept", concepts) + " " + conceptNames
			                    : concepts.length + " " + pluralize("concept", concepts)) +
    				    " with " + selectedRelatedConcepts.length + 
    				    " " + pluralize(hyponymOrHypernym, selectedRelatedConcepts); 
    				$scope.historyStep("H" + hyponymOrHypernym.slice(1) + "s",
    				        concepts.map(reduceConcept), selectedRelatedConcepts.map(reduceConcept), descr);
    			});
    		})
            .finally(function() {
                blockUI.stop();
            });
    };
    
    $scope.operationEditCodes = function(concepts) {
        $modal.open({
            templateUrl: 'partials/EditCodes.html',
            controller: 'EditCodesCtrl',
            size: 'lg',
            resolve: {
                codes: function() { 
                    var codes = [];
                    concepts.forEach(function(concept) {
                        $scope.state.codingSystems.forEach(function(codingSystem) {
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
        }).result.then(function(codes) {
            function isSelected(cui, vocabulary, id) {
                return codes.filter(function(code) {
                    return code.cui == cui && code.vocabulary == vocabulary && code.id == id;
                }).length != 0
            };
            var added = [];
            var removed = [];
            concepts.forEach(function(concept) {
                $scope.state.codingSystems.forEach(function(codingSystem) {
                    concept.codes[codingSystem].forEach(function(code) {
                        var selected = isSelected(code.cui, code.vocabulary, code.id);
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
                $scope.setMessage("No codes changed");                    
            } else {
                var descr, result;
                console.log(added, removed);
                var resultCodes = function(codes, preposition) {
                    return codes.map(function(cc) {
                        return cc.code.id + " (" + cc.code.vocabulary + ") " + preposition + " " + cc.concept.preferredName;
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
                $scope.historyStep("Edit codes", concepts.map(reduceConcept), result, descr);
            }
        });
    };
    
    $scope.selectConceptsInDialog = function(concepts, title, selectable, message, onSelectedConcepts) {
        
		// Display retrieved concepts in a dialog
        var modalInstance = $modal.open({
          templateUrl: 'partials/ShowConcepts.html',
          controller: 'ShowConceptsCtrl',
          size: 'lg',
          resolve: {
    	    title: function() { return title; },
        	concepts: function() { return concepts.sort(compareByCodeCount); },
        	codingSystems: function() { return $scope.state.codingSystems; },
        	selectable: function() { return selectable; },
        	message: function() { return message; }
          }
        });
        modalInstance.result.then(onSelectedConcepts);
    };

	$scope.downloadConcepts = function() {
		if ($scope.state == null) {
			error("CodeMapperCtrl.downloadConcepts called without state");
			return;
		}
		console.log("Download concepts");
		var selectedCodingSystemsAbbreviations = $scope.selected.codingSystems
			.map(function(voc) {
				return voc.abbreviation;
			});
		
		var data = [];
		
		[ ["CASE DEFINITION"], 
		  [$scope.caseDefinitionName, "(Coding generated with ADVANCE Code Mapper)"]
        ].forEach(function(row) { data.push(row); });
		
		[ [],
		  ["CODES"],
		  ["Coding system", "Code", "Name in coding system", "Concept name", "CUI", "Origin"]
        ].forEach(function(row) { data.push(row); });
		$scope.state.concepts.forEach(function(concept) {
		    var origin = concept.origin.type + ": ";
		    if (concept.origin.type == "spans") {
		        origin += concept.origin.data.map(function(s) { return s.text; }).join(", ");
		    } else if (concept.origin.type == "hyponym" || concept.origin.type == "hypernym") {
		        origin += concept.origin.data.cui;
		    } else if (concept.origin.type == "search") {
		        origin += concept.origin.data;
		    }
		    selectedCodingSystemsAbbreviations.forEach(function(vocabulary) {
				concept.codes[vocabulary].forEach(function(code) {
				    if (code.selected) {
				        data.push([vocabulary, code.id, code.preferredTerm, concept.preferredName, concept.cui, origin]);
				    }
				})
			});
		});
		
		[ [],
          ["HISTORY"],
          ["Date", "Step", "Argument", "Result"]
        ].forEach(function(row) { data.push(row); });
		if ($scope.state.history) {
			$scope.state.history.forEach(function(step) {
				data.push([step.date,
				           step.name,
				           historyDatumToString(step.argument), 
				           historyDatumToString(step.result)]);
			});
		}
		
		[ [],
		  ["CASE DEFINITION TEXT"]
		].forEach(function(row) { data.push(row); });
		$scope.state.caseDefinition.split("\n").forEach(function(line) {
			data.push([line]);
		});
		
		var csv = csvEncode(data);
		console.log(csv);
		var file = new Blob([ csv ], {
			type : 'attachment/csv;charset=UTF-8'
		});
		var a = document.createElement('a');
		a.href = URL.createObjectURL(file);
		a.target = '_blank';
		a.download = $scope.project + '_' + $scope.caseDefinitionName + '.csv';
		document.body.appendChild(a);
		$timeout(function() {
		    a.click();
		}, 0);
	};
    
    /** ************ */
    /* AUXILIARIES */
    /** ************ */

	/** Filters the list of `concepts` and adapts the data for the application. */
	$scope.filterAndPatch = function(concepts, additionalCurrentCuis, filteredBySemanticType, filteredByCurrentConcepts) {
		
		var currentCuis = $scope.state.concepts.map(getCui)
			.concat(additionalCurrentCuis || []);
		
	    // Record concepts that are not yet available but filtered out due to
		// its semantic type:

		return concepts
			// Filter out concepts that are already available
	    	.filter(function(concept) {
	    		var isNovel = currentCuis.indexOf(concept.cui) == -1;
	    		if (!isNovel && filteredByCurrentConcepts != undefined) {
	    			filteredByCurrentConcepts.push(concept);
	    		}
	    		return isNovel;
	    	})
	    	// Filter out concepts by semantic type
	    	.filter(function(concept) {
	    		var matchesSemanticTypes =
	    			concept.semanticTypes
						.filter(function(type) {
							return $scope.state.semanticTypes.indexOf(type) != -1;
						})
						.length > 0;
				if (!matchesSemanticTypes && filteredBySemanticType != undefined) {
					filteredBySemanticType.push(concept);
				}
	    		return matchesSemanticTypes;
	    	})
	    	// Patch: adapt concepts for the code mapper application
	    	.map(function(concept0) {
	    		var concept = angular.copy(concept0);
	    		// Add field `codes` that is a mapping from coding systems to
				// source
				// concepts
	    		concept.codes = {};
	    		$scope.state.codingSystems.forEach(function(codingSystem) {
	    			concept.codes[codingSystem] = concept.sourceConcepts
	    				.filter(function(sourceConcept) {
	    					return sourceConcept.vocabulary == codingSystem;
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
	                            return dataService.semanticTypesByType[type].description;
	                    })
	                    .filter(function(v, ix, arr) {
	                            return ix == arr.indexOf(v);
	                    });
	            var groups = concept.semanticTypes
	                    .map(function(type) {
	                            return dataService.semanticTypesByType[type].group;
	                    })
	                    .filter(function(v, ix, arr) {
	                            return ix == arr.indexOf(v);
	                    });
	    		concept.semantic = {
	    			types: types,
	    			groups: groups
	    		};
	    		return concept;
	    	});
	};

	$scope.trustDefinition = function(definition) {
		return $sce.trustAsHtml(definition);
	};
};

/** The controller for the dialog to select hyper-/hyponyms. */
function ShowConceptsCtrl($scope, $modalInstance, $timeout, concepts, codingSystems, title, selectable, message) {
	
	$scope.message = message;
	$scope.concepts = concepts;
	$scope.title = title;
	$scope.selectable = selectable;

	$scope.conceptsGridOptions = {
		data: "concepts",
		rowHeight: 70,
		headerRowHeight: 30,
	    filterOptions: { filterText: '' },
		enableRowSelection: $scope.selectable,
		columnDefs: createConceptsColumnDefs(false, false, codingSystems)
	};
    
	if (selectable) {
		$timeout(function() {
            $scope.concepts.forEach(function(concept, index) {
                if (concept.sourceConcepts.length > 0) {
                    $scope.conceptsGridOptions.selectItem(index, true);
                }
            });
		}, 0);
	}
	
	$scope.ok = function () {
		$modalInstance.close(selectable ? $scope.conceptsGridOptions.$gridScope.selectedItems : concepts);
	};
	$scope.cancel = function () {
        console.log("yyy");
		$modalInstance.dismiss('cancel');
	};
};

function EditCodesCtrl($scope, $modalInstance, $timeout, codes) {
    $scope.codes = codes.map(function(code) {
        code.conceptName = code.concept.preferredName;
        return code;
    });
    $scope.gridOptions = {
        data: "codes",
        filterOption: { filterText: '' },
        enableRowSelection: true,
        columnDefs: [
            { displayName: 'Coding system', field: 'vocabulary' },
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

var originColumnDef = {
	displayName: 'Origin',
    cellClass: 'scroll-y',
    field: 'origin',
    cellTemplate:
      "<div ng-if='row.entity.origin.type == \"spans\"' class='spans' title='Found in case definition'>" +
        "<span class=span ng-repeat='span in row.entity.origin.data' ng-bind='span.text'></span>" +
      "</div>" +
      "<div ng-if='row.entity.origin.type == \"hyponym\"'>" +
        "<span title='Hyponym of {{row.entity.origin.data.preferredName}}'>" +
          "<i class='glyphicon glyphicon-chevron-down'></i> " +
          "<span ng-bind='row.entity.origin.data.preferredName'></span>" +
        "</span>" +
      "</div>" +
      "<div ng-if='row.entity.origin.type == \"hypernym\"'>" +
	    "<span title='Hypernym of {{row.entity.origin.data.preferredName}}'>" +
	      "<i class='glyphicon glyphicon-chevron-up'></i> " +
	      "<span ng-bind='row.entity.origin.data.preferredName'></span>" +
	    "</span>" +
      "</div>" +
      "<div ng-if='row.entity.origin.type == \"search\" || row.entity.origin.type == \"add\"'>" +
	    "<span class='query' title='Search result of \"{{row.entity.origin.data}}\"'>" +
	      "<i class='glyphicon glyphicon-search'></i> " +
	      "<span>\"{{row.entity.origin.data}}\"</span>" +
	    "</span>" +
      "</div>",
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


/** Generate column definitions */
function createConceptsColumnDefs(showCommands, showOrigin, codingSystems) {
    var name = 
        { displayName: "Name", field: 'preferredName', cellClass: 'cellToolTip',
            cellTemplate: 
                "<span tooltip-html-unsafe='{{row.entity.definition || \"(no definition available)\"}}' " +
                "tooltip-placement='right' ng-bind='row.entity.preferredName' class='concept-name'></span>" };
    
    var origin = showOrigin ? [originColumnDef] : [];
    
    var semantics =
        { displayName: "Semantic type", field: 'semantic.types',
            cellTemplate: "<span class='semantic-type' ng-repeat='type in row.entity.semantic.types' ng-bind='type'></span>" };
    
    var cui =
        { displayName: "UMLS", field: 'cui',
            cellTemplate: "<span class='cui' ng-bind='row.entity.cui' title='{{row.entity.preferredName}}'></span>" };
    
    var codingSystemsColumnDefs = 
        codingSystems.map(function(codingSystem) {
            return {
                displayName: codingSystem,
                field: "codes." + codingSystem,
                cellClass: 'scroll-y',
                cellTemplate: "<span ng-repeat='code in row.getProperty(col.field)' ng-bind='code.id' title='{{code.preferredTerm}}'" +
                		"class='code' ng-class=\"code.selected ? 'selected' : 'unselected'\"></span>",
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
    return [].concat([name], [semantics], showOrigin ? [originColumnDef] : [], [cui], codingSystemsColumnDefs);
}


var historyColumnDefs = [
     { field: "date", displayName: "Date" },
     { field: "user", displayName: "User" },
     { field: "name", displayName: "Operation" },
     { field: "argument", displayName: "Argument",
         cellTemplate: "<span>{{row.entity[col.field] | historyDatumToString}}</span>" },
     { field: "result", displayName: "Result",
         cellTemplate: "<span>{{row.entity[col.field] | historyDatumToString}}</span>" }
 ];