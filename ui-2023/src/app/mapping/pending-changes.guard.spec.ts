import { TestBed } from '@angular/core/testing';
import { CanActivateFn } from '@angular/router';

import { PendingChangesGuard } from './pending-changes.guard';

describe('pendingChangesGuard', () => {
  let guard : PendingChangesGuard;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    guard = TestBed.inject(PendingChangesGuard);
  });

  it('should be created', () => {
    expect(executeGuard).toBeTruthy();
  });
});
