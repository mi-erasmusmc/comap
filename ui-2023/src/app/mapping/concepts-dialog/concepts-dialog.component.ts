import { Component, Inject } from '@angular/core';
import { MatDialog, MatDialogRef, MAT_DIALOG_DATA } from '@angular/material/dialog';
import { Concept, ConceptId, VocabularyId, Code, CodeId } from '../data';

@Component({
  selector: 'app-concepts-dialog',
  templateUrl: './concepts-dialog.component.html',
  styleUrls: ['./concepts-dialog.component.scss']
})
export class ConceptsDialogComponent {
  constructor(
    public dialogRef : MatDialogRef<ConceptsDialogComponent>,
    @Inject(MAT_DIALOG_DATA) public data : {
      title : string,
      action : string,
      concepts : { [key : ConceptId] : Concept },
      codes : { [key : VocabularyId] : { [key : CodeId] : Code } },
      vocabularies : VocabularyId[]
    }
  ) { }

  cancel() {
    this.dialogRef.close();
  }
}
