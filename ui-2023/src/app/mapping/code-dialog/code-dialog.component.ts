import { Component, Inject, Input, Output, EventEmitter } from '@angular/core';
import { MatDialog, MatDialogRef, MAT_DIALOG_DATA } from '@angular/material/dialog';
import { Code, CodeId, ConceptId, Concept } from '../data';

export interface CodeDialogCode {
  id : string;
  term : string;
  concept : string;
}

export interface CodeDialogData {
  code : CodeDialogCode;
  operation : string;
  concepts : Concept[];
  codeIds : CodeId[];
  idEditable : boolean;
}

@Component({
  selector: 'mapping-code-dialog',
  templateUrl: './code-dialog.component.html',
  styleUrls: ['./code-dialog.component.scss'],
})
export class CodeDialogComponent {
  constructor(
    public dialogRef : MatDialogRef<CodeDialogComponent>,
    @Inject(MAT_DIALOG_DATA) public data : CodeDialogData,
  ) {
  }
  cancel() {
    this.dialogRef.close();
  }
  isValid() {
    console.log(this.data.codeIds, this.data.code.id, !this.data.codeIds.includes(this.data.code.id));
    return this.data.code.id &&
      this.data.code.term &&
      this.data.code.concept &&
      (!this.data.idEditable || !this.data.codeIds.includes(this.data.code.id));
  }
}
