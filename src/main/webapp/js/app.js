
var resolveAuthenticated = { user: resolveUser };

var codeMapperApp =
	angular.module("CodeMapperApp", [ "ui.bootstrap", "ngSanitize", "ngGrid", "ngRoute", "blockUI" ])
		.config(function ConfigBlockUI(blockUIConfig) {
			blockUIConfig.message = 'Loading...';
			blockUIConfig.delay = 0;
		})
		.config(function($routeProvider) {
		  $routeProvider
		    .when('/projects', {
		    	templateUrl: 'partials/list-case-definitions.html',
		    	controller: 'ListCaseDefinitionsCtrl',
		    	resolve: resolveAuthenticated
		    })
		    .when('/projects/:project/:caseDefinitionName', {
		    	templateUrl: 'partials/code-mapper.html',
		    	controller: 'CodeMapperCtrl',
		    	resolve: resolveAuthenticated
		    })
		    .when('/login', {
		    	templateUrl: 'partials/login.html',
		    	controller: 'LoginCtrl'
		    })
		    .otherwise({
		    	redirectTo: '/projects'
		    });
		})
		.service("urls", UrlsService)
		.service("dataService", DataService)
		.directive("confirmClick", confirmClickDirective)
		.filter('encodeUriComponent', function() {
		  return window.encodeURIComponent;
		})
		.controller("ShowConceptsCtrl", ShowConceptsCtrl)
		.controller("CodingSystemsCtrl", CodingSystemsCtrl)
		.controller("SemanticTypesCtrl", SemanticTypesCtrl)
		.controller("CodeMapperCtrl", CodeMapperCtrl)
		.controller("ListCaseDefinitionsCtrl", ListCaseDefinitionsCtrl)
		.controller("LoginCtrl", LoginCtrl)
		.controller("LoggedInCtrl", LoggedInCtrl)
		;