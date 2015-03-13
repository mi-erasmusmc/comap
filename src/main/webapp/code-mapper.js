

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
 * Concepts found by Peregrine are filtered by a stopword list and by a regex
 * for three-digit numbers and two-digit words.
 */
var FILTER_SPANS_REGEX = /^(\d{1,3}|\S{1,2})$/;

function error(msg, consoleArgs) {
	msg = "ERROR: " + msg;
	console.log(msg, consoleArgs);
	alert(msg);
}

function confirmClickDirective() {
	  return {
	    priority: 1,
	    terminal: true,
	    link: function (scope, element, attr) {
	      var msg = attr.confirmClick || "Are you sure?";
	      var clickAction = attr.ngClick;
	      element.bind('click',function () {
	        if ( window.confirm(msg) ) {
	          scope.$eval(clickAction)
	        }
	      });
	    }
	  }
};

/** Provide the URLs that are called from the application. */
function UrlsService(peregrineResourceUrl) {
	
	this.peregrineResource = peregrineResourceUrl;
	
	this.semanticTypes = "data/semantic_types_groups.json";
	this.stopwords = "data/stopwords.json";

	var persistencyApi = 'resource/persistency';
	this.caseDefinition = persistencyApi + '/case-definition';

	var codeMapperApi = 'resource/code-mapper';
	this.codingSystems = codeMapperApi + '/coding-systems';
	this.umlsConcepts = codeMapperApi + '/umls-concepts';
	this.relatedConcepts = codeMapperApi + '/related';
}

/** Retrieve and provide stopwords, semantic types and coding systems. */
function DataService($http, $q, urls) {
	var service = this;
	this.stopwords = null;
	this.stopwordsPromise = $http.get(urls.stopwords)
		.error(function(err) {
			var msg = "ERROR: Couldn't retrieve stopwords from " + urls.stopwords;
			console.log(msg, err);
			alert(msg);
		})
		.success(function(stopwords) {
// console.log("STOPWORDS", stopwords);
			service.stopwords = stopwords;
		});
	this.semanticTypes = null;
	this.semanticTypesByType = {};
	this.semanticTypesPromise = $http.get(urls.semanticTypes)
		.error(function(err) {
			var msg = "ERROR: Couldn't load semantic types and groups from " + urls.semanticTypes;
			console.log(msg, err);
			alert(msg);
		})
		.success(function(semanticTypes) {
// console.log("SEMANTIC TYPES", semanticTypes);
			service.semanticTypes = semanticTypes;
			service.semanticTypes.forEach(function(semanticType) {
				service.semanticTypesByType[semanticType.type] = semanticType;
		    });
		});
	this.codingSystems = null;
	this.codingSystemsPromise = $http.get(urls.codingSystems)
		.error(function(err) {
			var msg = "ERROR: Couldn't retrieve coding systems from " + urls.codingSystems;
			console.log(msg, err);
			alert(msg);
		})
		.success(function(codingSystems) {
// console.log("CODING SYSTEMS", codingSystems);
			service.codingSystems = codingSystems
				.sort(function(v1, v2) {
					if (v1.abbreviation < v2.abbreviation) {
						return -1;
					}
					if (v1.abbreviation > v2.abbreviation) {
						return 1;
					}
					return 0;
				});
		});
	this.completed = $q.all([this.stopwordsPromise, this.semanticTypesPromise, this.codingSystemsPromise]);
}

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
 

function CodeMapperCtrl($scope, $http, $timeout, $sce, $modal, $timeout, $q, blockUI, urls, dataService) {
	
	$scope.caseDefinition = "";
	// Reflects the abbreviations and current selection of coding systems and semantic types
    $scope.selected = {
		codingSystems: null,
		semanticTypes: null
    };
    $scope.state = null; // State of the current translations
    
    $scope.activateTab = function(id) {
    	$timeout(function() {
    		$("#" + id + " > a").click();
    	}, 0);
    }
    
    var ctrlKeydownCallbacks = {
    	48 /* 0 */: function() {
    		console.log("Case definition", $scope.caseDefinition);
    		console.log("Selected coding systems", $scope.selected.codingSystems);
    		console.log("Selected semantic types", $scope.selected.semanticTypes);
    		console.log("State", $scope.state);
    	},
    	49 /* 1 */: function() {
    		$scope.activateTab("coding-systems-tab");
    	},
    	50 /* 2 */: function() {
    		$scope.activateTab("semantics-tab");
    	},
    	51 /* 3 */: function() {
    		$scope.activateTab("case-definition-tab");
    	},
    	52 /* 4 */: function() {
    		$scope.activateTab("concepts-tab");
    	},
    	53 /* 5 */: function() {
    		$scope.activateTab("history-tab");
    	}  	
    };
    
    $scope.onKeydown = function(event) {
    	if (event.ctrlKey) {
    		var callback = ctrlKeydownCallbacks[event.keyCode];
    		if (callback) {
    			callback();
    		} else {
    			console.log("No callback for keyCode", event.keyCode);
    		}
    	}
    };
    
    /*******************/
    /* MESSAGES */
    /*******************/

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
		$scope.state.history.push({
			date: new Date().toString(),
			name: name,
			args: args
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
		columnDefs: [
		   { field: "date", displayName: "Date" },
		   { field: "name", displayName: "Step" },
		   { field: "args", displayName: "Arguments",
			 cellTemplate: "<div>{{row.entity[col.field].join(', ')}}</div>" }
	   ],
		enableRowSelection: false,
		enableCellSelection: true
	};
	
	dataService.completed.then(function() {
		$scope.loadTranslations();
	});

	/** ********** */
	/* FUNCTIONS */
	/** ********** */
	
	/**
	 * Index the case definition ($scope.caseDefinition) for concepts, retrieve
	 * information about those concepts and display.
	 */ 
	$scope.searchConcepts = function() {
		if ($scope.state != null) {
			error("CodeMapperCtrl.searchConcepts called while state not null");
			return;
		}
		$scope.conceptsColumnDefs = createConceptsColumnDefs(true, true, $scope.selected.codingSystems);
		var url = urls.peregrineResource + "/index";
		var data = {
			text: $scope.caseDefinition
		};
		var searchConceptsMessage = $scope.createMessage("Search concepts in case definition... ");
		// Index case definition with peregrine
		$http.post(url, data, FORM_ENCODED_POST)
			.error(function(err) {
				var msg = "ERROR: Couldn't search concepts in case definition at " + url;
				console.log(msg, err);
				alert(msg);
				$scope.suffixMessage(searchConceptsMessage, "ERROR");
			})
			.success(function(result) { 
				spans = result.spans.filter(function(span) {
					var isStopword = dataService.stopwords.indexOf(span.text.toUpperCase()) != -1;
					var isFiltered = FILTER_SPANS_REGEX.test(span.text);
					if (isStopword || isFiltered) {
						console.log("Filter span", span.text, isStopword ? "as stopword" : "", isFiltered ? "as regex" : "");
					}
					return !(isStopword || isFiltered);
				});
				$scope.suffixMessage(searchConceptsMessage, "OK, found " + spans.length);
				var cuis = [];
				function cuiOfId(id) {
					return 'C' + Array(8 - id.length).join('0') + id;
				}
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
					codingSystems : $scope.selected.codingSystems.map(getAbbreviation)
				};
				console.log("UMLS concepts for", data);
				$http.post(urls.umlsConcepts, data, FORM_ENCODED_POST)
					.error(function(err) {
						var msg = "ERROR: Couldn't lookup concepts";
						$scope.suffixMessage(lookupConceptsMessage, "ERROR");
						alert(msg, err);
					})
					.success(function(concepts) {
						// Adapt spans of concepts
						concepts.forEach(function(concept) {
							concept.spans = spans.filter(function(span) {
								return cuiOfId(span.id) == concept.cui;
							});
						});
						var r = filterAndPatch(concepts, $scope.selected.codingSystems, $scope.selected.semanticTypes, dataService.semanticTypesByType);
						r.droppedBySemanticType.forEach(function(concept) {
							console.log("Dropped", concept.cui, concept.preferredName, concept.semantic.types.join(", "));
						});
						// Display relevant concepts
						$scope.state = {
							caseDefinition: $scope.caseDefinition,
							codingSystems: $scope.selected.codingSystems.map(getAbbreviation),
							semanticTypes: $scope.selected.semanticTypes.map(getType),
							initialCuis: r.concepts.map(getCui),
							concepts: r.concepts,
							history: []
						};
						$scope.conceptsGridOptions.sortInfo = { field: ["sourceConceptsCount", "preferredName"], direction: "desc" };
						$scope.historyStep("Search concepts")
						$scope.suffixMessage(lookupConceptsMessage, "OK, found " + concepts.length + ", filtered on semantic types to " + $scope.state.concepts.length);

						inputBlockUi.start("Reset concepts to edit!");
					});
			});
	};
	
	$scope.resetConcepts = function() {
		$scope.state = null;
		$scope.conceptsColumnDefs = createConceptsColumnDefs(true, true, []);
		inputBlockUi.reset();
	};
	
	/** Delete a concepts from $scope.state.concepts by its cui. */
	$scope.deleteConcept = function(cui) {
		if ($scope.state == null) {
			error("CodeMapperCtrl.deleteConcept called wtihout state");
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
		$scope.message("Deleted concepts " + deleted.join(", "));
	};
	
	/**
	 * Expand a given concept to its hypernyms or hyponyms, show selection
	 * dialog and integrate in the list of concepts ($scope.state.concepts).
	 */
    $scope.expandRelated = function(hyponymsNotHypernyms, concept) {
		if ($scope.state == null) {
			error("CodeMapperCtrl.expandRelated called wtihout state");
			return;
		}
    	var lookupExpandMessage = $scope.createMessage("Looking up " + (hyponymsNotHypernyms ? "hyponyms" : "hypernyms") + "... ");
    	
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
    			if (relatedConcepts0.hasOwnProperty(concept.cui)) {
    				var r = filterAndPatch(relatedConcepts0[concept.cui], $scope.state.codingSystems, $scope.state.semanticTypes, dataService.semanticTypesByType, $scope.state.concepts);
	    			var relatedConcepts = r.concepts;
					r.droppedBySemanticType.forEach(function(concept) {
						console.log("Dropped", concept.cui, concept.preferredName, concept.semantic.types.join(", "));
					});
		    			
	    			$scope.suffixMessage(lookupExpandMessage, "OK, found " + relatedConcepts0[concept.cui].length
	    					+ " filter to " + relatedConcepts.length);
	    	        var name = hyponymsNotHypernyms ? "hyponyms" : "hypernyms";
	    			// Display retrieved concepts in a dialog
	    	        var modalInstance = $modal.open({
	    	          templateUrl: 'ShowConcepts.html',
	    	          controller: 'ShowConceptsCtrl',
	    	          size: 'lg',
	    	          resolve: {
	    	        	codingSystems: function() { return $scope.state.codingSystems; },
	    	        	concepts: function() { return relatedConcepts; },
	    	        	title: function() { return "Select " + name
	    	        		+ " of " + concept.cui + "/" + concept.preferredName; },
	    	        	selectable: function() { return true; }
	    	          }
	    	        });
	
	    	        modalInstance.result
	    		        .then(function (selectedRelated) {
	    		        	// Search position of original inital concept
	    					var conceptOffset;
	    					$scope.state.concepts.forEach(function(c, cIx) {
	    						if (c.cui == concept.cui) {
	    							conceptOffset = cIx;
	    						}
	    					});
	    					// Insert each related concept in list of concepts
	    					selectedRelated.forEach(function(related, ix) {
	    						$scope.state.concepts.splice(conceptOffset + ix + 1, 0, related);
	    					});
	    					$scope.historyStep("expand " + name + " of " + concept.cui + " (" + concept.preferredName + ")", selectedRelated.map(getCui));
	    		        }, function () {
	    		        	console.log('Modal dismissed at: ' + new Date());
	    		        });
    			} else {
    				console.log("Related concepts not retrieved");
    				$scope.suffixMessage(lookupExpandMessage, "ERROR");
    			}
    		});        
    };

	$scope.downloadConcepts = function() {
		if ($scope.state == null) {
			error("CodeMapperCtrl.downloadConcepts called wtihout state");
			return;
		}
		console.log("Download concepts");
		var selectedCodingSystemsAbbreviations = $scope.selected.codingSystems
			.map(function(voc) {
				return voc.abbreviation;
			});
		
		var data = [];
		
		[ [CASE_DEFINITION_NAME],
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
		  ["INITIAL CUIS"],
		  $scope.state.initialCuis
		].forEach(function(row) { data.push(row); });
		
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
		a.download = 'case_definition_' + encodeURIComponent(CASE_DEFINITION_NAME) + '.csv';
		document.body.appendChild(a);
		a.click();
	};
	
	$scope.saveTranslations = function() {
		if ($scope.state == null) {
			error("CodeMapperCtrl.expandRelated called wtihout state");
			return;
		}
		var data = {
			state: JSON.stringify($scope.state)
		};
		var saveaseDefinitionMessage = $scope.createMessage("Save case definition... "); 
		$http.post(urls.caseDefinition + '/' + encodeURIComponent(CASE_DEFINITION_NAME), data, FORM_ENCODED_POST)
			.error(function(e) {
				$scope.suffixMessage(saveaseDefinitionMessage, "ERROR");
				console.log(e);
			})
			.success(function() {
				$scope.suffixMessage(saveaseDefinitionMessage, "OK");
			});
	};
	
	$scope.loadTranslations = function() {
		var initialStateMessage = $scope.createMessage("Retrieve state... ");
		$http.get(urls.caseDefinition + '/' + encodeURIComponent(CASE_DEFINITION_NAME))
			.error(function(err) {
				$scope.state = null;
				$scope.suffixMessage(initialStateMessage, "not found, created.");
				$scope.$broadcast("setSelectedSemanticTypes", INITIAL.semanticTypes);
		        $scope.$broadcast("setSelectedCodingSystems", INITIAL.codingSystems);
				$scope.caseDefinition = "" + INITIAL.caseDefinition;
			})
			.success(function(state) {
				$scope.suffixMessage(initialStateMessage, "LOADED.");
				console.log("Loaded", state);
				$scope.state = state;
				$scope.caseDefinition = "" + state.caseDefinition;
				$scope.$broadcast("setSelectedSemanticTypes", state.semanticTypes);
				$scope.$broadcast("setSelectedCodingSystems", state.codingSystems);
				$scope.activateTab("concepts-tab");
			})
			.finally(function() {
				$scope.conceptsColumnDefs = createConceptsColumnDefs(true, true, $scope.selected.codingSystems);
				$timeout(function() {
					if ($scope.state != null) {
						inputBlockUi.start("Reset concepts to edit!");
						$('#concepts-tab > a').click();
					}
				}, 0);
			});
	};
	
	$scope.showDroppedConcepts = function(concepts) {
		if (concepts.length > 0) {
	        var modalInstance = $modal.open({
  	          templateUrl: 'ShowConcepts.html',
  	          controller: 'ShowConceptsCtrl',
  	          size: 'lg',
  	          resolve: {
  	        	codingSystems: function() { return []; },// $scope.selected.codingSystems;
															// },
  	        	concepts: function() { return concepts; },
  	        	title: function() { return "Concepts filtered by semantic type"; },
  	        	selectable: function() { return false; }
  	          }
  	        });
	        return modalInstance.result;
		} else {
			return {
				then: function(k) { return k(); }
			};
		}
	};
    
    /** ************ */
    /* AUXILIARIES */
    /** ************ */

	$scope.trustDefinition = function(definition) {
		return $sce.trustAsHtml(definition);
	};
};

/** Filters the list of `concepts` and adapts the data for the application. */
function filterAndPatch(concepts, selectedCodingSystems, selectedSemanticTypes, semanticTypesByType, currentConcepts) {
	selectedCodingSystems = selectedCodingSystems.map(function(cs) { return cs.abbreviation; });
	selectedSemanticTypes = selectedSemanticTypes.map(function(st) { return st.type; });
	
	console.log("selectedCodingSystems", selectedCodingSystems);
	
	var knownCuis = currentConcepts ? currentConcepts.map(getCui) : [];
	
    // Record concepts that are not yet available but filtered out due to its
	// semantic type
    var droppedBySemanticType = [];
	var result = concepts
		// Filter out concepts that are already in available
    	.filter(function(concept) {
    		return knownCuis.indexOf(concept.cui) == -1;
    	})
    	// Patch: adapt concepts for application
    	.map(function(concept0) {
    		var concept = angular.copy(concept0);
    		console.log(concept, concept.sourceConcepts);
    		// Add field `codes` that is a mapping from coding systems to source
			// concepts
    		concept.codes = {};
    		selectedCodingSystems.forEach(function(codingSystem) {
    			concept.codes[codingSystem] = concept.sourceConcepts
    				.filter(function(sourceConcept) {
    					console.log(sourceConcept, codingSystem);
    					return sourceConcept.vocabulary == codingSystem;
    				})
    				.map(function(sourceConcept) {
    					return sourceConcept.id;
    				});
    		});
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
    	})
    	// Filter out concepts by semantic type (and record those)
    	.filter(function(concept) {
    		var matchesSemanticTypes =
    			concept.semanticTypes
					.filter(function(type) {
						return selectedSemanticTypes.indexOf(type) != -1;
					})
					.length > 0;
			if (!matchesSemanticTypes) {
				droppedBySemanticType.push(concept);
			}
    		return matchesSemanticTypes;
    	});
	return {
		concepts: result,
		droppedBySemanticType: droppedBySemanticType
	}
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
		columnDefs: createConceptsColumnDefs(false, true, codingSystems)
	};
	
	if ($scope.selectable) {
		$timeout(function() {
			$scope.concepts.forEach(function(concept, index) {
				if (concept.sourceConcepts.length > 0) {
					console.log("Pre-select", concept.cui, index);
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

var spansColumnDef = {
	displayName: 'Spans',
    cellClass: 'scroll-y',
    field: 'spans',
    cellTemplate:
      "<div class='spans'>" +
        "<span class=span ng-if='row.entity.spans != undefined' ng-repeat='span in row.entity.spans' ng-bind='span.text'></span>" +
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
function createConceptsColumnDefs(showCommands, showSpans, codingSystems) {
	var mainColumnDefs = [
	    { displayName: "CUI", field: 'cui' },
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
	    		displayName: codingSystem.abbreviation,
	    		field: "codes." + codingSystem.abbreviation,
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
	console.log(codingSystemsColumnDefs);
	return [].concat(
			showCommands ? [commandsColumnDef] : [],
			showSpans ? [spansColumnDef] : [],
			mainColumnDefs,
			codingSystemsColumnDefs);
}

/**
 * AngularJS sends data for HTTP POST JSON - this header is to encode it as FORM
 * data.
 */
var FORM_ENCODED_POST = {
	headers : {
		'Content-Type' : 'application/x-www-form-urlencoded'
	},
	transformRequest : function(obj) {
		var str = [];
		for ( var key in obj) {
			if (obj[key] instanceof Array) {
				for ( var idx in obj[key]) {
					var subObj = obj[key][idx];
					str.push(encodeURIComponent(key) + "="
							+ encodeURIComponent(subObj));
				}
			} else {
				str.push(encodeURIComponent(key) + "="
						+ encodeURIComponent(obj[key]));
			}
		}
		return str.join("&");
	}
};

function getCui(concept) {
	return concept.cui;
}

function getAbbreviation(codingSystem) {
	return codingSystem.abbreviation;
}

function getType(semanticType) {
	return semanticType.type;
}

/** Encodes an 2-D array of data to CSV. */
function csvEncode(data) {
	function escape(field) {
		if (field == null || field == undefined) {
			return "";
		} else {
			if (typeof field == 'string'
					&& (field.indexOf('"') != -1 || field.indexOf(',') != -1)) {
				return '"' + field.replace('"', '""') + '"';
			} else {
				return "" + field;
			}
		}
	}
	var result = "";
	data.forEach(function(row) {
		result += row.map(escape).join(', ') + '\n';
	});
	return result;
}