import { Inject, Component } from '@angular/core';
import { MatDialog, MatDialogRef, MAT_DIALOG_DATA } from '@angular/material/dialog';
import { Vocabulary } from '../data';

@Component({
  selector: 'mapping-vocabularies-dialog',
  templateUrl: './vocabularies-dialog.component.html',
  styleUrls: ['./vocabularies-dialog.component.scss']
})
export class VocabulariesDialogComponent {
  constructor(
    public dialogRef : MatDialogRef<VocabulariesDialogComponent>,
    @Inject(MAT_DIALOG_DATA) public data : {
      vocabularies : Vocabulary[]
    }
  ) { }

  cancel() {
    this.dialogRef.close();
  }
}
