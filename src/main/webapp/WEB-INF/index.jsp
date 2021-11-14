<!DOCTYPE html>
<html ng-app="CodeMapperApp">
  <head>
    <meta charset="utf-8">
    <title ng-bind="'CodeMapper &ndash; '+subtitle"></title>
    <base target="_blank" />
    <link rel="shortcut icon" href="favicon.png">

    <link type="text/css" rel="stylesheet" href="lib/bootstrap-theme.min.css">
    <link type="text/css" rel="stylesheet" href="lib/bootstrap.min.css" />
    <link type="text/css" rel="stylesheet" href="lib/ng-grid.css" />
    <link type="text/css" rel="stylesheet" href="lib/angular-block-ui.min.css" />

    <script src="https://vac4eu.org/wp-content/plugins/advanced-iframe/js/ai_external.js"></script>
    <script>
      // Cannot get working the vertical autoresize using wordpress' advance
      // iframe plugin. Instead, we call the following shortcut to resize the
      // embedding iframe whenever necessary.
      function maybeAdvanceIframeResize() {
          if (typeof aiExecuteWorkaround_advanced_iframe == 'function') {
              aiExecuteWorkaround_advanced_iframe();
          }
      }
    </script>

    <script type="text/javascript" src="lib/jquery.min.js"></script>
    <script type="text/javascript" src="lib/angular.js"></script>
    <script type="text/javascript" src="lib/angular-route.js"></script>
    <script type="text/javascript" src="lib/angular-sanitize.js"></script>
    <script type="text/javascript" src="lib/bootstrap.min.js"></script>
    <script type="text/javascript" src="lib/ui-bootstrap-tpls-0.12.0.js"></script>
    <script type="text/javascript" src="lib/ng-grid-2.0.14.debug.js"></script>
    <script type="text/javascript" src="lib/ng-grid-flexible-height.js"></script>
    <script type="text/javascript" src="lib/angular-block-ui.min.js"></script>
    <script type="text/javascript">
    var globals = {
    	codemapperUmlsVersion: "${CODEMAPPER_UMLS_VERSION}",
    	codemapperUrl: "${CODEMAPPER_URL}",
    	codemapperContactEmail: "${CODEMAPPER_CONTACT_EMAIL}"
    };
    </script>

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
        <!-- <div class="col-md-3"> -->
        <!-- </div> -->
      <!-- <div class="col-md-5 text-center"> -->
      <!-- <span> -->
      <!-- Help? See our <a target="_blank" href="https://onlinelibrary.wiley.com/doi/full/10.1002/pds.4245">publication</a>, the <a target="_blank" href="https://github.com/mi-erasmusmc/comap">source code</a>, -->
      <!-- Help? See the <a target="_blank" href="https://docs.google.com/presentation/d/1vo94NxADoJAMTQDbzK7QRDy9IvfMHZdBiyzdsqecJA0/edit?usp=sharing">presentation</a> -->
      <!-- or <a href="mailto:b.becker@erasmusmc.nl?subject=CodeMapper">email</a> me. You can hover buttons with an asterisk(*) using your mouse for instant help. CodeMapper is power by the UMLS Metathesaurus 2016AA. -->
      <!-- </span> -->
      <!-- </div> -->
        <div class="col-md-6">
            <a href="#/overview" ng-if="user">
                <button title="See all case definitions" class="btn btn-default btn-xs">
                    <span class="glyphicon glyphicon-list"></span> List of case definitions
                </button>
            </a>
        </div>
        <div class="col-md-6 text-right">
            <div ng-controller="LoggedInCtrl" ng-if="user">
                Welcome, <span ng-bind="user.username" class="username"></span>
                <button ng-click="logout()" class="btn btn-default btn-xs"><i class="glyphicon glyphicon-log-out"></i> Logout</button>
            </div>
        </div>
    </div>
    <div class="row">
      <div class="col-md-6">
        <h3 class="subsubtitle" ng-if="subsubtitle" ng-bind="subsubtitle"></h3>
        <h2 class="subtitle" ng-if="subtitle" ng-bind="subtitle"></h2>
      </div>
      <div class="col-md-6 text-right">
        <div ng-controller="LoggedInCtrl" ng-if="user"></div>
        <div>
          <div style="inline-block;">
              <div style="display: inline-block; vertical-align: middle" >
              <a title="See all case definitions" href="#/overview">
                <img class='comap-logo' src="images/logo.png" height="70px"></img>
              </a>
            </div>
            by
            <div style="display: inline-block; ">
              <a href="https://vac4eu.org/" target="_blank">
                <img class='advance-logo' src="images/vac4eu.png" height="35px" />
              </a>
            </div>
          </div>
        </div>
      </div>
    </div>
    <div ng-view></div> <!-- keep this last -->
  </body>
</html>
