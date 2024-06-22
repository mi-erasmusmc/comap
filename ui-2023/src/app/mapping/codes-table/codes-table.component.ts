import { Input, Output, Component, SimpleChanges, EventEmitter } from '@angular/core';
import { MatDialog } from '@angular/material/dialog';
import { SelectionModel } from '@angular/cdk/collections';
import { ReviewsDialogComponent } from '../reviews-dialog/reviews-dialog.component';
import { Code, CodeId, Concept, ConceptId, Mapping, VocabularyId } from '../data';
import { AllTopics, TopicsInfo, ReviewOperation, ReviewData } from '../review';
import { AuthService } from '../auth.service';

@Component({
  selector: 'codes-table',
  templateUrl: './codes-table.component.html',
  styleUrls: ['./codes-table.component.scss']
})
export class CodesTableComponent {
  @Input() vocabularyId! : VocabularyId;
  @Input() mapping : Mapping = Mapping.empty();
  @Input() codes : Code[] = [];
  @Input() codeParents : null | { [key : CodeId] : Set<CodeId> } = null;
  @Input() showConcepts : boolean = true;
  @Input() showTags : boolean = true;
  @Input() allTopics : AllTopics | null = null;
  @Input() reviewData : ReviewData | null = null;
  @Output() reviewRun : EventEmitter<ReviewOperation> = new EventEmitter();
  @Output() selected : EventEmitter<Code[]> = new EventEmitter();

  columns : string[] = [];
  selectedCodes = new SelectionModel<Code>(true, []);
  allTopicsObj : { allTopics : AllTopics } = { allTopics: new AllTopics() };

  constructor(
    public dialog : MatDialog,
    private auth : AuthService,
  ) {
    this.selectedCodes.changed
      .subscribe(s => this.selected.emit(s.source.selected));
  }

  ngOnChanges(changes : SimpleChanges) {
    if (changes['allTopics'] !== undefined) {
      this.allTopicsObj.allTopics = changes['allTopics'].currentValue;
    }
    if (changes['vocabularyId']) {
      setTimeout(() => this.selectedCodes.clear(), 0);
    }
    let tag = this.showTags ? ["tag"] : [];
    let parents = this.codeParents == null ? [] : ["parents"];
    let concepts = this.showConcepts ? ["concepts"] : [];
    let comments = this.allTopics == null ? [] : ["comments"];
    this.columns = [["select", "code"], concepts, parents, tag, comments].flat();
  }

  conceptTooltip(concept : Concept) : string {
    if (concept.tag) {
      return `Tag: ${concept.tag}`;
    } else {
      return "";
    }
  }

  topics(codeId : CodeId) {
    return this.allTopics?.byCode[this.vocabularyId]?.[codeId] ?? new TopicsInfo();
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

  unselect(code : Code) {
    this.selectedCodes.deselect(code);
  }

  parents(id : CodeId) : Code[] {
    let codes = this.mapping.codes[this.vocabularyId];
    return Array.from(this.codeParents?.[id] ?? [])
      .map(id => codes[id])
      .filter(c => c != null);
  }

  codeConcepts(id : CodeId) : ConceptId[] {
    return Array.from(this.mapping.conceptsByCode[this.vocabularyId]?.[id] ?? []);
  }

  selectAllCustomCodes() {
    this.selectedCodes.clear();
    for (let code of this.codes) {
      if (code.custom) {
        this.selectedCodes.select(code);
      }
    }
  }

  showReviews(code : CodeId) {
    if (this.mapping != null) {
      let codeName = this.mapping.codes[this.vocabularyId]?.[code]?.term ?? "unknown";
      this.dialog.open(ReviewsDialogComponent, {
        data: {
          heading: `Review of code ${code}: ${codeName}`,
          voc: this.vocabularyId,
          code: code,
          allTopicsObj: this.allTopicsObj,
          data: this.reviewData,
          userIsEditor: this.auth.userIsEditor,
          run: this.reviewRun,
        }
      });
    }
  }
}
