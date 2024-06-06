import { Component, Inject } from '@angular/core';
import { MatDialog, MatDialogRef, MAT_DIALOG_DATA } from '@angular/material/dialog';
import { ApiService } from '../api.service';

@Component({
  selector: 'import-csv-dialog',
  templateUrl: './import-csv-dialog.component.html',
  styleUrls: ['./import-csv-dialog.component.scss']
})
export class ImportCsvDialogComponent {
  csvImportFile : File | null = null;
  constructor(
    private api : ApiService,
    public dialogRef : MatDialogRef<ImportCsvDialogComponent>,
    // @Inject(MAT_DIALOG_DATA) public data : {
    //   title : string,
    //   action : string,
    //   concepts : { [key : ConceptId] : Concept },
    //   codes : { [key : VocabularyId] : { [key : CodeId] : Code } },
    //   vocabularies : VocabularyId[]
    // }
  ) { }

  handleCsvFileInput(event : Event) {
    const input = event.target as HTMLInputElement;
    this.csvImportFile = null;
    if (input.files) {
      if (input.files.length == 1) {
        this.csvImportFile = input.files[0];
      }
    }
  }

  unsetCsvImportFile() {
    this.csvImportFile = null;
  }

  importCsv(file : File) {
    this.api.importCsv(file, [])
      .subscribe(
        (imported) => {
          if (imported.warnings.length) {
            let msg = "There were problems with the import: " +
              imported.warnings.map(s => `${s}. `).join("") +
              "Continue?";
            if (!confirm(msg)) {
              return;
            }
          }
          this.dialogRef.close(imported);
        },
        (error) => alert(error),
      );
    this.unsetCsvImportFile();
  }
}
