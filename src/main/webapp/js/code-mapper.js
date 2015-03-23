

/**
 * The initial state that is used when no state is found for the case
 * definition.
 */
var INITIAL = {
	caseDefinition: "headache and fever",
	history: [],
	concepts: [],
	codingSystems: [ "ICD10CM", "ICD9CM", "ICPC2P", "RCD" ],
	semanticTypes:
		[ "T020", "T190", "T049", "T019", "T047", "T050", "T037", "T048", "T191", "T046", "T184", "T033" ] // Group
																											// "DISO"
																											// ("Findings":
																											// T033)
	 + [ "T005", "T004", "T204", "T007" ] // Some from group "LIVB",
};

/**
 * Concepts found by Peregrine are filtered by a stopword list and by the
 * following regex matching three-digit numbers and two-letter words.
 */
var STOPWORDS_REGEX = /^(\d{1,3}|\S{1,2})$/;

function CodingSystemsCtrl($scope, $timeout, dataService) {
	
	dataService.codingSystemsPromise.then(function() {
		$scope.all = dataService.codingSystems;
	});
	
	$scope.gridOptions = {
			data: "all",
			showSelectionCheckbox: true,
			rowHeight: 35,
			filterOptions: { filterText: '' },
			showFilter: true,
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
	     showFilter: true,
	     showSelectionCheckbox: true,
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

function CodeMapperCtrl($scope, $rootScope, $http, $timeout, $sce, $modal, $timeout, $q, $log, $routeParams, $location, blockUI, urls, dataService, user) {
	
	$scope.user = user;
	$scope.project = $routeParams.project;
	$scope.caseDefinitionName = $routeParams.caseDefinitionName;
	
	$scope.caseDefinition = "";
	
	// Reflects the abbreviations and current selection of coding systems and
	// semantic types
    $scope.selected = {
		codingSystems: null,
		semanticTypes: null
    };
    $scope.state = null; // State of the current translations
	$scope.numberUnsafedChanges = 0; // Changes since last save
    
    $scope.activateTab = function(id) {
    	$timeout(function() {
    		$("#" + id + " > a").click();
    	}, 0);
    }
    
    var ctrlKeydownCallbacks = {
    	48 /* 0 */: function() {
    		console.log("Case definition name", $scope.caseDefinitionName);
    		console.log("Case definition", $scope.caseDefinition);
    		console.log("Selected coding systems", $scope.selected.codingSystems);
    		console.log("Selected semantic types", $scope.selected.semanticTypes);
    		console.log("State", $scope.state);
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
    
    /** **************** */
    /* MESSAGES */
    /** **************** */

	$scope.messages = [];
	
	var inputBlockUi = blockUI.instances.get('inputBlockUi');

	var messages = {};
	var messagesCounter = 0;
	var updateMessages = function() {
		$scope.messages = [];
		for (var key in messages) {
			if (messages.hasOwnProperty(key) && messages[key] != undefined) {
				$scope.messages.push({
					ix: key,
					text: messages[key]
				});
			}
		}
	};
	$scope.createMessage = function(message) {
		var ix = messagesCounter++;
// console.log("Create message", ix, message);
		messages[ix] = message;
		updateMessages();
		return ix;
	};
	
	$scope.suffixMessage = function(ix, suffix) {
		messages[ix] = messages[ix] + suffix;
// console.log("Modify message", ix, messages[ix]);
		updateMessages();
	};
    
	/** Create a history step for $scope.history */
	$scope.historyStep = function(name, args) {
		$scope.numberUnsafedChanges += 1;
		$scope.state.history.push({
			date: new Date().toJSON(),
			name: name,
			args: args,
			user: user.username
		});
	};
	
	$scope.conceptsColumnDefs = createConceptsColumnDefs(true, true, []);
	$scope.conceptsGridOptions = {
		data: "state.concepts",
		rowHeight: 70,
		columnDefs: 'conceptsColumnDefs',
		enableRowSelection: false,
		enableCellSelection: true,
	    filterOptions: { filterText: '' },
// pinSelectionCheckbox: true,
// enableColumnResize: true, // Bugs the grid: it is not updated anymore when
// $scope.concepts changes
	};
	
	$scope.historyGridOptions = {
		data: "state.history",
		columnDefs: historyColumnDefs,
		enableRowSelection: false,
		enableCellSelection: true
	};
	
	dataService.completed.then(function() {
		$scope.loadTranslations();
	});

	/** ********** */
	/* FUNCTIONS */
	/** ********** */
	
	$scope.loadTranslations = function() {
		var initialStateMessage = $scope.createMessage("Loading coding... ");
		$http.get(urls.caseDefinition($scope.project, $scope.caseDefinitionName))
			.error(function(err, code, a2) {
				switch (code) {
					case 401:
						$scope.suffixMessage(initialStateMessage, "not allowed.");
						alert("You are not member for project " + $scope.project + ":(");
						$location.path('/dashboard');
						break;
					case 404:
						$scope.suffixMessage(initialStateMessage, "not found, created.");
						$scope.state = null;
						$scope.$broadcast("setSelectedSemanticTypes", INITIAL.semanticTypes);
				        $scope.$broadcast("setSelectedCodingSystems", INITIAL.codingSystems);
						$scope.caseDefinition = "" + INITIAL.caseDefinition;
						break;
				} 
			})
			.success(function(state) {
				console.log("Loaded", state);
				$scope.suffixMessage(initialStateMessage, "loaded.");
				$scope.state = state;
				$scope.caseDefinition = "" + state.caseDefinition;
				$scope.$broadcast("setSelectedSemanticTypes", state.semanticTypes);
				$scope.$broadcast("setSelectedCodingSystems", state.codingSystems);
				$scope.activateTab("concepts-tab");
				inputBlockUi.start("Cannot edit (reset the current coding to edit)");
			})
			.finally(function() {
				$scope.numberUnsafedChanges = 0;
				$scope.conceptsColumnDefs = createConceptsColumnDefs(true, true, $scope.state.codingSystems);
			});
	};
	
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
        	$scope.historyStep("Summarize", [summary]);
			var data = {
				state: JSON.stringify($scope.state)
			};
			var saveDefinitionMessage = $scope.createMessage("Save case definition... "); 
			$http.post(urls.caseDefinition($scope.project, $scope.caseDefinitionName), data, FORM_ENCODED_POST)
				.error(function(e) {
					$scope.suffixMessage(saveDefinitionMessage, "ERROR");
					console.log(e);
				})
				.success(function() {
					$scope.numberUnsafedChanges = 0;
					$scope.suffixMessage(saveDefinitionMessage, "OK");
				});
        });
	};
	
	$scope.searchConcepts = function(text, onConcepts) {
		
		if ($scope.state == null) {
			error("CodeMapperCtrl.searchAndAdd called without state");
			return;
		}

		// Index case definition with peregrine
		var searchConceptsMessage = $scope.createMessage("Search concepts... ");
		var data = {
			text: text
		};
		$http.post(dataService.peregrineResource + "/index", data, FORM_ENCODED_POST)
			.error(function(err) {
				var msg = "ERROR: Couldn't search concepts in case definition at " + dataService.peregrineResource;
				console.log(msg, err);
				alert(msg);
				$scope.suffixMessage(searchConceptsMessage, "ERROR");
			})
			.success(function(result) { 
				spans = result.spans.filter(function(span) {
					var isStopword = dataService.stopwords.indexOf(span.text.toUpperCase()) != -1;
					var isFiltered = STOPWORDS_REGEX.test(span.text);
					if (isStopword || isFiltered) {
						console.log("Filter span", span.text, isStopword ? "as stopword" : "", isFiltered ? "as regex" : "");
					}
					return !(isStopword || isFiltered);
				});
				$scope.suffixMessage(searchConceptsMessage, "OK, found " + spans.length);
				var cuis = [];
				spans.forEach(function(span) {
					var cui = cuiOfId(span.id);
					if (cuis.indexOf(cui) == -1) {
						cuis.push(cui);
					}
				});
				var lookupConceptsMessage = $scope.createMessage("Found " + cuis.length + " CUIs " +
						"(from " + spans.length + " spans) " +
						"looking up in coding systems ...");
				var data = {
					cuis : cuis,
					codingSystems : $scope.state.codingSystems
				};
				$http.post(urls.umlsConcepts, data, FORM_ENCODED_POST)
					.error(function(err) {
						var msg = "ERROR: Couldn't lookup concepts";
						$scope.suffixMessage(lookupConceptsMessage, "ERROR");
						alert(msg, err);
					})
					.success(function(concepts0) {
						concepts = $scope.filterAndPatch(concepts0);
						$scope.suffixMessage(lookupConceptsMessage, "OK, found " + concepts0.length + ", filtered to " + concepts.length);
						onConcepts(concepts);
					});
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
		}
		$scope.conceptsColumnDefs = createConceptsColumnDefs(true, true, $scope.state.codingSystems);
		$scope.searchConcepts(caseDefinition, function(concepts) {
			concepts.forEach(function(concept) {
				concept.origin = {
					type: "spans",
					data: spans.filter(function(span) {
						return cuiOfId(span.id) == concept.cui;
					})
				};
			});
			$scope.state.initialCuis = concepts.map(getCui);
			$scope.state.concepts = concepts;
			$scope.conceptsGridOptions.sortInfo = { field: ["sourceConceptsCount", "preferredName"], direction: "desc" };
			$scope.historyStep("Automatic coding", concepts.map(getCui));
			inputBlockUi.start("Reset concepts to edit!");
		});
	};
	
	/**
	 * Index a given query string for concepts, retrieve information and select
	 * concepts in a dialog for inclusion.
	 */
	$scope.searchAndAddConcepts = function(queryString) {
		$log.info("Search and add concepts");
		if ($scope.state == null) {
			error("CodeMapperCtrl.searchAndAddConcepts called without state");
			return;
		}
		$scope.searchConcepts(queryString, function(concepts) {
			var title = "Concepts for \"" + queryString + "\"";
			$scope.selectConceptsInDialog(concepts, title, true, function(selectedConcepts) {
				console.log(selectedConcepts);
				selectedConcepts.forEach(function(concept) {
					concept.origin = {
						type: "search",
						data: queryString
					};
				});
				$scope.state.concepts = selectedConcepts.concat($scope.state.concepts);
				$scope.historyStep("Search and add \"" + queryString + "\"", selectedConcepts.map(getCui));
			});
		});
	}
	
	$scope.resetConcepts = function() {
		console.log("RESET");
		$scope.$apply(function($scope) {
			$scope.numberUnsafedChanges = 0;
			$scope.state = null;
			$scope.conceptsColumnDefs = createConceptsColumnDefs(true, true, []);
			$scope.createMessage("Current codings have been reset.");
			inputBlockUi.reset();
		});
	};
	
	/** Delete a concepts from $scope.state.concepts by its cui. */
	$scope.deleteConcept = function(cui) {
		if ($scope.state == null) {
			error("CodeMapperCtrl.deleteConcept called without state");
			return;
		}
		var deleted = [];
		$scope.state.concepts = $scope.state.concepts
			.filter(function(concept) {
				if (concept.cui == cui) {
					deleted.push(concept.preferredName);
					return false;
				}
				return true;
			});
		$scope.historyStep("delete concept", [cui]);
		$scope.createMessage("Deleted concepts " + deleted.join(", "));
	};
	
	/**
	 * Expand a given concept to its hypernyms or hyponyms, show selection
	 * dialog and integrate in the list of concepts ($scope.state.concepts).
	 */
    $scope.expandRelated = function(hyponymsNotHypernyms, concept) {
		if ($scope.state == null) {
			error("CodeMapperCtrl.expandRelated called without state");
			return;
		}
		var hyponymOrHypernym = hyponymsNotHypernyms ? "hyponym" : "hypernym";
    	var lookupExpandMessage = $scope.createMessage("Looking up " + hyponymOrHypernym + "s... ");
    	
    	var data = {
			cuis: [ concept.cui ],
			hyponymsNotHypernyms: hyponymsNotHypernyms,
			codingSystems: $scope.state.codingSystems
		};
    	// Retrieve related concepts from the API
    	$http.post(urls.relatedConcepts, data, FORM_ENCODED_POST)
    		.error(function(err) {
    			var msg = "ERROR: Couldn't lookup related concepts at " + urls.relatedConcepts;
    			alert(msg);
    			console.log(msg, err);
    			$scope.suffixMessage(lookupExpandMessage, "ERROR")
    		})
    		.success(function(relatedConcepts0) {
    			relatedConcepts0 = relatedConcepts0[concept.cui];
    			if (relatedConcepts0) {
    				
    				var relatedConcepts = $scope.filterAndPatch(relatedConcepts0);
		    			
	    			$scope.suffixMessage(lookupExpandMessage, "OK, found " + relatedConcepts0.length
	    					+ " filter to " + relatedConcepts.length);
	    			
	    			var title = "Select " + hyponymOrHypernym + "s of " + concept.cui + "/" + concept.preferredName;
	    			$scope.selectConceptsInDialog(relatedConcepts, title, true, function(selectedRelatedConcepts) {
	    				selectedRelatedConcepts.forEach(function(concept1) {
		    				concept1.origin = {
		    					type: hyponymOrHypernym,
		    					data: concept.cui
		    				}
		    			});
    		        	// Search position of original inital concept
    					var conceptOffset;
    					$scope.state.concepts.forEach(function(c, cIx) {
    						if (c.cui == concept.cui) {
    							conceptOffset = cIx;
    						}
    					});
    					// Insert each related concept in list of concepts
    					selectedRelatedConcepts.forEach(function(related, ix) {
    						$scope.state.concepts.splice(conceptOffset + ix + 1, 0, related);
    					});
    					$scope.historyStep("Expand " + hyponymOrHypernym + "s of " + concept.preferredName + " (" + concept.cui + ")",
    							selectedRelatedConcepts.map(getCui));
	    			});
    			} else {
    				console.log("Related concepts not retrieved");
    				$scope.suffixMessage(lookupExpandMessage, "ERROR");
    			}
    		});        
    };
    
    $scope.selectConceptsInDialog = function(concepts, title, selectable, onSelectedConcepts) {
		
		// Display retrieved concepts in a dialog
        var modalInstance = $modal.open({
          templateUrl: 'partials/ShowConcepts.html',
          controller: 'ShowConceptsCtrl',
          size: 'lg',
          resolve: {
    	    title: function() { return title; },
        	concepts: function() { return concepts; },
        	codingSystems: function() { return $scope.state.codingSystems; },
        	selectable: function() { return selectable; }
          }
        });

        modalInstance.result.then(onSelectedConcepts);
    }

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
		
		[ [$scope.caseDefinitionName],
          ["Generated by ADVANCE Code Mapper"]
        ].forEach(function(row) { data.push(row); });
		
		[ [],
		  ["CONCEPTS"],
		  ["Name", "CUI", "Vocabulary", "Code"]
        ].forEach(function(row) { data.push(row); });
		selectedCodingSystemsAbbreviations.forEach(function(vocabulary) {
			$scope.state.concepts.forEach(function(concept) {
				concept.codes[vocabulary].forEach(function(code) {
					data.push([concept.preferredName, concept.cui, vocabulary, code]);
				})
			});
		});
		
		[ [],
		  ["INITIAL CUIS"]
		].concat($scope.state.initialCuis.map(function(cui) { return [cui]; }))
		 .forEach(function(row) { data.push(row); });
		
		[ [],
          ["HISTORY"],
          ["Date", "Step", "Arguments"]
        ].forEach(function(row) { data.push(row); });
		if ($scope.state.history) {
			$scope.state.history.forEach(function(step) {
				data.push([step.date, step.name].concat(step.args));
			});
		}
		
		[ [],
		  ["CASE DEFINITION"]
		].forEach(function(row) { data.push(row); });
		$scope.state.caseDefinition.split("\n").forEach(function(line) {
			data.push([line]);
		});
		
		var csv = csvEncode(data);
		console.log(csv);
		var file = new Blob([ csv ], {
			type : 'attachment/csv;charset=UTF-8'
		});
		var fileURL = URL.createObjectURL(file);
		var a = document.createElement('a');
		a.href = fileURL;
		a.target = '_blank';
		a.download = encodeURIComponent($scope.project + '_' + $scope.caseDefinitionName) + '.csv';
		document.body.appendChild(a);
		a.click();
	};
    
    /** ************ */
    /* AUXILIARIES */
    /** ************ */

	/** Filters the list of `concepts` and adapts the data for the application. */
	$scope.filterAndPatch = function(concepts, filteredBySemanticType, filteredByCurrentConcepts) {
		
		var currentCuis = $scope.state.concepts.map(getCui);
		
	    // Record concepts that are not yet available but filtered out due to
		// its
		// semantic type
	    if (filteredBySemanticType === undefined)
	    	filteredBySemanticType = [];
	    if (filteredByCurrentConcepts === undefined)
	    	filteredByCurrentConcepts = [];
		return concepts
			// Filter out concepts that are already available
	    	.filter(function(concept) {
	    		var isNovel = currentCuis.indexOf(concept.cui) == -1;
	    		if (!isNovel) {
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
				if (!matchesSemanticTypes) {
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
	    					return sourceConcept.id;
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
function ShowConceptsCtrl($scope, $http, $modalInstance, $timeout, concepts, codingSystems, title, selectable) {
	
	$scope.concepts = concepts;
	$scope.title = title;
	$scope.selectable = selectable;
	
	$scope.conceptsGridOptions = {
		data: "concepts",
		rowHeight: 70,
	    filterOptions: { filterText: '' },
		showSelectionCheckbox: $scope.selectable,
		enableRowSelection: $scope.selectable,
		columnDefs: createConceptsColumnDefs(false, false, codingSystems)
	};
	
	if ($scope.selectable) {
		$timeout(function() {
			$scope.concepts.forEach(function(concept, index) {
				if (concept.sourceConcepts.length > 0) {
					$scope.conceptsGridOptions.selectItem(index, true);
				}
			});
		}, 0);
		$scope.ok = function () {
			$modalInstance.close($scope.conceptsGridOptions.$gridScope.selectedItems);
		};
		$scope.cancel = function () {
			$modalInstance.dismiss('cancel');
		};
	} else {
		$scope.ok = function () {
			$modalInstance.close();
		};
	}
};

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

/** Column definitions only in primary concepts list, not in the dialog. */
var commandsColumnDef = {
	displayName: 'Commands',
    minWidth: '100px',
    cellTemplate:
	   "<div class='concept-buttons'>" +
		   "<button ng-click='deleteConcept(row.entity.cui)' class='btn btn-default btn-sm' title='Delete'>" +
              "<i class='glyphicon glyphicon-remove-circle'></i>" +
            "</button>" +
            "<button class='btn btn-default' ng-click='expandRelated(false, row.entity)' title='Expand Hypernyms'>" +
              "<i class='glyphicon glyphicon-chevron-up'></i>" +
            "</button>" +
            "<button class='btn btn-default' ng-click='expandRelated(true, row.entity)' title='Expand Hyponyms'>" +
              "<i class='glyphicon glyphicon-chevron-down'></i>" +
            "</button>" +
        "</div>"
};

var originColumnDef = {
	displayName: 'Origin',
    cellClass: 'scroll-y',
    field: 'origin',
    cellTemplate:
      "<div ng-if='row.entity.origin.type == \"spans\"' class='spans' title='Found in case definition'>" +
        "<span class=span ng-repeat='span in row.entity.origin.data' ng-bind='span.text'></span>" +
      "</div>" +
      "<div ng-if='row.entity.origin.type == \"hyponym\"'>" +
        "<span class='cui' title='Hyponym of {{row.entity.origin.data}}'>" +
          "<span ng-bind='row.entity.origin.data'></span>" +
          "<i class='glyphicon glyphicon-chevron-down'></i> " +
        "</span>" +
      "</div>" +
      "<div ng-if='row.entity.origin.type == \"hypernym\"'>" +
	    "<span class='cui' title='Hypernym of {{row.entity.origin.data}}'>" +
	      "<span ng-bind='row.entity.origin.data'></span>" +
	      "<i class='glyphicon glyphicon-chevron-up'></i> " +
	    "</span>" +
      "</div>" +
      "<div ng-if='row.entity.origin.type == \"search\"'>" +
	    "<span class='query' title='Search result of \"{{row.entity.origin.data}}\"'>" +
	      "<span>\"{{row.entity.origin.data}}\"</span>" +
	      "<i class='glyphicon glyphicon-search'></i> " +
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
	var mainColumnDefs = [
	    { displayName: "CUI", field: 'cui',
	      cellTemplate: "<span class='cui' ng-bind='row.entity.cui'></span>" },
	    { displayName: "Name", field: 'preferredName', cellClass: 'cellToolTip',
	      cellTemplate: 
	    	  "<span tooltip-html-unsafe='{{row.entity.definition || \"(no definition available)\"}}' " +
			  "tooltip-placement='right' ng-bind='row.entity.preferredName' class='concept-name'></span>"},
	    { displayName: "Semantic types", field: 'semantic.types',
		  cellTemplate: "<span class='semantic-type' ng-repeat='type in row.entity.semantic.types' ng-bind='type'></span>" },
	    { displayName: "Semantic groups", field: 'semantic.groups',
		  cellTemplate: "<span class='semantic-group' ng-repeat='group in row.entity.semantic.groups' ng-bind='group'></span>" }
	];
	var codingSystemsColumnDefs = 
		codingSystems.map(function(codingSystem) {
	    	return {
	    		displayName: codingSystem,
	    		field: "codes." + codingSystem,
	 		    cellClass: 'scroll-y',
	    		cellTemplate: "<span class='code' ng-repeat='code in row.getProperty(col.field)' ng-bind='code'></span>",
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
	return [].concat(
			showCommands ? [commandsColumnDef] : [],
			showOrigin ? [originColumnDef] : [],
			mainColumnDefs,
			codingSystemsColumnDefs);
}


var historyColumnDefs = [
   { field: "date", displayName: "Date" },
   { field: "user", displayName: "User" },
   { field: "name", displayName: "Step" },
   { field: "args", displayName: "Arguments",
	 cellTemplate: "<div>{{row.entity[col.field].join(', ')}}</div>" }
];