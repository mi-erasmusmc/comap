import { Inject, Component } from '@angular/core';
import { MatDialog, MatDialogRef, MAT_DIALOG_DATA } from '@angular/material/dialog';
import { VocabularyId } from '../data';

@Component({
  selector: 'app-custom-vocabulary-dialog',
  templateUrl: './custom-vocabulary-dialog.component.html',
  styleUrls: ['./custom-vocabulary-dialog.component.scss']
})
export class CustomVocabularyDialogComponent {
  constructor(
    public dialogRef : MatDialogRef<CustomVocabularyDialogComponent>,
    @Inject(MAT_DIALOG_DATA) public data : {
      id : VocabularyId,
      name : string,
    }
  ) { }
  cancel() {
    this.dialogRef.close();
  }
}
