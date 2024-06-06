import { ComponentFixture, TestBed } from '@angular/core/testing';

import { ReviewsConceptDialogComponent } from './reviews-concept-dialog.component';

describe('ReviewsConceptDialogComponent', () => {
  let component : ReviewsConceptDialogComponent;
  let fixture : ComponentFixture<ReviewsConceptDialogComponent>;

  beforeEach(() => {
    TestBed.configureTestingModule({
      declarations: [ReviewsConceptDialogComponent]
    });
    fixture = TestBed.createComponent(ReviewsConceptDialogComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
