import { ComponentFixture, TestBed } from '@angular/core/testing';

import { ConceptsDialogComponent } from './concepts-dialog.component';

describe('ConceptsDialogComponent', () => {
  let component : ConceptsDialogComponent;
  let fixture : ComponentFixture<ConceptsDialogComponent>;

  beforeEach(() => {
    TestBed.configureTestingModule({
      declarations: [ConceptsDialogComponent]
    });
    fixture = TestBed.createComponent(ConceptsDialogComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
