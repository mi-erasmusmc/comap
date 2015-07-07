
var codeMapperApp =
    angular.module("CodeMapperApp", [ "ui.bootstrap", "ngSanitize", "ngGrid", "ngRoute", "blockUI" ])
    	.factory('config', function() {
    		return {
    			commentsReloadInterval: 5000
    		};
    	})
        .config(function ConfigBlockUI(blockUIConfig) {
            blockUIConfig.message = 'Loading...';
            blockUIConfig.delay = 0;
            blockUIConfig.autoBlock = true;
            blockUIConfig.requestFilter = function(config) {
                if (config.url.match(/autocomplete/)) {
                    return false;
                }
            };
        })
        .config(function($routeProvider) {
          $routeProvider
            .when('/projects', {
                templateUrl: 'partials/list-case-definitions.html',
                controller: 'ListCaseDefinitionsCtrl',
                resolve: {
                    user: resolveUser
                }
            })
            .when('/case-definition/:project/:caseDefinitionName', {
                templateUrl: 'partials/code-mapper.html',
                controller: 'CodeMapperCtrl',
                resolve: {
                    user: resolveUser
                }
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
        .directive("conceptInCaseDef", ConceptInCaseDefDirective)
        .filter('encodeUriComponent', function() {
          return window.encodeURIComponent;
        })
        .filter('historyDatumToString', function() {
            return historyDatumToString;
        })
        .filter('showConcept', function() {
            return showConcept;
        })
        .filter('showConcepts', function() {
            return showConcepts;
        })
        .controller("ShowConceptsCtrl", ShowConceptsCtrl)
        .controller("CodingSystemsCtrl", CodingSystemsCtrl)
        .controller("SemanticTypesCtrl", SemanticTypesCtrl)
        .controller("CodeMapperCtrl", CodeMapperCtrl)
        .controller("ListCaseDefinitionsCtrl", ListCaseDefinitionsCtrl)
        .controller("LoginCtrl", LoginCtrl)
        .controller("LoggedInCtrl", LoggedInCtrl)
        ;