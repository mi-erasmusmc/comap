import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { environment } from '../../../src/environments/environment';
import { JSONObject, Mapping, Revision } from './data';
import { urlEncodedOptions } from '../app.module';
import { Observable, map, catchError } from 'rxjs';

export type ProjectPermission = 'Editor' | 'Commentator';

export type ProjectPermissions = Set<ProjectPermission>;

export type ProjectsPermissions = { [key : string] : Set<ProjectPermissions> }

@Injectable({
  providedIn: 'root'
})
export class PersistencyService {
  private url : string = environment.apiUrl + '/persistency'

  constructor(private http : HttpClient) { }

  projectPermissions() {
    return this.http.get<ProjectsPermissions>(this.url + '/project-permissions');
  }

  mappings(project : string) {
    return this.http.get<string[]>(this.url + `/projects/${project}/case-definitions`)
      .pipe(map(names => {
        names.sort((a, b) => a.toLowerCase().localeCompare(b.toLowerCase()));
        return names;
      }));
  }

  mapping(project : string, mapping : string) {
    return this.http.get<JSONObject>(this.url + `/projects/${project}/case-definitions/${mapping}`);
  }

  latestRevision(project : string, caseDefinition : string) : Observable<[number, Mapping]> {
    return this.http.get<Revision>(this.url + `/projects/${project}/case-definitions/${caseDefinition}/latest-revision`)
      .pipe(map(rev => {
        let mapping = Mapping.importJSON(JSON.parse(rev.mapping));
        return [rev.version, mapping];
      }))
  }

  latestRevisionOrImportMapping(project : string, caseDefinition : string) : Observable<[number, Mapping]> {
    return this.latestRevision(project, caseDefinition)
      .pipe(catchError(err => {
        if (err.status == 404) {
          console.info("no revision found, importing old JSON");
          return this.mapping(project, caseDefinition)
            .pipe(map((json) => [-1, Mapping.importOG(json)] as [number, Mapping]));
        } else {
          throw err;
        }
      }));
  }

  getRevisions(project : string, caseDefinition : string) {
    return this.http.get<Revision[]>(this.url + `/projects/${project}/case-definitions/${caseDefinition}/revisions`);
  }

  saveRevision(project : string, caseDefinition : string, mapping : Mapping, summary : string) {
    let body = new URLSearchParams();
    let mappingJson = JSON.stringify(mapping, Mapping.jsonifyReplacer);
    body.append("mapping", mappingJson);
    body.append("summary", summary);
    let url = this.url + `/projects/${project}/case-definitions/${caseDefinition}/save-revision`;
    return this.http.post<number>(url, body, urlEncodedOptions);
  }
}
