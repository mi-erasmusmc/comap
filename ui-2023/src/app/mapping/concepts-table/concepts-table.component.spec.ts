import { ComponentFixture, TestBed } from '@angular/core/testing';

import { ConceptsTableComponent } from './concepts-table.component';

describe('ConceptsTableComponent', () => {
  let component : ConceptsTableComponent;
  let fixture : ComponentFixture<ConceptsTableComponent>;

  beforeEach(() => {
    TestBed.configureTestingModule({
      declarations: [ConceptsTableComponent]
    });
    fixture = TestBed.createComponent(ConceptsTableComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
