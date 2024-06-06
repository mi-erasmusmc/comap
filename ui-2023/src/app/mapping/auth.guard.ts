import { Injectable } from '@angular/core';
import { Router, ActivatedRouteSnapshot, CanActivate, RouterStateSnapshot, UrlTree } from '@angular/router';
import { Observable, map } from 'rxjs';
import { AuthService, User } from './auth.service';

@Injectable({
  providedIn: 'root'
})
export class AuthGuard implements CanActivate {

  constructor(
    public auth : AuthService,
    public router : Router,
  ) { }

  loginIfNecessary(user : User | null, redirectUrl : string) : boolean | UrlTree {
    if (user == null) {
      this.auth.redirectUrl = redirectUrl;
      return this.router.parseUrl('/login');
    } else {
      return true;
    }
  }

  canActivate(
    route : ActivatedRouteSnapshot,
    state : RouterStateSnapshot,
  ) : Observable<boolean | UrlTree> | Promise<boolean | UrlTree> | boolean | UrlTree {
    if (this.auth.user instanceof Promise) {
      return this.auth.user
        .then((user) => this.loginIfNecessary(user, state.url))
        .catch((err) => {
          console.error("GUARD ERR", err);
          alert("Error getting user: " + err.message);
          return false;
        });
    } else {
      return this.loginIfNecessary(this.auth.user, state.url);
    }
  }
}


@Injectable({
  providedIn: 'root'
})
export class NoAuthGuard implements CanActivate {

  constructor(
    public auth : AuthService,
    public router : Router,
  ) { }

  mappingsIfPossible(user : User | null) : boolean | UrlTree {
    if (user != null) {
      return this.router.parseUrl('/mappings');
    } else {
      return true;
    }
  }

  canActivate(
    route : ActivatedRouteSnapshot,
    state : RouterStateSnapshot,
  ) : Observable<boolean | UrlTree> | Promise<boolean | UrlTree> | boolean | UrlTree {
    if (this.auth.user instanceof Promise) {
      return this.auth.user
        .then((user) => this.mappingsIfPossible(user))
        .catch((err) => {
          console.log("NO AUTH GUARD ERR", err);
          return true;
        });
    } else {
      return this.mappingsIfPossible(this.auth.user);
    }
  }
}
