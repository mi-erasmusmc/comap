
var codeMapperApp =
    angular.module("CodeMapperApp", [ "ui.bootstrap", "ngSanitize", "ngGrid", "ngRoute", "blockUI" ])
        .config(function ConfigBlockUI(blockUIConfig) {
            blockUIConfig.message = 'Loading...';
            blockUIConfig.delay = 0;
            blockUIConfig.autoBlock = false;
        })
        .config(function($routeProvider) {
          $routeProvider
            .when('/dashboard', {
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
                redirectTo: '/dashboard'
            });
        })
        .service("urls", UrlsService)
        .service("dataService", DataService)
        .directive("confirmClick", confirmClickDirective)
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