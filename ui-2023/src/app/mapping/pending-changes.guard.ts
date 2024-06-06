import { Injectable } from '@angular/core';
import { CanDeactivate, ActivatedRouteSnapshot, RouterStateSnapshot } from '@angular/router';

export interface HasPendingChanges {
  hasPendingChanges() : boolean;
}

@Injectable({
  providedIn: 'root'
})
export class PendingChangesGuard implements CanDeactivate<HasPendingChanges> {
  canDeactivate(
    component : HasPendingChanges,
    next : ActivatedRouteSnapshot,
    state : RouterStateSnapshot
  ) : boolean {
    return !component.hasPendingChanges()
      || confirm('You have unsafed changes, which are lost when navigating away.')
  }
}
