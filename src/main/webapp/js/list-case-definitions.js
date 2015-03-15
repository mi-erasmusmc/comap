
function ListCaseDefinitionsCtrl($scope, $http, urls) {
	$scope.caseDefinitions = [];
	$http.get(urls.caseDefinition)
		.error(function(err) {
			
		})
		.success(function(caseDefinitions) {
			$scope.caseDefinitions = caseDefinitions;
		});
}