<!DOCTYPE html>
<html ng-app="CodeMapperApp">
  <head>
    <meta charset="utf-8">
    <title>ADVANCE Code Mapper</title>
    
    <link rel="stylesheet" href="lib/bootstrap-theme.min.css">
    <link rel='stylesheet' type="text/css" href="lib/bootstrap.min.css" />
    <link rel='stylesheet' type="text/css" href="lib/ng-grid.css" />
    
    <script src="lib/jquery.min.js"></script>
    <script src="lib/angular.js"></script>
    <script src="lib/angular-sanitize.js"></script>
    <script src="lib/bootstrap.min.js"></script>
    <script src="lib/ui-bootstrap-tpls-0.12.0.js"></script>
    <script src="lib/ng-grid-2.0.14.debug.js"></script>
    
    <link rel='stylesheet' type="text/css" href="style.css" />
    <script src="app.js"></script>
  </head>
  <body ng-controller="CodeMapperCtrl">
  
    <div class="row">
      <div class="col-md-10">
        <h1>ADVANCE Code Mapper</h1>
      </div>
      <div class="col-md-2">
        <div style="text-align: right">$Revision: 5346 $</div>
        <div>Logged in as ${user.username}
         <form method=POST action=logout>
           <input type=submit value=Logout></input>
         </form>
        </div>
        <div><image src="images/200709mslogo_erasmus_mc.jpg" height="100px" /></div>
      </div>
    </div>
    
    <ul class="list-unstyled icon-list messages">
      <li ng-repeat="message in messages | limitTo: -1" ng-bind="message.text"></li>
    </ul>
    
    <tabset>
      <tab id="coding-systems-tab" heading="1. Vocabularies">
        <label for='selectedVocabulariesList'>Selected:</label>
        <div id='selectedVocabulariesList'>
          <span ng-repeat="voc in selectedVocabularies" ng-bind="voc.abbreviation" ng-dblclick="unselectVocabulary(voc)" class="vocabulary noselect"></span>
        </div>
        <label for='vocabulariesFilter'>Filter:</label>
        <input id='vocabulariesFilter' type="text" ng-model="vocabulariesGridOptions.filterOptions.filterText" />
        <div ng-grid="vocabulariesGridOptions" class="grid"></div>
      </tab>
      
      <tab id="semantics-tab" heading="2. Semantic types">
        <label for='selectedsemanticTypesList'>Selected:</label>
        <span id='selectedsemanticTypesList' ng-repeat="typeGroups in semanticTypesGroupsGridOptions.$gridScope.selectedItems" ng-bind="typeGroups.description" ng-dblclick="unselectSemanticTypeGroup(typeGroups)" class="semantic-type noselect" ></span>
        <label for='samanticTypesFilter'>Filter:</label>
        <input id='samanticTypesFilter' type="text" ng-model="semanticTypesGroupsGridOptions.filterOptions.filterText" />
        <div ng-grid="semanticTypesGroupsGridOptions" class="grid"></div>
      </tab>
      
      <tab id="case-definition-tab" heading="3. Case definition">
         <label for='caseDefinitionName'>Name:</label>
         <input id="caseDefinitionName" type="text" ng-model="$parent.caseDefinitionName" />
         <label for='caseDefinition'>Clinical definition:</label>
         <textarea rows=35 cols=200 id="caseDefinition" ng-model="$parent.caseDefinition"></textarea>
      </tab>
      
      <tab id="concepts-tab" heading="4. Concepts">
        <div id="concept-buttons">
          <div>
            Case definition
            <span class='emphasize' ng-bind='config.caseDefinitionName'></span>
            with {{concepts.length}} concepts
          </div>
          <button id="search-concepts" class="btn btn-default btn-sm"
              confirmed-click="searchConcepts()"
              ng-confirm-click="Really (re-)generate concepts?"
              ng-dont-confirm="{{concepts.length == 0}}">
            <i class="glyphicon glyphicon-refresh"></i>
            <span ng-show='concepts.length > 0'>Reg</span><span ng-show='concepts.length == 0'>G</span>enerate concepts
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
    </tabset>
    
    <div id="mask" ng-show="isBlocked"></div>
    
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
