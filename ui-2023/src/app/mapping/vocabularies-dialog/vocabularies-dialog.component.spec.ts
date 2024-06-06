import { ComponentFixture, TestBed } from '@angular/core/testing';

import { VocabulariesDialogComponent } from './vocabularies-dialog.component';

describe('VocabulariesDialogComponent', () => {
  let component : VocabulariesDialogComponent;
  let fixture : ComponentFixture<VocabulariesDialogComponent>;

  beforeEach(() => {
    TestBed.configureTestingModule({
      declarations: [VocabulariesDialogComponent]
    });
    fixture = TestBed.createComponent(VocabulariesDialogComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
