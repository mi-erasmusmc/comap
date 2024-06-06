import { Input, Component, SimpleChanges, Output, EventEmitter } from '@angular/core';
import { MatDialog, MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { SelectionModel } from '@angular/cdk/collections';
import { ReviewsConceptDialogComponent } from '../reviews-concept-dialog/reviews-concept-dialog.component';
import { Concept, Vocabulary, VocabularyId, ConceptId, CodeId, Code } from '../data';
import { AllTopics, TopicsInfo, ReviewData, ReviewOperation } from '../review';
import { AuthService } from '../auth.service';

const BASE_COLUMNS = ["select", "concept", "tags", "review"];

function sortConcepts(c1 : Concept, c2 : Concept) : number {
  return (c1.name ?? "").localeCompare(c2.name ?? "");
}

@Component({
  selector: 'concepts-table',
  templateUrl: './concepts-table.component.html',
  styleUrls: ['./concepts-table.component.scss']
})
export class ConceptsTableComponent {
  @Input() concepts : { [key : ConceptId] : Concept } = {};
  @Input() allTopics! : AllTopics;
  @Input() codes : { [key : VocabularyId] : { [key : CodeId] : Code } } = {};
  @Input() vocabularies : VocabularyId[] = [];
  @Input() reviewData : ReviewData = new ReviewData();
  @Input() hideTagsColumn : boolean = false;
  @Input() hideReviewsColumn : boolean = false;
  @Input() disabled : boolean = false;
  @Input() showCodeTagIndication : boolean = false;
  @Output() reviewRun : EventEmitter<ReviewOperation> = new EventEmitter();
  @Output() selected : EventEmitter<Concept[]> = new EventEmitter();
  conceptsList : Concept[] = [];
  selection = new SelectionModel<Concept>(true, []);
  columns : string[] = [];

  // indirection to reviews to get updates in the review dialog
  allTopicsObj : { allTopics : AllTopics } = { allTopics: new AllTopics() };

  constructor(
    private dialog : MatDialog,
    private auth : AuthService,
  ) {
    this.selection.changed
      .subscribe(c => this.selected.emit(Array.from(this.selection.selected)))
  }

  ngOnChanges(changes : SimpleChanges) {
    if (changes['allTopics'] !== undefined) {
      this.allTopicsObj.allTopics = changes['allTopics'].currentValue;
    }
    this.columns = Object.assign([], BASE_COLUMNS);
    let off = 2;
    if (this.hideTagsColumn) {
      this.columns = this.columns.filter(c => c != "tags");
      off--;
    }
    if (this.hideReviewsColumn) {
      this.columns = this.columns.filter(c => c != "review");
      off--;
    }
    let vocIds = [...this.vocabularies];
    vocIds.sort((id1, id2) => id1.localeCompare(id2));
    for (let vocId of vocIds) {
      this.columns.splice(-off, 0, "codes-" + vocId);
    }
    for (const concept of this.selection.selected) {
      if (this.concepts[concept.id] === undefined) {
        this.selection.deselect(concept);
      }
    }
    this.conceptsList = Object.values(this.concepts);
    this.conceptsList.sort(sortConcepts);
  }

  isAllSelected() {
    return this.selection.selected.length == this.conceptsList.length;
  }

  toggleAllRows() {
    if (this.isAllSelected()) {
      this.selection.clear();
    } else {
      this.selectAll();
    }
  }

  selectAll() {
    this.conceptsList.forEach(row => this.selection.select(row));
  }

  setSelected(concepts : Concept[]) {
    this.selection.clear();
    for (let concept of concepts) {
      this.selection.select(concept);
    }
  }

  showReviews(cui : ConceptId) {
    const dialogRef = this.dialog.open(ReviewsConceptDialogComponent, {
      data: {
        heading: `Concept ${cui}: ${this.concepts[cui].name}`,
        cui,
        allTopicsObj: this.allTopicsObj,
        data: this.reviewData,
        userIsEditor: this.auth.userIsEditor,
        run: this.reviewRun,
      }
    });
    dialogRef.afterClosed().subscribe(res => { });
  }

  navigateToComments(id : ConceptId) {
  }
}
