
var CODE_MAPPER_API_URL = 'resource/code-mapper';
var CONFIG_URL =  CODE_MAPPER_API_URL + "/config";
var CODING_SYSTEMS_URL = CODE_MAPPER_API_URL + '/coding-systems';
var UMLS_CONCEPTS_API_URL = CODE_MAPPER_API_URL + '/umls-concepts';
var RELATED_CONCEPTS_API_URL = CODE_MAPPER_API_URL + '/related';
var SEMANTIC_TYPES_GROUPS_URL = "data/semantic_types_groups.json";

var DEFAULT_CODING_SYSTEMS = [ 'MSH', 'ICD10', 'ICPC', 'MDR', 'MEDLINEPLUS', 'RCD' ];

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

codeMapperApp.controller('codeMapperCtrl', function($scope, $http, $timeout, $sce, $modal, $timeout) {

	$scope.vocabularies = [];
	$scope.caseDefinition = "deafness and fever and code";
	$scope.concepts = [];
	$scope.selected = [];
    $scope.semanticTypesGroups = [];

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
		console.log($scope.messages);
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
	
	/* SEMANTIC TYPES AND GROUPS */
	
	$scope.semanticTypesGroupsGridOptions = {
	     data: "semanticTypesGroups",
	     rowHeight: 35,
	     selectedItems: [],
	     columnDefs: [
    		 { displayName: 'Type', field: 'type' },
    		 { displayName: 'Description', field: 'description' },
    		 { displayName: 'Group', field: 'group'},
		 ],
	 };
	
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
					if (semanticType.group == "DISO") {
		                $scope.semanticTypesGroupsGridOptions.selectItem(index, true);
					}
		        });
			}, 0);
			$scope.unblock(blockSemanticTypesGroups, "OK");
		});
	
	$scope.selectedSemanticTypesGroups = function() {
		if ($scope.semanticTypesGroupsGridOptions.$gridScope != undefined) {
			return $scope.semanticTypesGroupsGridOptions.$gridScope.selectedItems;
		} else {
			return [];
		}
	};
    
    $scope.replaceAndFilterBySemanticTypes = function(concepts) {
    	var semanticTypesGroups = {};
    	$scope.semanticTypesGroups.forEach(function(semanticTypeGroup) {
    		semanticTypesGroups[semanticTypeGroup.type] = semanticTypeGroup;
    	});
    	return concepts
    		.map(function(concept) {
    		   var result = angular.copy(concept);
               var typesGroups = concept.semanticTypes
                       .map(function(type) {
                               return semanticTypesGroups[type];
                       });
               var types = typesGroups
                       .map(function(typeGroup) {
                               return typeGroup.description;
                               })
                               .filter(function(v, ix, types) {
                                       return ix == types.indexOf(v);
                               });
               var groups = typesGroups
                               .map(function(typeGroup) {
                                       return typeGroup.group;
                               })
                               .filter(function(v, ix, types) {
                                       return ix == types.indexOf(v);
                               });
    			result.semantic = {
	    			types: types,
	    			groups: groups,
	    		};
    			return result;
    		})
    		.filter(function(concept) {
    			return concept.semanticTypes
    				.filter(function(type) {
    					return $scope.selectedSemanticTypesGroups()
    						.map(function(t) {
    							return t.type;
    						})
    						.indexOf(type) != -1;
    				})
    				.length > 0;
    		});
    };

	var blockRetrieveCodingSystems = $scope.block("Retrieving coding systems... ");
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
				})
				.map(function(vocabulary) {
					var abbreviation = vocabulary.abbreviation;
					var keep = 0 <= DEFAULT_CODING_SYSTEMS.indexOf(abbreviation);
					return {
						keep : keep,
						name : vocabulary.name,
						abbreviation : abbreviation
					};
				});
			$scope.unblock(blockRetrieveCodingSystems, "OK, retrieved " + vocabularies.length);
		});

	// Retrieve the URL of Peregrine
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

	$scope.getSelectedVocabularies = function() {
		return $scope.vocabularies
			.filter(function(vocabulary) {
				return vocabulary.keep;
			})
			.map(function(vocabulary) {
				return vocabulary.abbreviation;
			});
	};

	$scope.searchConcepts = function() {
		var caseDefinition = this.caseDefinition;
		var blockSearchConcepts = $scope.block("Search concepts in case definition... ");
		var data = {
			text : caseDefinition
		};
		$http.post($scope.peregrineResourceUrl + "/rest/index", data, FORM_ENCODED_POST)
			.error(function(err) {
				var msg = "ERROR: Couldn't search concepts in case definition";
				console.log(msg, err);
				alert(msg);
				$scope.unblock(blockLookupConcepts, "ERROR");
			})
			.success(function(result) {
				$scope.unblock(blockSearchConcepts, "OK, found " + result.spans.length);
				var cuis = [];
				function cuiOfId(id) {
					return 'C' + Array(8 - id.length).join('0') + id;
				}
				result.spans.forEach(function(span) {
					var cui = cuiOfId(span.id);
					if (cuis.indexOf(cui) == -1) {
						cuis.push(cui);
					}
				});
				var vocabularies = $scope.getSelectedVocabularies();
				var blockLookupConcepts = $scope.block("Found " + cuis.length + " CUIs " +
						"(from " + result.spans.length + " spans) " +
						"looking up in vocabularies ...");
				var data = {
					cuis : cuis,
					vocabularies : vocabularies
				};
				$http.post(UMLS_CONCEPTS_API_URL, data, FORM_ENCODED_POST)
					.error(function(err) {
						var msg = "ERROR: Couldn't lookup concepts";
						$scope.unblock(blockLookupConcepts, "ERROR");
						alert(msg, err);
					})
					.success(function(concepts) {
						concepts.forEach(function(concept) {
							concept.spans = result.spans
								.filter(function(span) {
									return cuiOfId(span.id) == concept.cui;
								});
						});
						$scope.concepts = $scope.replaceAndFilterBySemanticTypes(concepts);
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
		$scope.message("Deleted concepts " + deleted.join(", "));
	};

	$scope.codesInVocabulary = function(concept, vocabularyAbbreviation) {
		return concept.sourceConcepts
			.filter(function(sourceConcept) {
				return sourceConcept.vocabulary == vocabularyAbbreviation;
			})
			.map(function(sourceConcept) {
				return sourceConcept.id;
			});
	};

	$scope.trustDefinition = function(definition) {
		return $sce.trustAsHtml(definition);
	};

	$scope.downloadConcepts = function() {
		console.log("Download concepts");
		var vocabularies = $scope.getSelectedVocabularies();
		var title = "Case definition generated by ADVANCE Code Mapper";
		var columns = [].concat([ "CUI", "Name", "Definition" ], vocabularies);
		var data = [];
		$scope.concepts.forEach(function(concept) {
			var sourceConcepts = {};
			vocabularies.forEach(function(vocabulary) {
				sourceConcepts[vocabulary] = $scope.codesInVocabulary(concept,
						vocabulary);
			});
			for (var ix = 0;; ix += 1) {
				var keyRow = ix == 0
					? [ concept.cui, concept.preferredName, concept.definition ]
					: [ null, null, null ];
				var sourceConceptsRow = vocabularies.map(function(vocabulary) {
					return sourceConcepts[vocabulary][ix];
				});
				var anythingNew = sourceConceptsRow
					.filter(function(v) {
						return v != undefined;
					})
					.length > 0;
				if (ix == 0 || anythingNew) {
					var row = [].concat(keyRow, sourceConceptsRow);
					data.push(row);
				} else {
					break;
				}
			}
		});
		console.log(csvEncode(columns, data, title));
		var csv = csvEncode(columns, data, title);
		var file = new Blob([ csv ], {
			type : 'attachment/csv;charset=UTF-8'
		});
		var fileURL = URL.createObjectURL(file);
		var a = document.createElement('a');
		a.href = fileURL;
		a.target = '_blank';
		a.download = 'case_definition.csv';
		document.body.appendChild(a);
		a.click();
	};
	
    $scope.expandRelated = function(hyponymsNotHypernyms, concept) {
    	
    	var selectedVocabularyAbbreviations = $scope.vocabularies
    		.filter(function(voc) {
    			return voc.keep;
    		})
    		.map(function(voc) {
    			return voc.abbreviation;
    		});
    	
    	var blockLookupExpand = $scope.block("Looking up " + (hyponymsNotHypernyms ? "hyponyms" : "hypernyms"));
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
    		.success(function(relatedConcepts) {
    			var filteredRelatedConcepts = $scope.replaceAndFilterBySemanticTypes(relatedConcepts[concept.cui]); 
    			
    			$scope.unblock(blockLookupExpand, "OK, found " + relatedConcepts[concept.cui].length
    					+ " filter on semantic type to " + filteredRelatedConcepts.length);
    	        
    	        var modalInstance = $modal.open({
    	          templateUrl: 'expandRelatedConcepts.html',
    	          controller: 'ExpandRelatedCtrl',
    	          size: 'lg',
    	          resolve: {
    	        	hyponymsNotHypernyms: function() { return hyponymsNotHypernyms; },
    	        	concept: function() { return concept; },
    	        	selectedVocabularies: function() { return $scope.vocabularies.filter(function (voc) { return voc.keep; }); },
    	        	relatedConcepts: function() {
    	        		return filteredRelatedConcepts
	        				.map(function(concept) {
	        					return {
	        						keep: concept.sourceConcepts.length > 0,
	        						concept: concept
	        					};
	        				});
	        		},
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
    		        }, function () {
    		        	console.log('Modal dismissed at: ' + new Date());
    		        });
    		});        
    };
});

codeMapperApp.controller('ExpandRelatedCtrl', function ($scope, $http, $modalInstance, hyponymsNotHypernyms, concept, relatedConcepts, selectedVocabularies) {
	
	$scope.concept = concept;
	$scope.name = hyponymsNotHypernyms ? "hyponyms" : "hypernyms";
	$scope.relatedConcepts = relatedConcepts;
	$scope.selectedVocabularies = selectedVocabularies;

	$scope.ok = function () {
		var selectedRelated = $scope.relatedConcepts
			.filter(function(r) {
				return r.keep;
			})
			.map(function(r) {
				return r.concept;
			});
		$modalInstance.close(selectedRelated);
	};

	$scope.cancel = function () {
		$modalInstance.dismiss('cancel');
	};

	$scope.codesInVocabulary = function(concept, vocabularyAbbreviation) {
		return concept.sourceConcepts
			.filter(function(sourceConcept) {
				return sourceConcept.vocabulary == vocabularyAbbreviation;
			})
			.map(function(sourceConcept) {
				return sourceConcept.id;
			});
	};
});

function csvEncode(columns, data, heading) {
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
	if (heading) {
		result += escape(heading) + "\n\n\n";
	}
	result += columns.map(escape).join(', ') + "\n";
	data.forEach(function(row) {
		result += row.map(escape).join(', ') + "\n";
	});
	return result;
}
