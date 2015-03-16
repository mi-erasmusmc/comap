
function UserService($rootScope, $http, $location, urls) {
	
	var service = this;
	$rootScope.user = null;
	
	this.userPromise = $http.get(urls.user)
		.success(function(user) {
			if (user == "") {
				user = null;
			}
			$rootScope.user = user;
			$rootScope.$broadcast('login', user);
		});
	
	this.login = function(username, password, onError) {
		var data = {
			username: username,
			password: password
		};
		return $http.post(urls.login, data, FORM_ENCODED_POST)
			.success(function(result) {
				if (result.success) {
					var user = result.user;
					$rootScope.user = user;
					$rootScope.$broadcast('login', user);
				} else {
					onError(result.error);
				}
			});
	};
	
	this.logout = function(onSuccess) {
		return $http.post(urls.logout, {}, FORM_ENCODED_POST)
			.success(function() {
				$rootScope.user = null;
				$rootScope.$broadcast('logout');
			});
	}
	

	$rootScope.$on('$routeChangeStart', function (event, next, current) {
		service.userPromise.then(function() {
			if (next.restricted && $rootScope.user == null) {
				$location.path('/login');
			}
		});
	});
}

function LoginCtrl($scope, $location, urls, userService) {

	$scope.username = "user1";
	$scope.password = "user1";
	
	$scope.$on('login', function(user) {
		$location.path('/projects');
	});
	
	$scope.login = function(username, password) {
		var onError = function(error) { $scope.error = error; };
		userService.login(username, password, onError);
	}
}

function LoggedInCtrl($scope, $location, userService) {
	
	$scope.$on('logout', function() {
		$location.path('/login');
	});
	
	$scope.logout = function() {
		console.log("USER", typeof $scope.user, $scope.user);
		userService.logout()
	}
}
