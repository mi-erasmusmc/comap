import { ComponentFixture, TestBed } from '@angular/core/testing';

import { CustomVocabularyDialogComponent } from './custom-vocabulary-dialog.component';

describe('CustomVocabularyDialogComponent', () => {
  let component : CustomVocabularyDialogComponent;
  let fixture : ComponentFixture<CustomVocabularyDialogComponent>;

  beforeEach(() => {
    TestBed.configureTestingModule({
      declarations: [CustomVocabularyDialogComponent]
    });
    fixture = TestBed.createComponent(CustomVocabularyDialogComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
