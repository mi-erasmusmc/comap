/*******************************************************************************
 * Copyright 2017 Erasmus Medical Center, Department of Medical Informatics.
 * 
 * This program shall be referenced as “Codemapper”.
 * 
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU Affero General Public License as published
 * by the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 * 
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU Affero General Public License for more details.
 * 
 * You should have received a copy of the GNU Affero General Public License
 * along with this program. If not, see <http://www.gnu.org/licenses/>.
 ******************************************************************************/

function confirmClickDirective() {
      return {
        priority: 1,
        terminal: true,
        link: function (scope, element, attr) {
          var msg = attr.confirmClick || "Are you sure?";
          var clickAction = attr.ngClick;
          element.bind('click',function () {
            if ( window.confirm(msg) ) {
              scope.$eval(clickAction);
            }
          });
        }
      };
};

/** Provide the URLs that are called from the application. */
function UrlsService() {
    var service = this;
    
    this.semanticTypes = "data/semantic_types_groups.json";
    this.stopwords = "data/stopwords.json";

    var persistencyApi = 'rest/persistency';
    this.projectPermissions = persistencyApi + '/project-permissions';
    this.projects = persistencyApi + '/projects';
    this.project = function(project) {
    	return this.projects + '/' + encodeURIComponent(project);
    };
    this.caseDefinitions = function(project) {
        return this.project(project) + '/case-definitions'; 
    };
    this.caseDefinition = function(project, caseDefinition) {
        return this.caseDefinitions(project) + '/' +  encodeURIComponent(caseDefinition);
    };
    this.usersForProject = function(project) {
        return this.project(project) + '/users';
    };
    this.comments = function(project, caseDefinition) {
    	return this.caseDefinition(project, caseDefinition) + '/comments';
    };
    
    var codeMapperApi = 'rest/code-mapper';
    this.codingSystems = codeMapperApi + '/coding-systems';
    this.umlsConcepts = codeMapperApi + '/umls-concepts';
    this.relatedConcepts = codeMapperApi + '/related-concepts';
    this.suggestConcepts = codeMapperApi + '/suggest-concepts';
    this.config = codeMapperApi + '/config';
    this.autocomplete = codeMapperApi + '/autocomplete';
    this.autocompleteCode = codeMapperApi + '/autocomplete-code';
    this.searchUts = codeMapperApi + '/search-uts'
    
    var authentificationApi = 'rest/authentification';
    this.login = authentificationApi + '/login';
    this.logout = authentificationApi + '/logout';
    this.user = authentificationApi + '/user';
    this.changePassword = authentificationApi + '/change-password';

    var downloadApi = 'rest/services/download';
    this.download = {
        'xls': downloadApi + '/case-definition-xls',
        'tsv': downloadApi + '/case-definition-tsv'
    };
    
    var reviewApi = 'rest/review';
    this.topicsByCui = (project, casedef) => `${reviewApi}/topics-by-cui/${project}/${casedef}`;
    this.newTopic = (project, casedef, cui) => `${reviewApi}/new-topic/${project}/${casedef}/${cui}`;
    this.newMessage = (project, casedef, cui, topicId) => `${reviewApi}/new-message/${project}/${casedef}/${cui}/${topicId}`;
    this.resolveTopic = (project, casedef, cui, topicId) => `${reviewApi}/resolve-topic/${project}/${casedef}/${cui}/${topicId}`;
    this.markTopicRead = (project, casedef, cui, topicId) => `${reviewApi}/mark-topic-read/${project}/${casedef}/${cui}/${topicId}`;
}

/** Retrieve and provide stopwords, semantic types and coding systems. */
function DataService($http, $q, urls) {
    var service = this;

    this.peregrineResource = null;
    this.configPromise = $http.get(urls.config)
        .error(function(err, status) {
            var msg = "ERROR: Couldn't retrieve config from " + urls.config;
            console.log(msg, err, status);
            alert(msg);
        })
        .success(function(config) {
            service.peregrineResource = config.peregrineResourceUrl;
        });
    
    this.stopwords = null;
    this.stopwordsPromise = $http.get(urls.stopwords)
        .error(function(err, status) {
            var msg = "ERROR: Couldn't retrieve stopwords from " + urls.stopwords;
            console.log(msg, err, status);
            alert(msg);
        })
        .success(function(stopwords) {
            service.stopwords = stopwords;
        });
    this.semanticTypes = null;
    this.semanticTypesByType = {};
    this.semanticTypesPromise = $http.get(urls.semanticTypes)
        .error(function(err, status) {
            var msg = "ERROR: Couldn't load semantic types and groups from " + urls.semanticTypes;
            console.log(msg, err, status);
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
        .error(function(err, status) {
            var msg = "ERROR: Couldn't retrieve coding systems from " + urls.codingSystems;
            console.log(msg, err, status);
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
