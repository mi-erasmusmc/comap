import { ComponentFixture, TestBed } from '@angular/core/testing';

import { ConceptsComponent } from './concepts.component';

describe('ConceptsComponent', () => {
  let component : ConceptsComponent;
  let fixture : ComponentFixture<ConceptsComponent>;

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [ConceptsComponent]
    });
    fixture = TestBed.createComponent(ConceptsComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
