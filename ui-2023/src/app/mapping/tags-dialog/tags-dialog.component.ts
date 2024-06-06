import { NgFor, AsyncPipe, NgIf } from '@angular/common';
import { Observable } from 'rxjs';
import { map, startWith } from 'rxjs/operators';
import { MatButtonModule } from '@angular/material/button';
import { COMMA, ENTER } from '@angular/cdk/keycodes';
import { Component, Inject, ViewChild } from '@angular/core';
import { FormControl, FormsModule, ReactiveFormsModule } from '@angular/forms';
import { MatDialog, MatDialogRef, MatDialogModule, MAT_DIALOG_DATA } from '@angular/material/dialog';
import { MatAutocompleteSelectedEvent, MatAutocompleteModule } from '@angular/material/autocomplete';
import { MatChipInputEvent, MatChipsModule } from '@angular/material/chips';
import { MatIconModule } from '@angular/material/icon';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';

@Component({
  selector: 'mapping-tags-dialog',
  standalone: true,
  imports: [NgIf, MatInputModule, MatDialogModule, MatAutocompleteModule, MatChipsModule, FormsModule, ReactiveFormsModule, AsyncPipe, NgFor, MatButtonModule, MatIconModule, MatFormFieldModule],
  templateUrl: './tags-dialog.component.html',
  styleUrls: ['./tags-dialog.component.scss']
})
export class TagsDialogComponent {

  tag : string = "";
  availableTags : string[] = [];

  constructor(
    public dialogRef : MatDialogRef<TagsDialogComponent>,
    @Inject(MAT_DIALOG_DATA) public data : { availableTags : string[], tag : string | null }
  ) {
    this.tag = data.tag ?? '';
    this.availableTags = this.data.availableTags;
  }

  cancel() {
    this.dialogRef.close();
  }

  selected(event : MatAutocompleteSelectedEvent) : void {
    console.log("EVENT", event);
    this.tag = event.option.viewValue;
  }
}
