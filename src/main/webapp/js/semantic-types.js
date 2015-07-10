
function SemanticTypesCtrl($scope, $timeout, dataService) {

    "use strict";

    $scope.allSemanticTypes = [];
    $scope.semanticTypes = [];

    $scope.gridOptions = {
         data: "semanticTypes",
         rowHeight: 35,
         showSelectionCheckbox: true,
         filterOptions: { filterText: '' },
         columnDefs: [
             { displayName: 'Semantic type', field: 'description' },
             { displayName: 'Group', field: 'semantic_group' },
             { displayName: 'Concepts in case definition', field: 'concepts',
                 cellTemplate: '<ul class="comma-separated"><li ng-repeat="c in row.entity[col.field]" ng-bind="c.preferredName"</li></div>',
                 sortFn: function(o1, o2) { return o2.length - o1.length; } }
         ]
    };

    $scope.$watch('state.mapping', function(mapping) {
        // WORKAROUND Grid not rendered correctly when using ng-show / ng-hide
        // https://github.com/angular-ui/ng-grid/issues/855#issuecomment-47254073
        $timeout(function() {
            $scope.gridOptions.$gridServices.DomUtilityService.RebuildGrid(
                $scope.gridOptions.$gridScope,  $scope.gridOptions.ngGrid);
        }, 100);
    });

    dataService.semanticTypesPromise.then(function() {
        $scope.allSemanticTypes = dataService.semanticTypes;
    });
    
    $scope.$watch('state.indexing', function(indexing) {
        if (angular.isObject(indexing)) {
            var occurringTypes = [].concat
                .apply([], indexing.concepts.map(function(c) { return c.semanticTypes; }))
                .filter(isFirstOccurrence);
            $scope.semanticTypes.length = 0;
            $timeout(function() {
                $scope.$apply(function() {
                    $scope.allSemanticTypes.forEach(function(semanticType, ix) {
                        var concepts = indexing.concepts
                            .filter(function(concept) {
                                return concept.semanticTypes.indexOf(semanticType.type) != -1;
                            });
                        if (concepts.length > 0) {
                            var semanticType1 = angular.copy(semanticType);
                            semanticType1.concepts = concepts;
                            $scope.semanticTypes.push(semanticType1);
                        }
                    });
                });
                $scope.selected.semanticTypes =
                    $scope.gridOptions.$gridScope.selectedItems;
                $scope.gridOptions.selectAll(false);
                $scope.semanticTypes.forEach(function(st, ix) {
                    if (INITIAL.semanticTypes.indexOf(st.type) != -1) {
                        $scope.gridOptions.selectItem(ix, true);
                    }
                });
            }, 0);
        }
    });
    
    function setSelection(types) {
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