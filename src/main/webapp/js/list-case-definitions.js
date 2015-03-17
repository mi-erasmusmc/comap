
function ListCaseDefinitionsCtrl($scope, $http, $location, urls, user) {
	
	$scope.user = user;
	$scope.projects = [];
	$scope.caseDefinitions = {};
	$scope.newNames = {};
	
	$http.get(urls.projects)
		.error(function(err) {
			var msg = "Couldn't load projects from url " + urls.projects;
			error(msg);
		})
		.success(function(projects) {
			$scope.projects = projects;
			projects.forEach(function(project) {
				$scope.newNames[project] = "";
				$http.get(urls.caseDefinitions(project))
					.error(function(err) {
						var msg = "Couldn't load case definitions for " + project;
						error(msg);
					})
					.success(function(caseDefinitions) {
						$scope.caseDefinitions[project] = caseDefinitions;
					});
			});
		});
	
	$scope.validNewName = function(project, name) {
		console.log(project, name);
		return name.length > 0 && $scope.caseDefinitions[project].indexOf(name) == -1;
	}
	
	$scope.create = function(project, name) {
		console.log("CREATE", project, name);
		$location.path('/case-definition/' + encodeURIComponent(project) + '/' + encodeURIComponent(name));
	}
}