import { ViewChild, Component, Input, Output, EventEmitter, SimpleChanges } from '@angular/core';
import { MatDialog } from '@angular/material/dialog';
import { NgFor } from '@angular/common';
import { MatTable } from '@angular/material/table';
import { SelectionModel } from '@angular/cdk/collections';
import { Mapping, Code, Concept, CodeId, Vocabulary, VocabularyId, ConceptId, Tag, tagsInCodes, tagsInConcepts } from '../data';
import * as ops from '../mapping-ops';
import { AllTopics, TopicsInfo, ReviewData, ReviewOperation } from '../review';
import { AuthService } from '../auth.service';

import { ReviewsConceptDialogComponent } from '../reviews-concept-dialog/reviews-concept-dialog.component';
import { CodeDialogComponent } from '../code-dialog/code-dialog.component';
import { TagsDialogComponent } from '../tags-dialog/tags-dialog.component';

function compareCodes(c1 : Code, c2 : Code) : number {
  return c1.id.localeCompare(c2.id);
}

@Component({
  selector: 'mapping-codes',
  templateUrl: './codes.component.html',
  styleUrls: ['./codes.component.scss'],
})
export class CodesComponent {
  vocabularyId! : VocabularyId;
  @Input() mapping! : Mapping;
  @Input() allTopics! : AllTopics;
  @Input() reviewData : ReviewData = new ReviewData();
  @Output() run = new EventEmitter<ops.Operation>();
  @Output() reviewRun : EventEmitter<ReviewOperation> = new EventEmitter();
  @ViewChild(MatTable) table! : MatTable<any>;

  columns : string[] = ["select", "code", "tag", "concepts", "comments"];
  selectedCodes = new SelectionModel<Code>(true, []);
  vocabulary! : Vocabulary;
  codes : Code[] = [];
  vocabularyIds : VocabularyId[] = [];
  // indirection to reviews to get updates in the review dialog
  allTopicsObj : { allTopics : AllTopics } = { allTopics: new AllTopics() };

  constructor(
    public dialog : MatDialog,
    private auth : AuthService,
  ) { }

  ngOnChanges(changes : SimpleChanges) {
    if (changes['allTopics'] !== undefined) {
      this.allTopicsObj.allTopics = changes['allTopics'].currentValue;
    }
    if (this.mapping.vocabularies) {
      let vocIds = Object.keys(this.mapping.vocabularies);
      vocIds.sort((id1, id2) => id1.localeCompare(id2));
      this.vocabularyId = vocIds[0];
    }
    this.update();
  }

  update() {
    let codes = this.mapping.codes[this.vocabularyId] ?? {};
    this.vocabulary = this.mapping.vocabularies[this.vocabularyId];
    this.codes = Object.values(codes);
    this.codes.sort(compareCodes);
    this.vocabularyIds = Object.keys(this.mapping.vocabularies).sort();
  }

  selectVocabulary(id : VocabularyId) {
    this.vocabularyId = id;
    this.update();
  }

  isCustom(id : VocabularyId) {
    return this.mapping.vocabularies[id].custom;
  }

  conceptIds(code : Code) : ConceptId[] {
    return Array.from(this.mapping.conceptsByCode[this.vocabularyId]?.[code.id] ?? []);
  }

  conceptName(id : ConceptId) : string {
    return this.mapping.concepts[id]?.name ?? "n/a"
  }

  conceptTag(id : ConceptId) : Tag | null {
    return this.mapping.concepts[id].tag;
  }

  isAllSelected() {
    const numSelected = this.selectedCodes.selected.length;
    const numRows = this.codes.length;
    return numSelected == numRows;
  }

  toggleSelectAll() {
    if (this.isAllSelected()) {
      this.selectedCodes.clear();
    } else {
      this.codes.forEach(row => this.selectedCodes.select(row));
    }
  }

  selectAllCustomCodes() {
    this.selectedCodes.clear();
    for (let code of this.codes) {
      if (code.custom) {
        this.selectedCodes.select(code);
      }
    }
  }

  enableCodes(codes : Code[]) {
    for (let code of codes) {
      this.run.emit(new ops.SetCodeEnabled(this.vocabularyId, code.id, true));
    }
  }

  disableCodes(codes : Code[]) {
    for (let code of codes) {
      this.run.emit(new ops.SetCodeEnabled(this.vocabularyId, code.id, false));
    }
  }

  editTags(codes : Code[]) {
    let tag = null;
    if (codes.length == 1) {
      tag = codes[0].tag;
    }
    let availableTags = this.mapping.allTags();
    let options = {
      data: { availableTags, tag },
      width: '40em',
    };
    this.dialog.open(TagsDialogComponent, options)
      .afterClosed().subscribe(tag => {
        if (tag !== undefined) {
          let codeIds = Object.fromEntries(codes.map((code) => [code.id, tag]));
          this.run.emit(new ops.CodesSetTag(this.vocabularyId, codeIds))
        }
      });
  }

  oneOrMoreCustomCodes(codes : Code[]) : boolean {
    return codes.length > 0 && codes.every(c => c.custom)
  }

  addCustomCodeDialog() {
    const dialogRef = this.dialog.open(CodeDialogComponent, {
      data: {
        code: {
          id: "",
          term: "",
          concept: "",
        },
        operation: "Add",
        concepts: Object.values(this.mapping.concepts),
        codeIds: Object.keys(this.mapping.codes[this.vocabularyId]),
        idEditable: true,
      }
    });
    dialogRef.afterClosed().subscribe(data => {
      if (data !== undefined) {
        let code = new Code(data.id, data.term, true, true, null);
        let concept = data.concept || null;
        this.run.emit(new ops.AddCustomCode(this.vocabularyId, code, concept));
      }
    });
  }

  editCustomCodeDialog() {
    if (this.selectedCodes.selected.length != 1) {
      console.error("edit custom code only possible with one selected code");
      return;
    }
    let selected = this.selectedCodes.selected[0];
    if (!selected.custom) {
      console.error("edit custom code only possible with custom code");
      return;
    }
    let concepts = this.mapping.getConceptsByCode(this.vocabularyId, selected.id);
    if (concepts.length != 1) {
      console.error("custom code must have exactly one concept");
      return;
    }
    const dialogRef = this.dialog.open(CodeDialogComponent, {
      data: {
        code: {
          id: selected.id,
          term: selected.term,
          concept: concepts[0],
        },
        operation: "Save",
        concepts: Object.values(this.mapping.concepts),
        codeIds: Object.keys(this.mapping.codes[this.vocabularyId]),
        idEditable: false,
      }
    });
    dialogRef.afterClosed().subscribe(data => {
      if (data !== undefined) {
        let code = new Code(data.id, data.term, selected.custom, selected.enabled, selected.tag);
        this.run.emit(new ops.EditCustomCode(this.vocabularyId, selected.id, code, data.concept));
        this.selectedCodes.clear();
      }
    });
  }

  getTopics(codeId : CodeId) {
    return (this.allTopics ?? new AllTopics())
      ?.byCode[this.vocabularyId]?.[codeId] ?? new TopicsInfo();
  }

  showReviews(code : CodeId) {
    let codeName = this.mapping.codes[this.vocabularyId]?.[code]?.term ?? "unknown";
    const dialogRef = this.dialog.open(ReviewsConceptDialogComponent, {
      data: {
        heading: `Code ${code}: ${codeName}`,
        voc: this.vocabularyId,
        code: code,
        allTopicsObj: this.allTopicsObj,
        data: this.reviewData,
        userIsEditor: this.auth.userIsEditor,
        run: this.reviewRun,
      }
    });
    dialogRef.afterClosed().subscribe(res => {
      console.log("REVIEWED", res);
    });
  }

  conceptTooltip(concept : Concept) : string {
    if (concept.tag) {
      return `Tag: ${concept.tag}`;
    } else {
      return "";
    }
  }

  importCustomCodeDialog() {
  }
}
