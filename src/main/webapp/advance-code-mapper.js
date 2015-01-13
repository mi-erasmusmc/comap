
var PEREGRINE_API_URL = 'http://scapa:8080/UMLS2014AA_ADVANCE/rest/';
var SEARCH_CONCEPTS_URL = PEREGRINE_API_URL + 'index'
// var SEARCH_CONCEPTS_URL = "http://localhost:8080/AdvanceCodeMapper/mockup-data/search-concepts.json";

var CODE_MAPPER_API_URL = 'http://localhost:8080/AdvanceCodeMapper/resource/code-mapper/';
var CODING_SYSTEMS_URL = CODE_MAPPER_API_URL + 'coding-systems';
var UMLS_CONCEPTS_API_URL = CODE_MAPPER_API_URL + 'umls-concepts';

var DEFAULT_CODING_SYSTEMS = [ 'MSH', 'ICD10', 'ICPC', 'MDR', 'MEDLINEPLUS', 'RCD' ];

var codeMapperApp = angular.module('codeMapperApp', ['ui.bootstrap', 'smart-table', 'ngSanitize']);

codeMapperApp.controller('codeMapperCtrl', function ($scope, $http, $timeout, $sce) {
	
	$scope.vocabularies = [];
	$scope.caseDefinition = "fever";
	$scope.concepts = [];
	
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
	
	$scope.getSelectedVocabularies = function() {
		return $scope.vocabularies
			.filter(function(vocabulary) {
				return vocabulary.keep;
			})
			.map(function(vocabulary) {
				return vocabulary.abbreviation;
			});
	};
	
	$scope.block("Retrieve coding systems ...");
	$http
		.get(CODING_SYSTEMS_URL)
		.error(function(err) {
			alert("ERROR: Couldn't retrieve vocabularies", err);
		})
		.success(function(vocabularies) {
			$scope.vocabularies =
				vocabularies.map(function(codingSystem) {
					var abbreviation = codingSystem.abbreviation;
					var keep = 0 <= DEFAULT_CODING_SYSTEMS.indexOf(abbreviation);
					return {
						keep: keep,
						name: codingSystem.name,
						abbreviation: abbreviation
					};
				});
			$scope.unblock("Retrieved " + vocabularies.length + " coding systems");
		});
	
	$scope.searchConcepts = function() {
		var caseDefinition = this.caseDefinition;
		$scope.block("Search concepts in case definition ...");
		$http
			.get(SEARCH_CONCEPTS_URL, {
				params: {
				    text: caseDefinition
				}
			})
			.error(function(err) {
				alert("ERROR: Couldn't search concepts in case definition", err);
			})
			.success(function(result) {
				var cuis =
					result.spans
						.map(function(span) {
							var id = '' + span.id;
							return 'C' + Array(8 - id.length).join('0') + id 
						})
						.filter(function(cui, ix, cuis) {
							return cuis.indexOf(cui) == ix;
						});
				var vocabularies = $scope.getSelectedVocabularies();
				$scope.block("Found " + cuis.length + " CUIs, looking up in vocabularies ...");
				$http
					.get(UMLS_CONCEPTS_API_URL, {
						params: {
							cuis: cuis,
							vocabularies: vocabularies
						}
					})
					.error(function(err) {
						var msg = "ERROR: Couldn't lookup concepts";
						$scope.unblock(msg)
						alert(msg, err);
					})
					.success(function(concepts) {
						$scope.concepts = concepts;
						$timeout(function() {
							$('li#concepts-tab > a').click();
						});
						$scope.unblock("Found " + concepts.length + " concepts");
					});
			});
	}
	
	$scope.codesInVocabulary = function(concept, vocabularyAbbreviation) {
		var res = concept.sourceConcepts
			.filter(function(sourceConcept) {
				return sourceConcept.vocabulary == vocabularyAbbreviation;
			})
			.map(function(sourceConcept) {
				return sourceConcept.id;
			});
		return res;
	};
	
    $scope.trustDefinition = function(definition) {
        return $sce.trustAsHtml(definition);
    };
    
    $scope.expandConcepts = function(concept, hyponyms) {
    	var cuis = hyponyms.map(function(hyponym) {
    		return hyponym.cui;
    	});
    	$scope.block("Search " + hyponyms.length + " hyonyms ...");
		$http
			.get(UMLS_CONCEPTS_API_URL, {
				params: {
					cuis: cuis,
					vocabularies: $scope.getSelectedVocabularies()
				}
			})
			.error(function(err) {
				var msg = "ERROR: Couldn't lookup concepts " + cuis.join(", "); 
				alert(msg, err);
		    	$scope.unblock(msg);
			})
			.success(function(hyponyms) {
				var ix;
				$scope.concepts.forEach(function(c, cIx) {
					if (c.cui == concept.cui) {
						ix = cIx;
					}
				});
				hyponyms.forEach(function(hyponym, offset) {
					var currentCuis = $scope.concepts.map(function(c) { return c.cui; });
					if (currentCuis.indexOf(hyponym.cui) == -1) {
						$scope.concepts.splice(ix + offset + 1, 0, hyponym);
						concept.hyponyms =
							concept.hyponyms.filter(function(h) {
								return h.cui != hyponym.cui;
							});
					} else {
						console.log("Hyponym", hyponym, "already in available");
					}
				});
				$scope.unblock("Found " + hyponyms.length + " hyponyms");
			});
    };
    
    $scope.downloadConcepts = function() {
    	console.log("Download concepts");
    	var vocabularies = $scope.getSelectedVocabularies();
    	var title = "Case definition generated by ADVANCE Code Mapper";
    	var columns = [ "UMLS CUI", "Name", "Definition", "UMLS Hyponyms" ]
    			.concat(vocabularies);
    	var data = [];
    	$scope.concepts.forEach(function(concept) {
    		var sourceConcepts = {};
    		vocabularies.forEach(function(vocabulary) {
    			sourceConcepts[vocabulary] = $scope.codesInVocabulary(concept, vocabulary);
    		});
    		var hyponyms = concept.hyponyms.map(function(h) { return h.cui; });
    		for (var ix = 0;; ix += 1) {
    			var dataRow = ix == 0 ? [
		           concept.cui,
		           concept.preferredName,
		           concept.definition,
	           ] : [null, null, null]
    			var sourceConceptsRow = 
 		            [ hyponyms[ix] ]
		           		.concat(vocabularies.map(function(vocabulary) {
	    					return sourceConcepts[vocabulary][ix];
	    				}));
    			var row = [].concat(dataRow, sourceConceptsRow);
    			if (ix == 0 || sourceConceptsRow.filter(function(v) { return v != undefined; }).length > 0) {
    				data.push(row);
    			} else {
    				break;
    			} 
    		}
    	});
    	console.log(csvEncode(columns, data, title));
    	var file = new Blob([ csvEncode(columns, data, title) ], {
            type : 'attachment/csv'
        });
        var fileURL = URL.createObjectURL(file);
        var a         = document.createElement('a');
        a.href        = fileURL; 
        a.target      = '_blank';
        a.download    = 'case_definition.csv';
        document.body.appendChild(a);
        a.click();
    };
});

function csvEncode(columns, data, heading) {
	function escape(field) {
		if (field == null || field == undefined) {
			return "";
		} else {
			if (typeof field == 'string' && (field.indexOf('"') != -1 || field.indexOf(';') != -1)) {
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
	result += columns.map(escape).join('; ') + "\n";
	data.forEach(function(row) {
		result += row.map(escape).join('; ') + "\n";
	});
	return result;	
}
