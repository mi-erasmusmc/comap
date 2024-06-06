import { ComponentFixture, TestBed } from '@angular/core/testing';

import { ReviewsConceptComponent } from './reviews-concept.component';

describe('ReviewsConceptComponent', () => {
  let component : ReviewsConceptComponent;
  let fixture : ComponentFixture<ReviewsConceptComponent>;

  beforeEach(() => {
    TestBed.configureTestingModule({
      declarations: [ReviewsConceptComponent]
    });
    fixture = TestBed.createComponent(ReviewsConceptComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
