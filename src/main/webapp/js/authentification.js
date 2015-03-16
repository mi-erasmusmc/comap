
function LoginCtrl($scope, $rootScope, $location, $http, urls) {

	$scope.username = "user1";
	$scope.password = "user1";
	
	$scope.login = function(username, password) {
		var data = {
			username: username,
			password: password
		};
		return $http.post(urls.login, data, FORM_ENCODED_POST)
			.success(function(result) {
				if (result.success) {
					$rootScope.user = result.user;
					$rootScope.$broadcast('login', result.user);
					$location.path('/projects');
				} else {
					$scope.error = result.error;
				}
			});
	};
}

function LoggedInCtrl($scope, $rootScope, $location, $http, urls) {
	
	$scope.$on('logout', function() {
		$location.path('/login');
	});

	$scope.logout = function() {
		return $http.post(urls.logout, {}, FORM_ENCODED_POST)
			.success(function() {
				$rootScope.user = null;
				$rootScope.$broadcast('logout');
			});
	}
}

function resolveUser($rootScope, $q, $http, $location, urls) {
	if ($rootScope.user != null) {
		console.log("RESOLVE1", $rootScope.user);
		return $rootScope.user;
	} else {
		console.log("RESOLVE2");
		var deferred = $q.defer();
		$http.get(urls.user)
			.success(function(user) {
				console.log("RESOLVE3", user);
				if (user == "") {
					user = null;
					deferred.reject();
					$location.path('/login');
				} else {
					$rootScope.user = user;
					$rootScope.$broadcast('login', user);
					deferred.resolve(user);
				}
			})
			.error(function(err, code) {
				console.log("RESOLVE4", err, code);
				deferred.reject();
				$location.path('/login');
			});
		return deferred.promise;
	}
}