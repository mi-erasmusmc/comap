import { ComponentFixture, TestBed } from '@angular/core/testing';

import { NewsViewComponent } from './news-view.component';

describe('NewsViewComponent', () => {
  let component : NewsViewComponent;
  let fixture : ComponentFixture<NewsViewComponent>;

  beforeEach(() => {
    TestBed.configureTestingModule({
      declarations: [NewsViewComponent]
    });
    fixture = TestBed.createComponent(NewsViewComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
