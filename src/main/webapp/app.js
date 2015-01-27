
var CODE_MAPPER_API_URL = 'resource/code-mapper';
//var CODE_MAPPER_API_URL = 'mockup'
var CONFIG_URL =  CODE_MAPPER_API_URL + "/config";
var CODING_SYSTEMS_URL = CODE_MAPPER_API_URL + '/coding-systems';
var UMLS_CONCEPTS_API_URL = CODE_MAPPER_API_URL + '/umls-concepts';
var RELATED_CONCEPTS_API_URL = CODE_MAPPER_API_URL + '/related';
var SEMANTIC_TYPES_GROUPS_URL = "data/semantic_types_groups.json";

var DEFAULT_CODING_SYSTEMS = [ "RCD", "ICD10CM", "ICD9CM", "ICPC2P", "ICPC2EENG", "ICD10", "ICD10AE" ]; // 'MSH', 'ICD10', 'ICPC', 'MDR', 'MEDLINEPLUS', 'RCD'
var DEFAULT_SEMANTIC_TYPES = [ "T020", "T190", "T049", "T019", "T047", "T050", "T037", "T048", "T191", "T046", "T184" ]; // Exclude "Findings": T033

var STOPWORDS = ["single", "used", "mixed", "can", "1", "2", "3", "4", "5", "6", "7", "9", "0"];

// AngularJS sends data for HTTP POST JSON -- this header encodes it as form data.
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

function filterRelated(related, cuis) {
	return related
		.filter(function(r) {
			return cuis.indexOf(r.cui) == -1;
		})
		.sort(function(r1, r2) {
			if (r1.preferredName < r2.preferredName) {
				return -1;
			}
			if (r1.preferredName > r2.preferredName) {
				return 1;
			}
			return 0;
		});
}

var codeMapperApp = angular.module('codeMapperApp',
		[ 'ui.bootstrap', 'ngSanitize', 'ngGrid' ]);



codeMapperApp.directive('ngConfirmClick', [
    function(){
        return {
            link: function (scope, element, attr) {
                var msg = attr.ngConfirmClick || "Are you sure?";
                var clickAction = attr.confirmedClick;
                element.bind('click', function (event) {
                	console.log(scope.$eval(attr.ngReallyConfirm));
                    if (scope.$eval(attr.ngDontConfirm) || window.confirm(msg)) {
                        scope.$eval(clickAction)
                    }
                });
            }
        };
}])

function historyStep(name, args) {
	return {
		name: name,
		args: args
	};
}

codeMapperApp.controller('codeMapperCtrl', function($scope, $http, $timeout, $sce, $modal, $timeout) {
	
	$scope.vocabularies = [];
	$scope.caseDefinition = "deafness and fever and code";
	$scope.caseDefinitionName = "Test";
	$scope.concepts = [];
	$scope.selected = [];
    $scope.semanticTypesGroups = [];
    $scope.config = {}; // Configuration that was last used to generate $scope.concepts
    
    /*************************/
    /* BLOCKING AND MESSAGES */
    /*************************/

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
	
	/************/
	/* CONCEPTS */
	/************/
	
	var conceptsColumnDefsPrefix = [
	   { displayName: 'Commands',
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
	   },
	   { displayName: 'Spans',
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
	   }
	];
	$scope.conceptsColumnDefs = [].concat(conceptsColumnDefsPrefix, conceptsMainColumnDefs);
	$scope.conceptsGridOptions = {
		data: "concepts",
		rowHeight: 50,
		columnDefs: 'conceptsColumnDefs',
		enableRowSelection: false,
//		enableColumnResize: true, // Bugs: grid is not updated anymore when $scope.concepts changes
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
	
	$scope.unselectVocabulary = function(voc) {
		$scope.vocabularies.forEach(function(voc1, index) {
			if (voc.abbreviation == voc1.abbreviation) {
				$scope.vocabulariesGridOptions.selectItem(index, false);
			}
		});
	};
	
	$scope.selectedVocabularies = function() {
		return $scope.vocabulariesGridOptions.$gridScope.selectedItems;
	};
	
	/*****************************/
	/* SEMANTIC TYPES AND GROUPS */
	/*****************************/
	
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

	
	$scope.selectedSemanticTypes = function() {
		return $scope.semanticTypesGroupsGridOptions.$gridScope.selectedItems;
	};
	
	$scope.unselectSemanticTypeGroup = function(semanticTypeGroup) {
		console.log("Unselect", semanticTypeGroup);
		$scope.semanticTypesGroups.forEach(function(semanticTypeGroup1, index) {
			if (semanticTypeGroup.type == semanticTypeGroup1.type) {
				$scope.semanticTypesGroupsGridOptions.selectItem(index, false);
			}
		});
	};
    
    /************/
    /* GET DATA */
    /************/

	var blockRetrievePeregrineUrl = $scope.block("Retrieve Peregrine URL... ");
	$http.get(CONFIG_URL)
		.error(function(err) {
			var msg = "Couldn't retrieve peregrine URL";
			console.log(msg, err);
			alert(msg);
			$scope.unblock(blockRetrievePeregrineUrl, "ERROR");
		})
		.success(function (config) {
			$scope.peregrineResourceUrl = config.peregrineResourceUrl;
			console.log("Found config", config, $scope.peregrineResourceUrl);
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
			$scope.unblock(blockSemanticTypesGroups, "OK");
		});

	var blockRetrieveCodingSystems = $scope.block("Retrieving vocabularies... ");
	$http.get(CODING_SYSTEMS_URL)
		.error(function(err) {
			alert("ERROR: Couldn't retrieve vocabularies", err);
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
					var keep = 0 <= DEFAULT_CODING_SYSTEMS.indexOf(voc.abbreviation);
					if (keep) {
						$scope.vocabulariesGridOptions.selectItem(ix, true);
					}
				});
			}, 0);
			$scope.unblock(blockRetrieveCodingSystems, "OK, retrieved " + vocabularies.length);
		});

	/*************/
	/* FUNCTIONS */
	/*************/
	
	$scope.generateConcepts = function() {
		var blockSearchConcepts = $scope.block("Search concepts in case definition... ");
		$scope.concepts = [];
		$scope.config = {
			caseDefinition: $scope.caseDefinition,
			caseDefinitionName: $scope.caseDefinitionName,
			vocabularies: $scope.selectedVocabularies(),
			semanticTypes: $scope.selectedSemanticTypes(),
			history: []
		};
		var data = {
			text : $scope.config.caseDefinition
		};
		console.log("Peregrine", $scope.peregrineResourceUrl);
		$http.post($scope.peregrineResourceUrl + "/index", data, FORM_ENCODED_POST)
			.error(function(err) {
				var msg = "ERROR: Couldn't search concepts in case definition";
				console.log(msg, err);
				alert(msg);
				$scope.unblock(blockSearchConcepts, "ERROR");
			})
			.success(function(result) {
				spans = result.spans.filter(function(span) {
					return STOPWORDS.indexOf(span.text) == -1;
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
						$scope.conceptsColumnDefs = [].concat(
							conceptsColumnDefsPrefix, conceptsMainColumnDefs,
							conceptsSourceCodesColumnDefs($scope.selectedVocabularies()));
						$scope.concepts = filterAndPatch(concepts, $scope.config, $scope.semanticTypesGroups);
						[ historyStep("vocabularies", $scope.config.vocabularies.map(function(voc) { return voc.abbreviation; })),
						  historyStep("semantic types", $scope.config.semanticTypes.map(function(t) { return t.type; })),
						  historyStep("initial cuis", concepts.map(getCui)),
					    ].forEach(function(s) { $scope.config.history.push(s); });
						
						$timeout(function() {
							$('li#concepts-tab > a').click();
						});
						$scope.unblock(blockLookupConcepts, "OK, found " + concepts.length + ", filtered on semantic types to " + $scope.concepts.length);
					});
			});
	};
	
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
		$scope.config.history.push(historyStep("delete concept", [cui]));
		$scope.message("Deleted concepts " + deleted.join(", "));
	};

	$scope.trustDefinition = function(definition) {
		return $sce.trustAsHtml(definition);
	};

	$scope.downloadConcepts = function() {
		console.log("Download concepts");
		var selectedVocabularyAbbreviations = $scope.selectedVocabularies()
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
	
    $scope.expandRelated = function(hyponymsNotHypernyms, concept) {
    	var blockLookupExpand = $scope.block("Looking up " + (hyponymsNotHypernyms ? "hyponyms" : "hypernyms") + "... ");
    	
    	var selectedVocabularyAbbreviations = $scope.selectedVocabularies()
    		.map(function(voc) {
    			return voc.abbreviation;
    		});
    	var data = {
    			cuis: [ concept.cui ],
    			hyponymsNotHypernyms: hyponymsNotHypernyms,
    			vocabularies: selectedVocabularyAbbreviations
    		};
    	$http.post(RELATED_CONCEPTS_API_URL, data, FORM_ENCODED_POST)
    		.error(function(err) {
    			var msg = "ERROR: Couldn't lookup related concepts";
    			alert(msg);
    			console.log(msg, err);
    			$scope.unblock(blockLookupExpand, "ERROR")
    		})
    		.success(function(relatedConcepts0) {
    			if (relatedConcepts0.hasOwnProperty(concept.cui)) {
	    			var relatedConcepts = filterAndPatch(relatedConcepts0[concept.cui], $scope.config, $scope.semanticTypesGroups, $scope.concepts);
	    			
	    			$scope.unblock(blockLookupExpand, "OK, found " + relatedConcepts0[concept.cui].length
	    					+ " filter to " + relatedConcepts.length);
	    	        
	    	        var modalInstance = $modal.open({
	    	          templateUrl: 'expandRelatedConcepts.html',
	    	          controller: 'ExpandRelatedCtrl',
	    	          size: 'lg',
	    	          resolve: {
	    	        	hyponymsNotHypernyms: function() { return hyponymsNotHypernyms; },
	    	        	concept: function() { return concept; },
	    	        	selectedVocabularies: function() { return $scope.vocabulariesGridOptions.$gridScope.selectedItems; },
	    	        	relatedConcepts: function() { return relatedConcepts; }
	    	          }
	    	        });
	
	    	        modalInstance.result
	    		        .then(function (selectedRelated) {
	    					var conceptOffset;
	    					$scope.concepts.forEach(function(c, cIx) {
	    						if (c.cui == concept.cui) {
	    							conceptOffset = cIx;
	    						}
	    					});
	
	    					// Insert each related concept in list of concepts!
	    					selectedRelated.forEach(function(related, ix) {
	    						$scope.concepts.splice(conceptOffset + ix + 1, 0, related);
	    					});
	    					$scope.config.history.push(historyStep("expand concept", [concept.cui].concat(selectedRelated.map(getCui))));
	    		        }, function () {
	    		        	console.log('Modal dismissed at: ' + new Date());
	    		        });
    			} else {
    				console.log("Related concepts not retrieved");
    				$scope.unblock(blockLookupExpand, "ERROR");
    			}
    		});        
    };
});



function filterAndPatch(concepts, config, semanticTypesGroups, currentConcepts) {
	
	var knownCuis = currentConcepts ? currentConcepts.map(getCui) : [];
	
    var semanticTypesGroupsByType = {};
    semanticTypesGroups.forEach(function(semanticTypeGroup) {
    	semanticTypesGroupsByType[semanticTypeGroup.type] = semanticTypeGroup;
    });
    
    var selectedTypes = config.semanticTypes
		.map(function(t) {
			return t.type;
		});
	return concepts
    	.filter(function(concept) {
    		return knownCuis.indexOf(concept.cui) == -1
    			&& concept.semanticTypes
	    			.filter(function(type) {
	    				return selectedTypes.indexOf(type) != -1;
	    			})
	    			.length > 0;
    	})
    	.sort(function(c1, c2) {
    		return c2.sourceConcepts.length - c1.sourceConcepts.length;
    	})
    	.map(function(concept0) {
    		var concept = angular.copy(concept0);
    		// Set codes by vocabulary
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
    		// Set semantic types and groups
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
    	});
};

var conceptsMainColumnDefs = [
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

function conceptsSourceCodesColumnDefs(vocabularies) {
	return vocabularies.map(function(voc) {
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
}

codeMapperApp.controller('ExpandRelatedCtrl', function ($scope, $http, $modalInstance, $timeout, hyponymsNotHypernyms, concept, relatedConcepts, selectedVocabularies) {
	
	$scope.concept = concept;
	$scope.name = hyponymsNotHypernyms ? "hyponyms" : "hypernyms";
	$scope.relatedConcepts = relatedConcepts;
	
	$scope.relatedConceptsGridOptions = {
		data: "relatedConcepts",
		rowHeight: 75,
		showSelectionCheckbox: true,
		columnDefs: [].concat(conceptsMainColumnDefs, conceptsSourceCodesColumnDefs(selectedVocabularies))
	};
	
	$timeout(function() {
		$scope.relatedConcepts.forEach(function(related, index) {
			if (related.sourceConcepts.length > 0) {
				console.log("Pre-select", related.cui, index);
				$scope.relatedConceptsGridOptions.selectItem(index, true);
			}
		});
	}, 0);

	$scope.ok = function () {
		$modalInstance.close($scope.relatedConceptsGridOptions.$gridScope.selectedItems);
	};

	$scope.cancel = function () {
		$modalInstance.dismiss('cancel');
	};
});

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
//
//function csvEncode(columns, data, heading) {
//	var result = "";
//	if (heading) {
//		result += escape(heading) + "\n\n\n";
//	}
//	result += columns.map(escape).join(', ') + "\n";
//	data.forEach(function(row) {
//		result += row.map(escape).join(', ') + "\n";
//	});
//	return result;
//}
