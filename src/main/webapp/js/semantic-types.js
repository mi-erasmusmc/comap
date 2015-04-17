
function SemanticTypesCtrl($scope, $timeout, dataService) {

    "use strict";

    $scope.semanticTypes = [];

    $scope.gridOptions = {
         data: "semanticTypes",
         rowHeight: 35,
         showSelectionCheckbox: true,
         filterOptions: { filterText: '' },
         columnDefs: [
             { displayName: 'In case definition (number of concepts)', field: 'numConcepts',
                 cellTemplate: '<div ng-if="row.entity[col.field] > 0"><i class="glyphicon glyphicon-ok"></i> ({{row.entity[col.field]}})</div>',
                 sortFn: function(o1, o2) { return o2 - o1; } },
             { displayName: 'Semantic type', field: 'description' },
             { displayName: 'Group', field: 'semantic_group' },
         ]
    };

    $scope.$watch('state.mapping', function(mapping) {
        // WORKAROUND https://github.com/angular-ui/ng-grid/issues/855#issuecomment-47254073
        $timeout(function() {
            $scope.gridOptions.$gridServices.DomUtilityService.RebuildGrid(
                $scope.gridOptions.$gridScope,  $scope.gridOptions.ngGrid);
        }, 100);
    });

    dataService.semanticTypesPromise.then(function() {
        $scope.semanticTypes = dataService.semanticTypes;
        $timeout(function() {
            $scope.selected.semanticTypes =
                $scope.gridOptions.$gridScope.selectedItems;
            }, 0);
    });
    
    $scope.$watch('state.indexing', function(indexing) {
        if (angular.isObject(indexing)) {
            console.log("Updated indexing", indexing);
            var occurringTypes = [].concat
                .apply([], indexing.concepts.map(function(c) { return c.semanticTypes; }))
                .filter(isFirstOccurrence);
            console.log(occurringTypes);
            $scope.semanticTypes.forEach(function(semanticType, ix) {
                var numConcepts = indexing.concepts
                    .filter(function(concept) {
                        return concept.semanticTypes.indexOf(semanticType.type) != -1;
                    })
                    .length;
                $scope.gridOptions.selectItem(ix, numConcepts > 0);
                semanticType.numConcepts = numConcepts;
            });
            $scope.gridOptions.sortBy('semantic_group');
            $scope.gridOptions.sortBy('numConcepts');
        }
    });
    
    function setSelection(types) {
        console.log($scope);
        $scope.gridOptions.selectAll(false);
        $scope.semanticTypes.forEach(function(semanticType, index) {
            var selected = types.indexOf(semanticType.type) != -1;
            $scope.gridOptions.selectItem(index, selected);
        });
    }
    
    $scope.unselect = function(semanticType) {
        $scope.semanticTypes.forEach(function(semanticType1, index) {
            if (semanticType.type == semanticType1.type) {
                $scope.gridOptions.selectItem(index, false);
            }
        });
    };
    
    $scope.$on("setSelectedSemanticTypes", function(event, types) {
        setSelection(types);
    });
};