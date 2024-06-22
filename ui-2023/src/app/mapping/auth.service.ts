import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { environment } from '../../../src/environments/environment';
import { filter, map } from 'rxjs/operators';
import { BehaviorSubject, Observable } from 'rxjs';
import { urlEncodedOptions } from '../app.module';
import { PersistencyService, ProjectsPermissions } from './persistency.service';

export enum ProjectPermission {
  Editor, Commentator
}

export interface User {
  username : string,
  projectPermissions : { [key : string] : Set<ProjectPermission> }
}

export interface LoginResult {
  success : boolean,
  user : User,
  error : string | undefined,
}

type UserFunction = (user : User | null | PromiseLike<User | null>) => void;
type ProjectsFunction = (projects : ProjectsPermissions | PromiseLike<ProjectsPermissions>) => void;

@Injectable({
  providedIn: 'root'
})
export class AuthService {

  private url : string = environment.apiUrl + '/authentification'
  private resolveUser! : UserFunction;
  private rejectUser! : UserFunction;
  private resolveProjects! : ProjectsFunction;
  private rejectProjects! : ProjectsFunction;
  public redirectUrl : string | null = null;

  user : Promise<User | null> | User | null;
  projects! : Promise<ProjectsPermissions>;
  userIsEditor : boolean = false;
  userSubject : BehaviorSubject<User | null> = new BehaviorSubject(null as User | null);
  private redirectURL : string | null = null

  constructor(
    private http : HttpClient,
    private persistency : PersistencyService,
  ) {
    console.log("ENV", environment.name);
    this.user = new Promise((resolve, reject) => {
      this.resolveUser = resolve;
      this.rejectUser = reject;
    });
    this.http.get<User | null>(this.url + '/user')
      .subscribe(
        (user) => {
          this.resolveUser(user);
          this.userSubject.next(user);
          // TODO set userIsEditor
        },
        (err) => {
          this.rejectUser(err);
        });
    this.projects = new Promise((resolve, reject) => {
      this.resolveProjects = resolve;
      this.rejectProjects = reject;
    });
    persistency.projectPermissions().subscribe((pps) => {
      this.resolveProjects(pps);
    });
  }

  login(username : string, password : string) : Observable<{ success : boolean, error : string | undefined, redirectUrl : string | null }> {
    let body = new URLSearchParams();
    body.set('username', username);
    body.set('password', password);
    return this.http.post<LoginResult>(this.url + '/login', body, urlEncodedOptions)
      .pipe(map((res) => {
        if (res.success) {
          console.log("auth login user = ", res.user);
          this.user = res.user;
          this.userSubject.next(res.user);
          let redirectUrl = this.redirectUrl;
          this.redirectUrl = null;
          return { success: true, error: undefined, redirectUrl };
        } else {
          this.user = null;
          this.userSubject.next(null);
          return { success: false, error: res.error, redirectUrl: null }
        }
      }));
  }

  logout() {
    return this.http.post<void>(this.url + '/logout', {})
      .pipe(map(() => {
        this.userSubject.next(null);
        this.user = null;
      }));
  }
}
