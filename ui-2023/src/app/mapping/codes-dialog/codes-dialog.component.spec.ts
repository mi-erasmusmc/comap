import { ComponentFixture, TestBed } from '@angular/core/testing';

import { CodesDialogComponent } from './codes-dialog.component';

describe('CodesDialogComponent', () => {
  let component : CodesDialogComponent;
  let fixture : ComponentFixture<CodesDialogComponent>;

  beforeEach(() => {
    TestBed.configureTestingModule({
      declarations: [CodesDialogComponent]
    });
    fixture = TestBed.createComponent(CodesDialogComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
