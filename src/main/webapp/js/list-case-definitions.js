
function ListCaseDefinitionsCtrl($scope, $rootScope, $http, $location, urls, user) {

    $scope.user = user;
    $scope.projects = [];
    $scope.caseDefinitions = {};
    $scope.usersForProject = {};
    $scope.newNames = {};
    $rootScope.subtitle = "";
    
    $http.get(urls.projectPermissions)
        .error(function(err) {
            var msg = "Couldn't load projects from url " + urls.projects;
            error(msg);
        })
        .success(function(projectPermissions) {
            angular.forEach(projectPermissions, function(perms, project) {
            	$scope.projects.push(project);
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
                    .success(function(users) {
                        $scope.usersForProject[project] = users;
                    });
            });
        });
    
    $scope.validNewName = function(project, name) {
        return name.length > 0 && $scope.caseDefinitions[project].indexOf(name) == -1;
    }
    
    $scope.create = function(project, name) {
        $location.path('/case-definition/' + encodeURIComponent(project) + '/' + encodeURIComponent(name));
    }
    
    $scope.isMember = function(project) {
    	return $scope.usersForProject[project].indexOf("Member") != -1;
    }
}