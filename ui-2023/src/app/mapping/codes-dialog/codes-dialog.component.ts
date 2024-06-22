import { Component, Inject } from '@angular/core';
import { MatDialog, MatDialogRef, MAT_DIALOG_DATA } from '@angular/material/dialog';
import { Mapping, Code, CodeId, VocabularyId } from '../data';

export interface CodesDialogData {
  title : string;
  mapping : Mapping;
  codes : Code[];
  codeParents : { [key : CodeId] : Set<CodeId> };
  vocabularyId : VocabularyId;
}

@Component({
  selector: 'codes-dialog',
  templateUrl: './codes-dialog.component.html',
  styleUrls: ['./codes-dialog.component.scss']
})
export class CodesDialogComponent {
  constructor(
    public dialogRef : MatDialogRef<CodesDialogComponent>,
    @Inject(MAT_DIALOG_DATA) public data : CodesDialogData,
  ) { }

  close() {
    this.dialogRef.close();
  }
}
