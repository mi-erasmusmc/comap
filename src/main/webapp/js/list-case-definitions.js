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

function ListCaseDefinitionsCtrl($scope, $rootScope, $http, $location, urls, user) {

    $scope.user = user;
    $scope.projects = [];
    $scope.caseDefinitions = {};
    $scope.rolesInProjects = {};
    $scope.usersInProjects = {};
    $scope.newNames = {};
    $rootScope.subtitle = "Overview";

    $http.get(urls.projectPermissions)
        .error(function(err) {
            var msg = "Couldn't load projects from url " + urls.projects;
            error(msg);
        })
        .success(function(projectPermissions) {
            angular.forEach(projectPermissions, function(perms, project) {
            	$scope.projects.push(project);
            	$scope.rolesInProjects[project] = perms;
            });
            $scope.projects.forEach(function(project) {
                $scope.newNames[project] = "";
                $http.get(urls.caseDefinitions(project))
                    .error(function(err) {
                        var msg = "Couldn't load case definitions for " + project;
                        error(msg);
                    })
                    .success(function(caseDefinitions) {
                        $scope.caseDefinitions[project] = caseDefinitions;
                    });
                $http.get(urls.usersForProject(project))
                    .error(function(err) {
                        var msg = "Couldn't load users for project " + project;
                        error(msg);
                    })
                    .success(function(perms) {
                        $scope.usersInProjects[project] = perms;
                    });
            });
            maybeAdvanceIframeResize();
        });
    
    var projectNameRegex = /^[\w\d _()-]+$/;
    $scope.validNewName = function(project, name) {
        return name.length > 0 && 
            $scope.caseDefinitions[project].indexOf(name) == -1 &&
            name.indexOf('/') == -1;
    }
    
    $scope.create = function(project, name) {
        $location.path('/case-definition/' + encodeURIComponent(project) + '/' + encodeURIComponent(name));
    }
    
    $scope.canCreateCaseDefinition = function(project) {
    	return $scope.rolesInProjects[project].indexOf("Editor") != -1;
    }
}
