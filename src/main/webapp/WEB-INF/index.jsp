<!DOCTYPE html>
<html ng-app="CodeMapperApp">
  <head>
    <meta charset="utf-8">
    <title ng-bind="'CoMap &ndash; '+subtitle"></title>
    
    <link rel="shortcut icon" href="favicon.png">
    
    <link type="text/css" rel="stylesheet" href="lib/bootstrap-theme.min.css">
    <link type="text/css" rel="stylesheet" href="lib/bootstrap.min.css" />
    <link type="text/css" rel="stylesheet" href="lib/ng-grid.css" />
    <link type="text/css" rel="stylesheet" href="lib/angular-block-ui.min.css" />

    <script type="text/javascript" src="lib/jquery.min.js"></script>
    <script type="text/javascript" src="lib/angular.js"></script>
    <script type="text/javascript" src="lib/angular-route.js"></script>
    <script type="text/javascript" src="lib/angular-sanitize.js"></script>
    <script type="text/javascript" src="lib/bootstrap.min.js"></script>
    <script type="text/javascript" src="lib/ui-bootstrap-tpls-0.12.0.js"></script>
    <script type="text/javascript" src="lib/ng-grid-2.0.14.debug.js"></script>
    <script type="text/javascript" src="lib/ng-grid-flexible-height.js"></script>
    <script type="text/javascript" src="lib/angular-block-ui.min.js"></script>
    
    <link type="text/css" rel="stylesheet" href="style.css" />
    <script type="text/javascript" src="js/utils.js"></script>
    <script type="text/javascript" src="js/state.js"></script>
    <script type="text/javascript" src="js/services.js"></script>
    <script type="text/javascript" src="js/list-case-definitions.js"></script>
    <script type="text/javascript" src="js/case-definition.js"></script>
    <script type="text/javascript" src="js/code-mapper.js"></script>
    <script type="text/javascript" src="js/authentification.js"></script>
    <script type="text/javascript" src="js/app.js"></script>
  </head>
  
  <body ng-keydown="onKeydown($event)" tabindex="0">
    <div class="row">
      <div class="col-md-4 text-left">
        <div ng-controller="LoggedInCtrl" ng-if="user">
          Hello, <span ng-bind="user.username" class="username"></span>
          (<a href="#/overview">overview</a>)
          <button ng-click="logout()" class="btn btn-default btn-xs"><i class="glyphicon glyphicon-log-out"></i> Logout</button>
        </div>
        <h2 class="subtitle" ng-bind="subtitle"></h2>
      </div>
      <div class="col-md-4 text-center">
        <span class="center-block">
          Help? Suggestions?
          <a href="mailto:b.becker@erasmusmc.nl?subject=AdvanceCodeMapper">Drop an email</a>, or
          <a target="_blank" href="https://docs.google.com/presentation/d/1vo94NxADoJAMTQDbzK7QRDy9IvfMHZdBiyzdsqecJA0/edit?usp=sharing">watch the walkthrough.</a></span>
        <img class='comap-logo' src="images/logo.png" height="60px"></img>
      </div>
      <div class="col-md-4 text-right">
        <image class='advance-logo' src="images/logo-advance.png" height="50px" />
      </div>
    </div>
    <hr/>
    <div ng-view></div>
  </body>
</html>
