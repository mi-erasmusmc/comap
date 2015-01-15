var PEREGRINE_API_URL = 'http://scapa:8080/UMLS2014AA_ADVANCE/rest/';
var SEARCH_CONCEPTS_URL = PEREGRINE_API_URL + 'index'
// var SEARCH_CONCEPTS_URL = "mockup-data/search-concepts.json";

var CODE_MAPPER_API_URL = 'resource/code-mapper/';
var CODING_SYSTEMS_URL = CODE_MAPPER_API_URL + 'coding-systems';
var UMLS_CONCEPTS_API_URL = CODE_MAPPER_API_URL + 'umls-concepts';

var DEFAULT_CODING_SYSTEMS = [ 'MSH', 'ICD10', 'ICPC', 'MDR', 'MEDLINEPLUS',
		'RCD' ];

// AngularJS sends data for HTTP POST JSON -- this header encodes it as form
// data.
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

var codeMapperApp = angular.module('codeMapperApp', [ 'ui.bootstrap',
		'smart-table', 'ngSanitize' ]);

codeMapperApp.controller('codeMapperCtrl', function($scope, $http, $timeout,
		$sce) {

	$scope.vocabularies = [];
	$scope.caseDefinition = "deafness";
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
		return $scope.vocabularies.filter(function(vocabulary) {
			return vocabulary.keep;
		}).map(function(vocabulary) {
			return vocabulary.abbreviation;
		});
	};

	$scope.block("Retrieving coding systems ...");
	$http.get(CODING_SYSTEMS_URL).error(function(err) {
		alert("ERROR: Couldn't retrieve vocabularies", err);
	}).success(function(vocabularies) {
		$scope.vocabularies = vocabularies.sort(function(v1, v2) {
			if (v1.abbreviation < v2.abbreviation) {
				return -1;
			}
			if (v1.abbreviation > v2.abbreviation) {
				return 1;
			}
			return 0;
		}).map(function(vocabulary) {
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

	$scope.searchConcepts = function() {
		var caseDefinition = this.caseDefinition;
		$scope.block("Search concepts in case definition ...");
		$http.post(SEARCH_CONCEPTS_URL, {
			text : caseDefinition
		}, FORM_ENCODED_POST).error(function(err) {
			alert("ERROR: Couldn't search concepts in case definition", err);
		}).success(
				function(result) {
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
					$http.post(UMLS_CONCEPTS_API_URL, {
						cuis : cuis,
						vocabularies : vocabularies
					}, FORM_ENCODED_POST).error(function(err) {
						var msg = "ERROR: Couldn't lookup concepts";
						$scope.unblock(msg)
						alert(msg, err);
					}).success(
							function(concepts) {
								concepts.forEach(function(concept) {
									concept.spans = result.spans
										.filter(function(span) {
											return cuiOfId(span.id) == concept.cui;
										})
									filterRelated(concept, cuis);
								});
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
		var res = concept.sourceConcepts.filter(function(sourceConcept) {
			return sourceConcept.vocabulary == vocabularyAbbreviation;
		}).map(function(sourceConcept) {
			return sourceConcept.id;
		});
		return res;
	};

	$scope.trustDefinition = function(definition) {
		return $sce.trustAsHtml(definition);
	};

	$scope.expandConcepts = function(concept, preRelated) {
		var preRelatedCuis = preRelated.map(getCui);
		$scope.block("Search " + preRelated.length + " hyonyms ...");
		var data = {
			cuis : preRelatedCuis,
			vocabularies : $scope.getSelectedVocabularies()
		};
		$http.post(UMLS_CONCEPTS_API_URL, data, FORM_ENCODED_POST)
			.error(function(err) {
				var msg = "ERROR: Couldn't lookup concepts "
						+ preRelatedCuis.join(", ");
				alert(msg, err);
				$scope.unblock(msg);
			})
			.success(function(relateds) {
				var conceptOffset;
				$scope.concepts.forEach(function(c, cIx) {
					if (c.cui == concept.cui) {
						conceptOffset = cIx;
					}
				});

				// Insert each hyponym in list of concepts!
				relateds.forEach(function(hyponym, ix) {
					$scope.concepts.splice(conceptOffset + ix + 1, 0,
							hyponym);
				});

				// Drop prerelateds from all concepts
				$scope.concepts.forEach(function(concept) {
					filterRelated(concept, preRelatedCuis);
				});

				// Identify relateds that were not found
				var relatedCuis = relateds.map(getCui);
				var noExpansion = preRelatedCuis
					.filter(function(preRelatedCui) {
						return relatedCuis.indexOf(preRelatedCui) == -1;
					});
				var msg = "Found " + relateds.length + " relateds";
				if (noExpansion.length > 0)
					msg += ", no expansion for " + noExpansion.join(", ")
							+ " in selected vocabularies";
				$scope.unblock(msg);
			});
	};

	$scope.downloadConcepts = function() {
		console.log("Download concepts");
		var vocabularies = $scope.getSelectedVocabularies();
		var title = "Case definition generated by ADVANCE Code Mapper";
		var columns = [ "CUI", "Name", "Definition", "Hypernyms", "Hyponyms" ]
				.concat(vocabularies);
		var data = [];
		$scope.concepts.forEach(function(concept) {
			var sourceConcepts = {};
			vocabularies.forEach(function(vocabulary) {
				sourceConcepts[vocabulary] = $scope.codesInVocabulary(concept,
						vocabulary);
			});
			var hypernyms = concept.hypernyms.map(getCui);
			var hyponyms = concept.hyponyms.map(getCui);
			for (var ix = 0;; ix += 1) {
				var dataRow = ix == 0 ? [ concept.cui, concept.preferredName,
						concept.definition, ] : [ null, null, null ]
				var relatedRow = [ hypernyms[ix], hyponyms[ix] ];
				var sourceConceptsRow = vocabularies.map(function(vocabulary) {
					return sourceConcepts[vocabulary][ix];
				});
				var anythingNew = []
					.concat(relatedRow, sourceConceptsRow)
					.filter(function(v) {
						return v != undefined;
					})
					.length > 0
				if (ix == 0 || anythingNew) {
					var row = [].concat(dataRow, relatedRow, sourceConceptsRow);
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
});

function getCui(concept) {
	return concept.cui;
}

function filterRelated(concept, cuis) {
	concept.hyponyms = concept.hyponyms
		.filter(function(h) {
			return cuis.indexOf(h.cui) == -1;
		})
		.sort(function(c1, c2) {
			if (c1.preferredName < c2.preferredName) {
				return -1;
			}
			if (c1.preferredName > c2.preferredName) {
				return 1;
			}
			return 0;
		});
	concept.hypernyms = concept.hypernyms
		.filter(function(h) {
			return cuis.indexOf(h.cui) == -1;
		})
		.sort(function(c1, c2) {
			if (c1.preferredName < c2.preferredName) {
				return -1;
			}
			if (c1.preferredName > c2.preferredName) {
				return 1;
			}
			return 0;
		});
}

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
