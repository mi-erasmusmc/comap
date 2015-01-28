
var CODE_MAPPER_API_URL = 'resource/code-mapper';
//var CODE_MAPPER_API_URL = 'mockup'
var CONFIG_URL =  CODE_MAPPER_API_URL + "/config";
var CODING_SYSTEMS_URL = CODE_MAPPER_API_URL + '/coding-systems';
var UMLS_CONCEPTS_API_URL = CODE_MAPPER_API_URL + '/umls-concepts';
var RELATED_CONCEPTS_API_URL = CODE_MAPPER_API_URL + '/related';
var SEMANTIC_TYPES_GROUPS_URL = "data/semantic_types_groups.json";
var STOPWORDS_URL = "data/stopwords.json";

//var DEFAULT_CODING_SYSTEMS = [ "RCD", "ICD10CM", "ICD9CM", "ICPC2P", "ICPC2EENG", "ICD10", "ICD10AE" ]; // 'MSH', 'ICD10', 'ICPC', 'MDR', 'MEDLINEPLUS', 'RCD'
var DEFAULT_CODING_SYSTEMS = [ "ICD10CM", "ICD9CM", "ICPC2P", "RCD" ];

var DEFAULT_SEMANTIC_TYPES =
	[ "T020", "T190", "T049", "T019", "T047", "T050", "T037", "T048", "T191", "T046", "T184", "T033" ] // Group "DISO" ("Findings": T033)
 + [ "T005", "T004", "T204", "T007" ]; // Some from group "LIVB"


// Concepts found by Peregrine are filtered by a stopword list and
// by a regex for three-digit numbers and two-digit words.
var FILTER_SPANS_REGEX = /^(\d{1,3}|\S{1,2})$/;
var STOPWORDS = null;

var CodeMapperApp = angular.module('CodeMapperApp', [ 'ui.bootstrap', 'ngSanitize', 'ngGrid' ]);

var ngConfirmClick = CodeMapperApp.directive('ngConfirmClick', [
    function(){
        return {
            link: function (scope, element, attr) {
                var msg = attr.ngConfirmClick || "Are you sure?";
                var clickAction = attr.confirmedClick;
                element.bind('click', function (event) {
                    if (scope.$eval(attr.ngDontConfirm) || window.confirm(msg)) {
                        scope.$eval(clickAction)
                    }
                });
            }
        };
}])

var CodeMapperCtrl = CodeMapperApp.controller('CodeMapperCtrl', function($scope, $http, $timeout, $sce, $modal, $timeout) {
	
	/*******************/
	/* SCOPE VARIABLES */
	/*******************/

	$scope.semanticTypesGroups = [];
	$scope.vocabularies = [];
	$scope.caseDefinition = "";
	$scope.caseDefinitionName = "";
	$scope.concepts = [];
	$scope.selected = [];
    $scope.config = {}; // Configuration that was last used to generate $scope.concepts 
    
    /****************************/
    /* UI BLOCKING AND MESSAGES */
    /****************************/

	$scope.isBlocked = false;
	$scope.messages = [];
	var blocks = [];
	var blocksCounter = 0;
	var messages = {};
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
		$('#mask').height($(document).height());
		$scope.isBlocked = blocks.length > 0;
	};
	$scope.message = function(message) {
		messages[blocksCounter++] = message;
		updateMessages();
	};
	$scope.block = function(message) {
		console.log("Block", message);
		var ix = blocksCounter++;
		blocks.push(ix);
		messages[ix] = message;
		updateMessages();
		return ix;
	};
	$scope.unblock = function(ix, suffix, keepBlocked) {
		console.log("Unblock", ix, suffix);
		blocks = blocks.filter(function(ix2) { return ix != ix2; });
		messages[ix] = messages[ix] + suffix;
		updateMessages();
	};
    
	/** Create a history step for $scope.history */
	$scope.historyStep = function(name, args) {
		$scope.config.history.push({
			name: name,
			args: args
		});
	};
	
	/************/
	/* CONCEPTS */
	/************/
	
	$scope.conceptsColumnDefs = createConceptsColumnDefs(true, true, []);
	$scope.conceptsGridOptions = {
		data: "concepts",
		rowHeight: 70,
		columnDefs: 'conceptsColumnDefs',
		enableRowSelection: false,
		enableCellSelection: true,
	    filterOptions: { filterText: '' },
//		pinSelectionCheckbox: true,
//		enableColumnResize: true, // Bugs the grid: it is not updated anymore when $scope.concepts changes
	};

	/****************/
	/* VOCABULARIES */
	/****************/

	$scope.vocabulariesGridOptions = {
		data: "vocabularies",
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
		$scope.selectedVocabularies = $scope.vocabulariesGridOptions.$gridScope.selectedItems;
	}, 0);
	
	$scope.unselectVocabulary = function(voc) {
		$scope.vocabularies.forEach(function(voc1, index) {
			if (voc.abbreviation == voc1.abbreviation) {
				$scope.vocabulariesGridOptions.selectItem(index, false);
			}
		});
	};
	
	/*****************************/
	/* SEMANTIC TYPES AND GROUPS */
	/*****************************/

    var semanticTypesGroupsByType = {};
    $scope.$watch('semanticTypesGroups', function(semanticTypesGroups) {
    	semanticTypesGroupsByType = {};
    	semanticTypesGroups.forEach(function(semanticTypeGroup) {
    		semanticTypesGroupsByType[semanticTypeGroup.type] = semanticTypeGroup;
    	});
    });
	
	$scope.semanticTypesGroupsGridOptions = {
	     data: "semanticTypesGroups",
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
		$scope.selectedSemanticTypes = $scope.semanticTypesGroupsGridOptions.$gridScope.selectedItems;
	}, 0);
	
	$scope.unselectSemanticTypeGroup = function(semanticTypeGroup) {
		console.log("Unselect", semanticTypeGroup);
		$scope.semanticTypesGroups.forEach(function(semanticTypeGroup1, index) {
			if (semanticTypeGroup.type == semanticTypeGroup1.type) {
				$scope.semanticTypesGroupsGridOptions.selectItem(index, false);
			}
		});
	};
    
	/*****************/
    /* RETRIEVE DATA */
	/*****************/
	
	var blockRetrieveStopwords = $scope.block("Retriveve stopwords... ");
	$http.get(STOPWORDS_URL)
		.error(function(err) {
			var msg = "ERROR: Couldn't retrieve stopwords from " + STOPWORDS_URL;
			console.log(msg, err);
			alert(msg);
			$scope.unblock(blockRetrievePeregrineUrl, "ERROR");
		})
		.success(function(stopwords) {
			STOPWORDS = stopwords;
			$scope.unblock(blockRetrieveStopwords, "OK, found " + STOPWORDS.length);
		});

	var blockRetrievePeregrineUrl = $scope.block("Retrieve Peregrine URL... ");
	$http.get(CONFIG_URL)
		.error(function(err) {
			var msg = "ERROR: Couldn't retrieve peregrine URL";
			console.log(msg, err);
			alert(msg);
			$scope.unblock(blockRetrievePeregrineUrl, "ERROR");
		})
		.success(function (config) {
			$scope.peregrineResourceUrl = config.peregrineResourceUrl;
			console.log("Found config", config);
			$scope.unblock(blockRetrievePeregrineUrl, "OK");
	    });

	var blockSemanticTypesGroups = $scope.block("Retrieving semantic types and groups... ");
	$http.get(SEMANTIC_TYPES_GROUPS_URL)
		.error(function(err) {
			var msg = "ERROR: Couldn't load semantic types and groups";
			console.log(msg, err);
			alert(msg);
			$scope.unblock(blockSemanticTypesGroups, "ERROR");
		})
		.success(function(semanticTypesGroups) {
			$scope.semanticTypesGroups = semanticTypesGroups;
			$timeout(function() {
		        $scope.semanticTypesGroups.forEach(function(semanticType, index) {
		        	if (DEFAULT_SEMANTIC_TYPES.indexOf(semanticType.type) != -1) {
		                $scope.semanticTypesGroupsGridOptions.selectItem(index, true);
					}
		        });
			}, 0);
			$scope.unblock(blockSemanticTypesGroups, "OK, retrieved " + $scope.semanticTypesGroups.length);
		});

	var blockRetrieveCodingSystems = $scope.block("Retrieving vocabularies... ");
	$http.get(CODING_SYSTEMS_URL)
		.error(function(err) {
			var msg = "ERROR: Couldn't retrieve vocabularies";
			console.log(msg, err);
			alert(msg);
			$scope.unblock(blockRetrieveCodingSystems, "ERROR");
		})
		.success(function(vocabularies) {
			$scope.vocabularies = vocabularies
				.sort(function(v1, v2) {
					if (v1.abbreviation < v2.abbreviation) {
						return -1;
					}
					if (v1.abbreviation > v2.abbreviation) {
						return 1;
					}
					return 0;
				});
			$timeout(function() {
				$scope.vocabularies.forEach(function(voc, ix) {
					if (0 <= DEFAULT_CODING_SYSTEMS.indexOf(voc.abbreviation)) {
						$scope.vocabulariesGridOptions.selectItem(ix, true);
					}
				});
			}, 0);
			$scope.unblock(blockRetrieveCodingSystems, "OK, retrieved " + $scope.vocabularies.length);
		});

	/*************/
	/* FUNCTIONS */
	/*************/
	
	/** Index the case definition ($scope.caseDefinition) for concepts, retrieve information
	 * about those concepts and display.
	 */ 
	$scope.searchConcepts = function() {
		var blockSearchConcepts = $scope.block("Search concepts in case definition... ");
		$scope.concepts = [];
		$scope.config = {
			caseDefinition: $scope.caseDefinition,
			caseDefinitionName: $scope.caseDefinitionName,
			vocabularies: angular.copy($scope.selectedVocabularies),
			semanticTypes: angular.copy($scope.selectedSemanticTypes),
			history: []
		};
		$scope.conceptsColumnDefs = createConceptsColumnDefs(true, true, $scope.config.vocabularies);
		var data = {
			text : $scope.config.caseDefinition
		};
		console.log("Peregrine", $scope.peregrineResourceUrl);
		// Index case definition with peregrine
		$http.post($scope.peregrineResourceUrl + "/index", data, FORM_ENCODED_POST)
			.error(function(err) {
				var msg = "ERROR: Couldn't search concepts in case definition";
				console.log(msg, err);
				alert(msg);
				$scope.unblock(blockSearchConcepts, "ERROR");
			})
			.success(function(result) { 
				spans = result.spans.filter(function(span) {
					var isStopword = STOPWORDS.indexOf(span.text.toUpperCase()) != -1;
					var isFiltered = FILTER_SPANS_REGEX.test(span.text);
					if (isStopword || isFiltered) {
						console.log("Filter span", span.text, isStopword, isFiltered);
					}
					return !(isStopword || isFiltered);
				});
				$scope.unblock(blockSearchConcepts, "OK, found " + spans.length);
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
				var selectedVocabularyAbbreviations =
					$scope.config.vocabularies.map(function(voc) {
						return voc.abbreviation;
					});
				var blockLookupConcepts = $scope.block("Found " + cuis.length + " CUIs " +
						"(from " + spans.length + " spans) " +
						"looking up in vocabularies ...");
				var data = {
					cuis : cuis,
					vocabularies : selectedVocabularyAbbreviations
				};
				// Retrieve information with this application's API
				$http.post(UMLS_CONCEPTS_API_URL, data, FORM_ENCODED_POST)
					.error(function(err) {
						var msg = "ERROR: Couldn't lookup concepts";
						$scope.unblock(blockLookupConcepts, "ERROR");
						alert(msg, err);
					})
					.success(function(concepts) {
						concepts.forEach(function(concept) {
							concept.spans = spans.filter(function(span) {
								return cuiOfId(span.id) == concept.cui;
							});
						});
						var r = filterAndPatch(concepts, $scope.config, semanticTypesGroupsByType);
						r.droppedBySemanticType.forEach(function(concept) {
							console.log("Dropped", concept.cui, concept.preferredName, concept.semantic.types.join(", "));
						});
						// Display relevant concepts
						$scope.concepts = r.concepts;
						$scope.conceptsGridOptions.sortInfo = { field: ["sourceConceptsCount", "preferredName"], direction: "desc" };
//				        $scope.conceptsGridOptions.sortBy(function(c1, c2) {
//				        	return c2.sourceConcepts.length - c1.sourceConcepts.length;
//				        });
						// Record history
						$scope.historyStep("vocabularies", $scope.config.vocabularies.map(function(voc) { return voc.abbreviation; }));
						$scope.historyStep("semantic types", $scope.config.semanticTypes.map(function(t) { return t.type; }));
						$scope.historyStep("initially retrieved cuis", concepts.map(getCui));
						$scope.unblock(blockLookupConcepts, "OK, found " + concepts.length + ", filtered on semantic types to " + $scope.concepts.length);
					});
			});
	};
	
	/** Delete a concepts from $scope.concepts by its cui. */
	$scope.deleteConcept = function(cui) {
		var deleted = [];
		$scope.concepts = $scope.concepts
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
	
	/** Expand a given concept to its hypernyms or hyponyms, show selection dialog
	 * and integrate in the list of concepts ($scope.concepts). 
	 */
    $scope.expandRelated = function(hyponymsNotHypernyms, concept) {
    	var blockLookupExpand = $scope.block("Looking up " + (hyponymsNotHypernyms ? "hyponyms" : "hypernyms") + "... ");
    	
    	var selectedVocabularyAbbreviations = $scope.config.vocabularies
    		.map(function(voc) {
    			return voc.abbreviation;
    		});
    	var data = {
			cuis: [ concept.cui ],
			hyponymsNotHypernyms: hyponymsNotHypernyms,
			vocabularies: selectedVocabularyAbbreviations
		};
    	// Retrieve related concepts from the API
    	$http.post(RELATED_CONCEPTS_API_URL, data, FORM_ENCODED_POST)
    		.error(function(err) {
    			var msg = "ERROR: Couldn't lookup related concepts";
    			alert(msg);
    			console.log(msg, err);
    			$scope.unblock(blockLookupExpand, "ERROR")
    		})
    		.success(function(relatedConcepts0) {
    			if (relatedConcepts0.hasOwnProperty(concept.cui)) {
    				var r = filterAndPatch(relatedConcepts0[concept.cui], $scope.config, semanticTypesGroupsByType, $scope.concepts);
	    			var relatedConcepts = r.concepts;
					r.droppedBySemanticType.forEach(function(concept) {
						console.log("Dropped", concept.cui, concept.preferredName, concept.semantic.types.join(", "));
					});
		    			
	    			$scope.unblock(blockLookupExpand, "OK, found " + relatedConcepts0[concept.cui].length
	    					+ " filter to " + relatedConcepts.length);
	    	        var name = hyponymsNotHypernyms ? "hyponyms" : "hypernyms";
	    			// Display retrieved concepts in a dialog
	    	        var modalInstance = $modal.open({
	    	          templateUrl: 'ShowConcepts.html',
	    	          controller: 'ShowConceptsCtrl',
	    	          size: 'lg',
	    	          resolve: {
	    	        	vocabularies: function() { return $scope.config.vocabularies; },
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
	    					$scope.concepts.forEach(function(c, cIx) {
	    						if (c.cui == concept.cui) {
	    							conceptOffset = cIx;
	    						}
	    					});
	    					// Insert each related concept in list of concepts
	    					selectedRelated.forEach(function(related, ix) {
	    						$scope.concepts.splice(conceptOffset + ix + 1, 0, related);
	    					});
	    					$scope.historyStep("expand " + name + " of " + concept.cui, selectedRelated.map(getCui));
	    		        }, function () {
	    		        	console.log('Modal dismissed at: ' + new Date());
	    		        });
    			} else {
    				console.log("Related concepts not retrieved");
    				$scope.unblock(blockLookupExpand, "ERROR");
    			}
    		});        
    };

	$scope.downloadConcepts = function() {
		console.log("Download concepts");
		var selectedVocabularyAbbreviations = $scope.selectedVocabularies
			.map(function(voc) {
				return voc.abbreviation;
			});
		
		var data = [];
		
		[ [$scope.config.caseDefinitionName],
          ["Generated by ADVANCE Code Mapper"]
        ].forEach(function(row) { data.push(row); });
		
		[ [],
          ["History"],
          ["Step", "Arguments"]
        ].forEach(function(row) { data.push(row); });
		
		$scope.config.history.forEach(function(step) {
			data.push([step.name].concat(step.args));
		});
		
		[ [],
		  ["Concepts"],
		  ["Name", "CUI", "Vocabulary", "Code"]
        ].forEach(function(row) { data.push(row); });
		selectedVocabularyAbbreviations.forEach(function(vocabulary) {
			$scope.concepts.forEach(function(concept) {
				concept.codes[vocabulary].forEach(function(code) {
					data.push([concept.preferredName, concept.cui, vocabulary, code]);
				})
			});
		});
		
		[ [],
		  ["Case definition"]
		].forEach(function(row) { data.push(row); });
		$scope.config.caseDefinition.split("\n").forEach(function(line) {
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
		a.download = 'case_definition_' + $scope.config.caseDefinitionName + '.csv';
		document.body.appendChild(a);
		a.click();
	};
	
	$scope.showDroppedConcepts = function(concepts) {
		if (concepts.length > 0) {
	        var modalInstance = $modal.open({
  	          templateUrl: 'ShowConcepts.html',
  	          controller: 'ShowConceptsCtrl',
  	          size: 'lg',
  	          resolve: {
  	        	vocabularies: function() { return []; },//$scope.selectedVocabularies; },
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
    
    /***************/
    /* AUXILIARIES */
    /***************/

	$scope.trustDefinition = function(definition) {
		return $sce.trustAsHtml(definition);
	};
});

/** Filters the list of `concepts` and adapts the data for the application. */
function filterAndPatch(concepts, config, semanticTypesGroupsByType, currentConcepts) {
	
	var knownCuis = currentConcepts ? currentConcepts.map(getCui) : [];
	
    var selectedTypes = config.semanticTypes
		.map(function(t) {
			return t.type;
		});
    // Record concepts that are not yet available but filtered out due to its semantic type
    var droppedBySemanticType = [];
	var result = concepts
		// Filter out concepts that are already in available (in $scope.concepts)
    	.filter(function(concept) {
    		return knownCuis.indexOf(concept.cui) == -1;
    	})
    	// Patch: adapt concepts for application
    	.map(function(concept0) {
    		var concept = angular.copy(concept0);
    		// Add field `codes` that is a mapping from vocabularies to source concepts
    		concept.codes = {};
    		config.vocabularies.forEach(function(voc) {
    			concept.codes[voc.abbreviation] = concept.sourceConcepts
    				.filter(function(sourceConcept) {
    					return sourceConcept.vocabulary == voc.abbreviation;
    				})
    				.map(function(sourceConcept) {
    					return sourceConcept.id;
    				});
    		});
    		concept.sourceConceptsCount = concept.sourceConcepts.length; 
    		// Enrich information about semantic types by descriptions and groups.
            var types = concept.semanticTypes
                    .map(function(type) {
                            return semanticTypesGroupsByType[type].description;
                    })
                    .filter(function(v, ix, arr) {
                            return ix == arr.indexOf(v);
                    });
            var groups = concept.semanticTypes
                    .map(function(type) {
                            return semanticTypesGroupsByType[type].group;
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
						return selectedTypes.indexOf(type) != -1;
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
var ShowConceptsCtrl = CodeMapperApp.controller('ShowConceptsCtrl', function ($scope, $http, $modalInstance, $timeout, concepts, vocabularies, title, selectable) {
	
	$scope.concepts = concepts;
	$scope.title = title;
	$scope.selectable = selectable;
	
	$scope.conceptsGridOptions = {
		data: "concepts",
		rowHeight: 70,
	    filterOptions: { filterText: '' },
		showSelectionCheckbox: $scope.selectable,
		enableRowSelection: $scope.selectable,
		columnDefs: createConceptsColumnDefs(false, true, vocabularies)
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
});

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
function createConceptsColumnDefs(showCommands, showSpans, vocabularies) {
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
	var vocabulariesColumnDefs = 
		vocabularies.map(function(voc) {
	    	return {
	    		displayName: voc.abbreviation,
	    		field: "codes." + voc.abbreviation,
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
			showSpans ? [spansColumnDef] : [],
			mainColumnDefs,
			vocabulariesColumnDefs);
}

/** AngularJS sends data for HTTP POST JSON - this header is to encode it as FORM data. */
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