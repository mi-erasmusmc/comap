
function CodingSystemsCtrl($scope, $timeout, dataService) {
    
    dataService.codingSystemsPromise.then(function() {
        $scope.codingSystems = dataService.codingSystems;
        $timeout(function() {
            $scope.selected.codingSystems =
                $scope.gridOptions.$gridScope.selectedItems;
        }, 0);
    });
    
    $scope.gridOptions = {
        data: "codingSystems",
        rowHeight: 35,
        showSelectionCheckbox: true,
        filterOptions: { filterText: '' },
        columnDefs: [
          { displayName: 'Name', field: 'name' },
          { displayName: 'Abbreviation', field: 'abbreviation' },
        ]
    };

    $scope.unselect = function(abbreviation) {
        $scope.codingSystems.forEach(function(voc1, index) {
            if (abbreviation == voc1.abbreviation) {
                $scope.gridOptions.selectItem(index, false);
            }
        });
    };
    
    $scope.$on("setSelectedCodingSystems", function(event, abbreviations) {
        $scope.gridOptions.selectAll(false);
        $scope.codingSystems.forEach(function(voc, ix) {
            var selected = abbreviations.indexOf(voc.abbreviation) != -1;
            $scope.gridOptions.selectItem(ix, selected);
        });
    });
};