
function ListCaseDefinitionsCtrl($scope, $http, $location, urls, userService) {
	
	$scope.projects = [];
	$scope.caseDefinitions = {};
	
	$http.get(urls.projects)
		.error(function(err) {
			var msg = "Couldn't load projects from url " + urls.projects;
			error(msg);
		})
		.success(function(projects) {
			$scope.projects = projects;
			projects.forEach(function(project) {
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
}