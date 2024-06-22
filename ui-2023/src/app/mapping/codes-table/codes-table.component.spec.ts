import { ComponentFixture, TestBed } from '@angular/core/testing';

import { CodesTableComponent } from './codes-table.component';

describe('CodesTableComponent', () => {
  let component : CodesTableComponent;
  let fixture : ComponentFixture<CodesTableComponent>;

  beforeEach(() => {
    TestBed.configureTestingModule({
      declarations: [CodesTableComponent]
    });
    fixture = TestBed.createComponent(CodesTableComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
