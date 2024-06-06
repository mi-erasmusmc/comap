import { ComponentFixture, TestBed } from '@angular/core/testing';

import { VocabulariesComponent } from './vocabularies.component';

describe('VocabulariesComponent', () => {
  let component : VocabulariesComponent;
  let fixture : ComponentFixture<VocabulariesComponent>;

  beforeEach(() => {
    TestBed.configureTestingModule({
      declarations: [VocabulariesComponent]
    });
    fixture = TestBed.createComponent(VocabulariesComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
