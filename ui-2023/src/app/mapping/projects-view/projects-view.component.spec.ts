import { ComponentFixture, TestBed } from '@angular/core/testing';

import { ProjectsViewComponent } from './projects-view.component';

describe('ProjectsViewComponent', () => {
  let component : ProjectsViewComponent;
  let fixture : ComponentFixture<ProjectsViewComponent>;

  beforeEach(() => {
    TestBed.configureTestingModule({
      declarations: [ProjectsViewComponent]
    });
    fixture = TestBed.createComponent(ProjectsViewComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
