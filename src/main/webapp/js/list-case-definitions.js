
function ListCaseDefinitionsCtrl($scope, $http, urls) {
	$scope.projects = [];
	$scope.caseDefinitions = {};
	$http.get(urls.projects)
		.error(function(err) {
			var msg = "Couldn't load projects from url " + urls.project;
			error(msg);
		})
		.success(function(projects) {
			$scope.projects = projects;
			projects.forEach(function(project) {
				var url = urls.projects + '/' + encodeURIComponent(project);
				$http.get(url)
					.error(function(err) {
						var msg = "Couldn't load case definitions for " + project + " from url " + url;
						error(msg);
					})
					.success(function(caseDefinitions) {
						$scope.caseDefinitions[project] = caseDefinitions;
					});
			});
		});
}