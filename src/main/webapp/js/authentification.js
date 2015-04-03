
function LoginCtrl($scope, $rootScope, $location, $http, urls) {

	$scope.username = "";
	$scope.password = "";
	$scope.$rootScope.subtitle = "Login";
	
	$scope.login = function(username, password) {
		var data = {
			username: username,
			password: password
		};
		return $http.post(urls.login, data, FORM_ENCODED_POST)
			.success(function(result) {
				if (result.success) {
					$rootScope.user = result.user;
					$location.path('/dashboard');
				} else {
					$scope.error = result.error;
				}
			});
	};
}

function LoggedInCtrl($scope, $rootScope, $location, $http, urls) {
	
	$scope.logout = function() {
		return $http.post(urls.logout, {}, FORM_ENCODED_POST)
			.success(function() {
				$rootScope.user = null;
				$location.path('/login');
			});
	}
}

function resolveUserOrNull($q, $http, $location, urls) {
	var deferred = $q.defer();
	$http.get(urls.user)
		.success(function(user) {
			if (user == "") {
				user = null;
			}
			deferred.resolve(user);
		})
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
				$location.path('/login');
			}
		});
	return deferred.promise;
}