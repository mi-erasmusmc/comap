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

function LoginCtrl($scope, $rootScope, $location, $http, urls) {

    $scope.username = "";
    $scope.password = "";
    $rootScope.subtitle = "Login";
    
    $scope.login = function(username, password) {
        var data = {
            username: username,
            password: password
        };
        return $http.post(urls.login, data, FORM_ENCODED_POST)
            .then(function(result) {
                if (result.data.success) {
                    $rootScope.user = result.data.user;
                    var path;
                    if (angular.isString($rootScope.requestedLocationPath)) {
                        $location.path($rootScope.requestedLocationPath);
                        $rootScope.requestedLocationPath = null;
                    } else {
                        $location.path('/overview');
                    }
                } else {
                    $scope.error = result.data.error;
                }
            }, function(error) {
                $scope.error = "Error when logging in (" +  error.status + ", " + error.statusText + ")";
                console.log("Couldn't login", error);
            });
    };
}

function LoggedInCtrl($scope, $modal, $rootScope, $location, $http, urls) {
    
    $scope.logout = function() {
        return $http.post(urls.logout, {}, FORM_ENCODED_POST)
            .success(function() {
                $rootScope.user = null;
                $location.path('/login');
            });
    };
    
    $scope.$root.changePassword = function() {
    	changePassword($modal);
    };
}

function resolveUserOrNull($q, $http, $location, urls) {
    var deferred = $q.defer();
    $http.get(urls.user)
        .success(function(user) {
            if (user == "") {
                user = null;
            }
            deferred.resolve(user);
        });
    return deferred.promise;
}

function resolveUser($rootScope, $q, $http, $location, urls) {
    var deferred = $q.defer();
    resolveUserOrNull($q, $http, $location, urls)
        .then(function(user) {
            $rootScope.user = user;
            if (user != null) {
                deferred.resolve(user);
            } else {
                deferred.reject();
                $rootScope.requestedLocationPath = $location.path();
                $location.path('/login');
            }
        });
    return deferred.promise;
}
