import { TestBed } from '@angular/core/testing';

import { PersistencyService } from './persistency.service';

describe('PersistencyService', () => {
  let service : PersistencyService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(PersistencyService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
