import { Component, Inject, Input, Output, EventEmitter } from '@angular/core';
import { MatDialog, MatDialogRef, MAT_DIALOG_DATA } from '@angular/material/dialog';
import { ConceptId, VocabularyId, CodeId } from '../data';
import { AllTopics, TopicsInfo, ReviewData, ReviewOperation } from '../review';

export interface ReviewsData {
  heading : string;
  cui : ConceptId | null;
  voc : VocabularyId | null;
  code : CodeId | null;
  allTopicsObj : { allTopics : AllTopics };
  data : ReviewData;
  userIsEditor : boolean;
  run : EventEmitter<ReviewOperation>;
}

@Component({
  selector: 'app-reviews-dialog',
  templateUrl: './reviews-dialog.component.html',
  styleUrls: ['./reviews-dialog.component.scss']
})
export class ReviewsDialogComponent {
  constructor(
    public dialogRef : MatDialogRef<ReviewsDialogComponent>,
    @Inject(MAT_DIALOG_DATA) public data : ReviewsData,
  ) { }
  getTopics() : TopicsInfo {
    let res = null;
    if (this.data.cui) {
      res = this.data.allTopicsObj.allTopics.byConcept[this.data.cui]
    } else if (this.data.voc && this.data.code) {
      res = this.data.allTopicsObj.allTopics.byCode[this.data.voc]?.[this.data.code];
    }
    return res ?? new TopicsInfo();
  }
  close() {
    this.dialogRef.close();
  }
}
