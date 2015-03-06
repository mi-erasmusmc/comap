<%@ page language="java" contentType="text/html; charset=UTF-8"
    pageEncoding="UTF-8"%>
<!DOCTYPE html>
<html ng-app="CodeMapperApp">
  <head>
    <meta charset="utf-8">
    <title>ADVANCE Code Mapper</title>
    
    <link rel="stylesheet" href="lib/bootstrap-theme.min.css">
    <link rel='stylesheet' type="text/css" href="lib/bootstrap.min.css" />
    <link rel='stylesheet' type="text/css" href="lib/ng-grid.css" />
    <link rel='stylesheet' type="text/css" href="lib/angular-block-ui.min.css" />
    
    <script src="lib/jquery.min.js"></script>
    <script src="lib/angular.js"></script>
    <script src="lib/angular-sanitize.js"></script>
    <script src="lib/bootstrap.min.js"></script>
    <script src="lib/ui-bootstrap-tpls-0.12.0.js"></script>
    <script src="lib/ng-grid-2.0.14.debug.js"></script>
    <script src="lib/angular-block-ui.min.js"></script>
    
    <link rel='stylesheet' type="text/css" href="style.css" />
    <script type=text/javascript>
      var peregrineResourceUrl = '${peregrineResourceUrl}';
      var caseDefinitionName = '${caseDefinitionName}';
    </script>
    <script src="code-mapper.js"></script>
  </head>
  <body ng-controller="CodeMapperCtrl">
  
    <div class="row">
      <div class="col-md-10">
        <h1>ADVANCE Code Mapper</h1>
        Case definition: ${caseDefinitionName}
      </div>
      <div class="col-md-2">
        <div style="text-align: right">$Revision: 5346 $</div>
        <div><image src="images/200709mslogo_erasmus_mc.jpg" height="100px" /></div>
      </div>
    </div>
    
    <ul class="list-unstyled icon-list messages">
      <li ng-repeat="message in messages | limitTo: -1" ng-bind="message.text"></li>
    </ul>
    
    <tabset>
      <tab id="coding-systems-tab" heading="1. Vocabularies">
        <div block-ui="inputBlockUi">
          <label for='selectedVocabulariesList'>Selected:</label>
          <div id='selectedVocabulariesList'>
            <span ng-repeat="voc in selectedVocabularies" ng-bind="voc.abbreviation" ng-dblclick="unselectVocabulary(voc)" class="vocabulary noselect"></span>
          </div>
          <label for='vocabulariesFilter'>Filter:</label>
          <input id='vocabulariesFilter' type="text" ng-model="vocabulariesGridOptions.filterOptions.filterText" />
          <div ng-grid="vocabulariesGridOptions" class="grid"></div>
        </div>
      </tab>
      
      <tab id="semantics-tab" heading="2. Semantic types">
        <div block-ui="inputBlockUi">
          <label for='selectedsemanticTypesList'>Selected:</label>
          <span id='selectedsemanticTypesList' ng-repeat="typeGroups in semanticTypesGroupsGridOptions.$gridScope.selectedItems" ng-bind="typeGroups.description" ng-dblclick="unselectSemanticTypeGroup(typeGroups)" class="semantic-type noselect" ></span>
          <label for='samanticTypesFilter'>Filter:</label>
          <input id='samanticTypesFilter' type="text" ng-model="semanticTypesGroupsGridOptions.filterOptions.filterText" />
          <div ng-grid="semanticTypesGroupsGridOptions" class="grid"></div>
        </div>
      </tab>
      
      <tab id="case-definition-tab" heading="3. Case definition" block-ui="inputBlockUi">
        <div block-ui="inputBlockUi">
          <textarea rows=35 cols=200 ng-model="$parent.caseDefinition"></textarea>
        </div>
      </tab>
      
      <tab id="concepts-tab" heading="4. Concepts">
        <div id="concept-buttons">
          <div>{{concepts.length}} concepts</div>
          <button id="search-concepts" ng-if="concepts.length == 0" ng-click="searchConcepts()" class="btn btn-default btn-sm">
            <i class="glyphicon glyphicon-refresh"></i>
            Generate concepts
          </button>
          <button id="reset-concepts" ng-if="concepts.length > 0" ng-click="resetConcepts()" ng-confirm-click="Really reset concepts?" class="btn btn-default btn-sm">
            <i class="glyphicon glyphicon-flash"></i>
            Reset concepts
          </button>
          <button ng-click="saveCaseDefinition()" class="btn btn-default btn-sm">
            <i class="glyphicon glyphicon-cloud-upload"></i>
            Save
          </button>
          <button ng-click="downloadConcepts()" class="btn btn-default btn-sm">
            <i class="glyphicon glyphicon-download"></i>
            Download (CSV)
          </button>
        </div>
        <label for='conceptsFilter'>Filter:</label>
        <input id='conceptsFilter' type="text" ng-model="conceptsGridOptions.filterOptions.filterText" />
        <div ng-grid="conceptsGridOptions" class="grid"></div>
      </tab>
      
      <tab id="history-tab" heading="History">
        <div ng-grid="historyGridOptions" class="grid"></div>
      </tab>
    </tabset>
    
    <script type="text/ng-template" id="ShowConcepts.html">
       <div class="modal-header">
         <h3 class="modal-title">{{title}} ({{concepts.length}} concepts)</h3>
       </div>
       <div class="modal-body">
         <label for='dialogConceptsFilter'>Filter:</label>
         <input id='dialogConceptsFilter' type="text" ng-model="conceptsGridOptions.filterOptions.filterText" />
         <div ng-grid="conceptsGridOptions" class="grid"></div>
       </div>
       <div class="modal-footer">
         <button class="btn btn-primary" ng-click="ok()">OK</button>
         <button class="btn btn-warning" ng-if="selectable" ng-click="cancel()">Cancel</button>
       </div>
    </script>
  </body>
</html>
