<!DOCTYPE html>
<html ng-app="CodeMapperApp">
  <head>
    <meta charset="utf-8">
    <title ng-bind="'CodeMapper &ndash; '+subtitle"></title>
    
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
      <div class="col-md-3">
        <div ng-controller="LoggedInCtrl" ng-if="user">
          Welcome, <span ng-bind="user.username" class="username"></span>
          <a href="#/overview"><button title="Go to overview" class="btn btn-default btn-xs"><span class="glyphicon glyphicon-list"></span> All mappings</button></a>
          <button ng-click="logout()" class="btn btn-default btn-xs"><i class="glyphicon glyphicon-log-out"></i> Logout</button>
        </div>
      </div>
      <div class="col-md-5 text-center">
        <span>
          Help? See our <a target="_blank" href="https://onlinelibrary.wiley.com/doi/full/10.1002/pds.4245">publication</a>, the <a target="_blank" href="https://github.com/mi-erasmusmc/comap">source code</a>,
          <%--Help? See the <a target="_blank" href="https://docs.google.com/presentation/d/1vo94NxADoJAMTQDbzK7QRDy9IvfMHZdBiyzdsqecJA0/edit?usp=sharing">presentation</a>--%>
          or <a href="mailto:b.becker@erasmusmc.nl?subject=CodeMapper">email</a> me. You can hover buttons with an asterisk(*) using your mouse for instant help. CodeMapper is power by the UMLS Metathesaurus 2016AA.
        </span>
      </div>
      <div class="col-md-3 text-right">
      </div>
    </div>
    <div class="row">
      <div class="col-md-4">
        <h4 class="subsubtitle" ng-bind="subsubtitle"></h4>
        <h2 class="subtitle" ng-bind="subtitle"></h2>
      </div>
      <div class="col-md-4 text-center">
        <a title="Go to overview" href="#/overview"><img class='comap-logo' src="images/logo.png" height="70px"></img></a>
      </div>
      <div class="col-md-4 text-right">
        <img class='erasmus-logo' src="images/erasmus_mc.jpg" height="40px" />
        <br/>
        <img class='advance-logo' src="images/logo-advance.png" height="23px" />
      </div>
    </div>
    <div ng-view></div>
    <div class="row footer">
        <p>The research leading to this tool has received support from the Innovative
        Medicines Initiative Joint Undertaking under ADVANCE grant agreement No 115557,
        resources of which are composed of financial contribution from the European
        Union's Seventh Framework Programme (FP7/2007-2013) and EFPIA companies’ in kind
        contribution.<p>
        <p>Anyone using the tool for research purposes and publications/presentations
        should cite:
            <cite>
                Becker BFH, Avillach P, Romio S, van Mulligen EM, Weibel D, Sturkenboom
                MCJM, Kors JA; ADVANCE consortium. CodeMapper: semiautomatic coding of
                case definitions. A contribution from the ADVANCE project.
                Pharmacoepidemiol Drug Saf.2017 Aug;26(8):998-1005.
                <a href="doi:10.1002/pds.4245">doi:10.1002/pds.4245</a>
                (<a href="https://onlinelibrary.wiley.com/doi/pdf/10.1002/pds.4245">pdf</a>)
            </cite>
        </p>
    </div>
  </body>
</html>
