import { ComponentFixture, TestBed } from '@angular/core/testing';

import { ImportCsvDialogComponent } from './import-csv-dialog.component';

describe('ImportCsvDialogComponent', () => {
  let component : ImportCsvDialogComponent;
  let fixture : ComponentFixture<ImportCsvDialogComponent>;

  beforeEach(() => {
    TestBed.configureTestingModule({
      declarations: [ImportCsvDialogComponent]
    });
    fixture = TestBed.createComponent(ImportCsvDialogComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
