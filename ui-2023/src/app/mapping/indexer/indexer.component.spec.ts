import { ComponentFixture, TestBed } from '@angular/core/testing';

import { IndexerComponent } from './indexer.component';

describe('IndexerComponent', () => {
  let component : IndexerComponent;
  let fixture : ComponentFixture<IndexerComponent>;

  beforeEach(() => {
    TestBed.configureTestingModule({
      declarations: [IndexerComponent]
    });
    fixture = TestBed.createComponent(IndexerComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
