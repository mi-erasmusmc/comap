
var codeMapperApp =
	angular.module("codeMapperApp", [ "ui.bootstrap", "ngSanitize", "ngGrid", "ngRoute", "blockUI" ])
		.config(function ConfigBlockUI(blockUIConfig) {
			blockUIConfig.message = 'Loading...';
			blockUIConfig.delay = 0;
		})
		.config(function($routeProvider) {
		  $routeProvider
		    .when('/', {
		    	templateUrl: 'partials/list-case-definitions.html',
		    	controller: 'ListCaseDefinitionsCtrl'
		    })
		    .when('/case-definition/:caseDefinitionName', {
		      templateUrl: 'partials/code-mapper.html',
		      controller: 'CodeMapperCtrl'
		    })
		    .otherwise({
		      redirectTo: '/'
		    });
		})
		.service("urls", UrlsService)
		.service("dataService", DataService)
		.directive("confirmClick", confirmClickDirective)
		.controller("ShowConceptsCtrl", ShowConceptsCtrl)
		.controller("CodingSystemsCtrl", CodingSystemsCtrl)
		.controller("SemanticTypesCtrl", SemanticTypesCtrl)
		.controller("CodeMapperCtrl", CodeMapperCtrl)
		.controller("ListCaseDefinitionsCtrl", ListCaseDefinitionsCtrl)
		;