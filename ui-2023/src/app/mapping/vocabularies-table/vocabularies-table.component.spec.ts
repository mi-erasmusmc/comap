import { ComponentFixture, TestBed } from '@angular/core/testing';

import { VocabulariesTableComponent } from './vocabularies-table.component';

describe('VocabulariesTableComponent', () => {
  let component : VocabulariesTableComponent;
  let fixture : ComponentFixture<VocabulariesTableComponent>;

  beforeEach(() => {
    TestBed.configureTestingModule({
      declarations: [VocabulariesTableComponent]
    });
    fixture = TestBed.createComponent(VocabulariesTableComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
