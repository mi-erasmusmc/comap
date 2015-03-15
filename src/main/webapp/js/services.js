
function confirmClickDirective() {
	  return {
	    priority: 1,
	    terminal: true,
	    link: function (scope, element, attr) {
	      var msg = attr.confirmClick || "Are you sure?";
	      var clickAction = attr.ngClick;
	      element.bind('click',function () {
	        if ( window.confirm(msg) ) {
	          scope.$eval(clickAction)
	        }
	      });
	    }
	  }
};

/** Provide the URLs that are called from the application. */
function UrlsService() {
	
	this.semanticTypes = "data/semantic_types_groups.json";
	this.stopwords = "data/stopwords.json";

	var persistencyApi = 'resource/persistency';
	this.caseDefinition = persistencyApi + '/case-definition';

	var codeMapperApi = 'resource/code-mapper';
	this.codingSystems = codeMapperApi + '/coding-systems';
	this.umlsConcepts = codeMapperApi + '/umls-concepts';
	this.relatedConcepts = codeMapperApi + '/related';
	this.config = codeMapperApi + '/config';
}

/** Retrieve and provide stopwords, semantic types and coding systems. */
function DataService($http, $q, urls) {
	var service = this;
	
	this.peregrineResource = null;
	this.configPromise = $http.get(urls.config)
		.error(function(err) {
			var msg = "ERROR: Couldn't retrieve config from " + urls.config;
			console.log(msg, err);
			alert(msg);
		})
		.success(function(config) {
			service.peregrineResource = config.peregrineResourceUrl;
		});
	
	this.stopwords = null;
	this.stopwordsPromise = $http.get(urls.stopwords)
		.error(function(err) {
			var msg = "ERROR: Couldn't retrieve stopwords from " + urls.stopwords;
			console.log(msg, err);
			alert(msg);
		})
		.success(function(stopwords) {
			service.stopwords = stopwords;
		});
	this.semanticTypes = null;
	this.semanticTypesByType = {};
	this.semanticTypesPromise = $http.get(urls.semanticTypes)
		.error(function(err) {
			var msg = "ERROR: Couldn't load semantic types and groups from " + urls.semanticTypes;
			console.log(msg, err);
			alert(msg);
		})
		.success(function(semanticTypes) {
			service.semanticTypes = semanticTypes;
			service.semanticTypes.forEach(function(semanticType) {
				service.semanticTypesByType[semanticType.type] = semanticType;
		    });
		});
	this.codingSystems = null;
	this.codingSystemsPromise = $http.get(urls.codingSystems)
		.error(function(err) {
			var msg = "ERROR: Couldn't retrieve coding systems from " + urls.codingSystems;
			console.log(msg, err);
			alert(msg);
		})
		.success(function(codingSystems) {
			service.codingSystems = codingSystems
				.sort(function(v1, v2) {
					if (v1.abbreviation < v2.abbreviation) {
						return -1;
					}
					if (v1.abbreviation > v2.abbreviation) {
						return 1;
					}
					return 0;
				});
		});
	this.completed = $q.all([this.peregrineResource, this.stopwordsPromise, this.semanticTypesPromise, this.codingSystemsPromise]);
}
