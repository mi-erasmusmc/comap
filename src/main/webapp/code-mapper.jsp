<%@ page language="java" contentType="text/html; charset=UTF-8"
    pageEncoding="UTF-8"%>
<!DOCTYPE html>
<html ng-app="codeMapperApp">
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
      var PEREGRINE_RESOURCE_URL = '${peregrineResourceUrl}';
      var CASE_DEFINITION_NAME = '${caseDefinitionName}';
    </script>
    <script src="code-mapper.js"></script>
    <script src="code-mapper-app.js"></script>
  </head>
  
  <body ng-controller="CodeMapperCtrl as codeMapperCtrl" ng-keydown="onKeydown($event)" tabindex="0">
  
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
      <li ng-repeat="message in messages | limitTo: -3" ng-bind="message.text"></li>
    </ul>
    
    <tabset>
      <tab id="coding-systems-tab" heading="1. Coding systems" ng-controller="CodingSystemsCtrl">
        <div block-ui="inputBlockUi">
          <label for='selectedVocabulariesList'>Selected:</label>
          <div id='selectedVocabulariesList'>
            <span ng-repeat="voc in selected.codingSystems" ng-bind="voc.abbreviation" ng-dblclick="unselect(voc.abbreviation)" class="vocabulary noselect"></span>
          </div>
          <label for='vocabulariesFilter'>Filter:</label>
          <input id='vocabulariesFilter' type="text" ng-model="gridOptions.filterOptions.filterText" />
          <div ng-grid="gridOptions" class="grid"></div>
        </div>
      </tab>
      
      <tab id="semantics-tab" heading="2. Semantic types" ng-controller="SemanticTypesCtrl">
        <div block-ui="inputBlockUi">
          <label for='selectedsemanticTypesList'>Selected:</label>
          <span ng-repeat="type in selected.semanticTypes" ng-bind="type.description" ng-dblclick="unselect(type)" class="semantic-type noselect" id='selectedsemanticTypesList'></span>
          <label for='samanticTypesFilter'>Filter:</label>
          <input id='samanticTypesFilter' type="text" ng-model="gridOptions.filterOptions.filterText" />
          <div ng-grid="gridOptions" class="grid"></div>
        </div>
      </tab>
      
      <tab id="case-definition-tab" heading="3. Case definition">
        <div block-ui="inputBlockUi">
          <textarea rows=35 cols=200 ng-model="$parent.$parent.caseDefinition"></textarea>
        </div>
      </tab>
      
      <tab id="concepts-tab" heading="4. Concepts">
        <div id="concept-buttons">
          <div ng-show="state">{{state.concepts.length}} concepts</div>
          <button ng-click="searchConcepts()" ng-if="state == null" class="btn btn-default btn-sm" id="search-concepts">
            <i class="glyphicon glyphicon-refresh"></i>
            Generate
          </button>
          <button ng-click="resetConcepts()" confirm-click="Really reset all translations?" ng-if="state" class="btn btn-default btn-sm" id="reset-concepts">
            <i class="glyphicon glyphicon-flash"></i>
            Reset
          </button>
          <button ng-click="saveTranslations()" ng-if="state" class="btn btn-default btn-sm">
            <i class="glyphicon glyphicon-cloud-upload"></i>
            Save
          </button>
          <button ng-click="downloadConcepts()" ng-if="state" class="btn btn-default btn-sm">
            <i class="glyphicon glyphicon-download"></i>
            Download (CSV)
          </button>
        </div>
        <label for='conceptsFilter'>Filter:</label>
        <input id='conceptsFilter' type="text" ng-model="conceptsGridOptions.filterOptions.filterText" />
        <div ng-grid="conceptsGridOptions" class="grid"></div>
      </tab>
      
      <tab id="history-tab" heading="5. History">
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
