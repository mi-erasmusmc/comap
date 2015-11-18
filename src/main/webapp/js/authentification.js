
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
                        $location.path('/projects');
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
    
    $scope.changePassword = function() {
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
