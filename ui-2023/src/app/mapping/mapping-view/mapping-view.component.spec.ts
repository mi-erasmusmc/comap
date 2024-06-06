import { ComponentFixture, TestBed } from '@angular/core/testing';

import { MappingViewComponent } from './mapping-view.component';

describe('MappingViewComponent', () => {
  let component : MappingViewComponent;
  let fixture : ComponentFixture<MappingViewComponent>;

  beforeEach(() => {
    TestBed.configureTestingModule({
      declarations: [MappingViewComponent]
    });
    fixture = TestBed.createComponent(MappingViewComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
