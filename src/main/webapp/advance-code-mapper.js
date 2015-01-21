
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

var codeMapperApp = angular.module('codeMapperApp', [ 'ui.bootstrap', 'smart-table', 'ngSanitize' ]);

codeMapperApp.controller('codeMapperCtrl', function($scope, $http, $timeout, $sce, $modal) {

	$scope.vocabularies = [];
	$scope.caseDefinition = "deafness and fever and code";
	$scope.concepts = [];
	$scope.semanticTypesGroups = null;

	$scope.message = "";
	$scope.isBlocked = false;
	$scope.block = function(message) {
		console.log("Block", message);
		$('#mask').height($(document).height());
		$scope.isBlocked = true;
		$scope.message = message;
	};
	$scope.unblock = function(message) {
		console.log("Unblock", message);
		$scope.message = message;
		$scope.isBlocked = false;
	};
	
	$scope.block("Retrieving coding systems ...");
	$http.get(SEMANTIC_TYPES_GROUPS_URL)
		.error(function(err) {
			var msg = "ERROR: Couldn't retrieve semantic types and groups";
			console.log(msg);
			alert(msg);
		})
		.success(function(semanticTypesGroups) {
			$scope.semanticTypesGroups = semanticTypesGroups;
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

	$scope.block("Retrieving coding systems ...");
	$http.get(CODING_SYSTEMS_URL)
		.error(function(err) {
			alert("ERROR: Couldn't retrieve vocabularies", err);
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
			$scope.unblock("Retrieved " + vocabularies.length + " coding systems");
		});

	// Retrieve the URL of Peregrine
	$http
		.get(CONFIG_URL)
		.success(function (config) {
			$scope.peregrineResourceUrl = config.peregrineResourceUrl;
			console.log("Found config", config, $scope.peregrineResourceUrl);
	    })
	    .error(function() {
	    	alert("Couldn't retrieve peregrine URL");
	    });

	$scope.searchConcepts = function() {
		var caseDefinition = this.caseDefinition;
		$scope.block("Search concepts in case definition ...");
		var data = {
			text : caseDefinition
		};
		$http.post($scope.peregrineResourceUrl + "/rest/index", data, FORM_ENCODED_POST)
			.error(function(err) {
				alert("ERROR: Couldn't search concepts in case definition", err);
			})
			.success(function(result) {
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
				$scope.block("Found " + cuis.length + " CUIs " +
						"(from " + result.spans.length + " spans " +
						"with " + cuis.length + " different CUIs) " +
						"looking up in vocabularies ...");
				var data = {
					cuis : cuis,
					vocabularies : vocabularies
				};
				$http.post(UMLS_CONCEPTS_API_URL, data, FORM_ENCODED_POST)
					.error(function(err) {
						var msg = "ERROR: Couldn't lookup concepts";
						$scope.unblock(msg)
						alert(msg, err);
					})
					.success(function(concepts) {
						concepts.forEach(function(concept) {
							concept.spans = result.spans
								.filter(function(span) {
									return cuiOfId(span.id) == concept.cui;
								});
						});
						$scope.replaceSemanticTypes(concepts);
						$scope.concepts = concepts;
						$timeout(function() {
							$('li#concepts-tab > a').click();
						});
						$scope.unblock("Found " + concepts.length
								+ " concepts");
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
		$scope.unblock("Deleted concepts " + deleted.join(", "));
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
    	
    	$scope.block("Looking up " + (hyponymsNotHypernyms ? "hyponyms" : "hypernyms"));
    	var data = {
    			cuis: [ concept.cui ],
    			hyponymsNotHypernyms: hyponymsNotHypernyms,
    			vocabularies: selectedVocabularyAbbreviations
    		};
    	$http.post(RELATED_CONCEPTS_API_URL, data, FORM_ENCODED_POST)
    		.error(function(err) {
    			var msg = "ERROR: Couldn't lookup related concepts";
    			alert(msg, err);
    			$scope.unblock(msg)
    		})
    		.success(function(relatedConcepts) {
    			$scope.unblock("Received related ", relatedConcepts);
    	        
    	        var modalInstance = $modal.open({
    	          templateUrl: 'expandRelatedConcepts.html',
    	          controller: 'ExpandRelatedCtrl',
    	          size: 'lg',
    	          resolve: {
    	        	hyponymsNotHypernyms: function() { return hyponymsNotHypernyms; },
    	        	concept: function() { return concept; },
    	        	selectedVocabularies: function() { return $scope.vocabularies.filter(function (voc) { return voc.keep; }); },
    	        	relatedConcepts: function() {
    	        		relatedConcepts = relatedConcepts[concept.cui];
    	        		$scope.replaceSemanticTypes(relatedConcepts);
    	        		return relatedConcepts
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
    $scope.replaceSemanticTypes = function(concepts) {
    	concepts.forEach(function(concept) {
    		var typesGroups = concept.semanticTypes
	    		.map(function(type) {
	    			return $scope.semanticTypesGroups[type];
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
    		concept.semantic = {
    			types: types,
    			groups: groups,
    		};
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
