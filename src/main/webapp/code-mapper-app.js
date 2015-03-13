
//Must be declared in-line in index.jsp
if (!CASE_DEFINITION_NAME) {
	error("Case definition name unknown", CASE_DEFINITION_NAME);
}

if (!PEREGRINE_RESOURCE_URL) {
	error("Peregrine resource URL unknown", PEREGRINE_RESOURCE_URL);
}

var codeMapperApp =
	angular.module("codeMapperApp", [ "ui.bootstrap", "ngSanitize", "ngGrid", "blockUI" ])
		.config(function ConfigBlockUI(blockUIConfig) {
			blockUIConfig.message = 'Loading...';
			blockUIConfig.delay = 0;
		})
		.value("caseDefinitionName", CASE_DEFINITION_NAME)
		.value("peregrineResourceUrl", PEREGRINE_RESOURCE_URL)
		.service("urls", UrlsService)
		.service("dataService", DataService)
		.directive("confirmClick", confirmClickDirective)
		.controller("CodingSystemsCtrl", CodingSystemsCtrl)
		.controller("SemanticTypesCtrl", SemanticTypesCtrl)
		.controller("CodeMapperCtrl", CodeMapperCtrl)
		.controller("ShowConceptsCtrl", ShowConceptsCtrl);