/*******************************************************************************
 * Copyright 2017 Erasmus Medical Center, Department of Medical Informatics.
 * 
 * This program shall be referenced as “Codemapper”.
 * 
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU Affero General Public License as published
 * by the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 * 
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU Affero General Public License for more details.
 * 
 * You should have received a copy of the GNU Affero General Public License
 * along with this program. If not, see <http://www.gnu.org/licenses/>.
 ******************************************************************************/

var codeMapperApp =
    angular.module("CodeMapperApp", [ "ui.bootstrap", "ngSanitize", "ngGrid", "ngRoute", "blockUI" ])
		.run(function($rootScope) {
		    $rootScope.globals = globals;
		})
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
                if (config.method == "GET" && config.url.match(/\/comments$/)) {
                    return false;
                }
                return undefined;
            };
        })
        .config(function($routeProvider) {
          $routeProvider
            .when('/overview', {
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
                redirectTo: '/overview'
            });
        })
        .service("urls", UrlsService)
        .service("dataService", DataService)
        .directive("confirmClick", confirmClickDirective)
        .directive("conceptInCaseDef", ConceptInCaseDefDirective)
        .directive('autoFocus', function($timeout) {
            return {
                restrict: 'AC',
                link: function(_scope, _element) {
                    $timeout(function(){
                        _element[0].focus();
                    }, 0);
                }
            };
        })
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
        .filter('isUndefined', function() {
        	return angular.isUndefined;
        })
        .filter('isArray', function() {
        	return angular.isArray;
        })
        .filter('reverse', function() {
        	return function(array) {
        		return array.slice().reverse();
        	};
        })
        .filter('origin', function() {
            return getOrigin;
        })
        .controller("ShowConceptsCtrl", ShowConceptsCtrl)
        .controller("SelectCodingSystemsCtrl", SelectCodingSystemsCtrl)
        .controller("CodeMapperCtrl", CodeMapperCtrl)
        .controller("ListCaseDefinitionsCtrl", ListCaseDefinitionsCtrl)
        .controller("LoginCtrl", LoginCtrl)
        .controller("LoggedInCtrl", LoggedInCtrl)
        ;
