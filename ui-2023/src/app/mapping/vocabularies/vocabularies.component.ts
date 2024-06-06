import { Input, Output, Component, SimpleChanges, EventEmitter, ViewChild } from '@angular/core';
import { MatDialog, MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { map } from 'rxjs';
import { VocabulariesDialogComponent } from '../vocabularies-dialog/vocabularies-dialog.component';
import { VocabulariesTableComponent } from '../vocabularies-table/vocabularies-table.component';
import { CustomVocabularyDialogComponent } from '../custom-vocabulary-dialog/custom-vocabulary-dialog.component';
import { ApiService } from '../api.service';
import { Concept, Mapping, Code, Vocabulary } from '../data';
import * as ops from '../mapping-ops';

@Component({
  selector: 'mapping-vocabularies',
  templateUrl: './vocabularies.component.html',
  styleUrls: ['./vocabularies.component.scss']
})
export class VocabulariesComponent {
  @Input() mapping : Mapping | null = null;
  @Output() run = new EventEmitter<ops.Operation>();
  @ViewChild('table') table! : VocabulariesTableComponent;
  vocabularies : Vocabulary[] = [];

  constructor(
    private dialog : MatDialog,
    private api : ApiService) { }

  ngOnChanges(changes : SimpleChanges) {
    if (this.mapping == null) {
      this.vocabularies = [];
    } else {
      this.vocabularies = Object.values(this.mapping.vocabularies);
      this.vocabularies.sort(Vocabulary.compare);
    }
  }

  delete(vocs : Vocabulary[]) {
    this.run.emit(new ops.DeleteVocabularies(vocs.map(v => v.id)))
    this.table.selection.clear();
  }

  addStandard() {
    let vocIds = new Set(this.vocabularies.map(v => v.id));
    this.api.vocabularies()
      .pipe(map(vocs => {
        return vocs.filter(v => !vocIds.has(v.id))
      }))
      .subscribe(vocs => {
        vocs.sort(Vocabulary.compare);
        return this.dialog.open(VocabulariesDialogComponent, { data: { vocabularies: vocs } })
          .afterClosed().subscribe(vocs => {
            if (vocs != null) {
              let cuis = Object.keys(this.mapping!.concepts);
              let vocIds = (vocs as Vocabulary[]).map(v => v.id);
              this.api.concepts(cuis, vocIds)
                .subscribe(({ concepts, codes }) => {
                  let conceptCodes =
                    Object.fromEntries(
                      Object.entries(concepts)
                        .map(([cui, concept]) =>
                          [cui, Object.fromEntries(
                            Object.entries(concept.codes)
                              .map(([vocId, codeIds]) => [vocId, Array.from(codeIds)]))]));
                  let codes1 =
                    Object.fromEntries(
                      Object.entries(codes)
                        .map(([vocId, codes]) => [vocId, Object.values(codes)]));
                  this.run.emit(new ops.AddVocabularies(vocs, codes1, conceptCodes));
                })
            }
          })
      })
  }

  createCustom() {
    this.dialog.open(CustomVocabularyDialogComponent, { data: { id: "", name: "", codesCSV: "" } })
      .afterClosed().subscribe(data => {
        let voc = new Vocabulary(data.id, data.name, null, true)
        this.run.emit(new ops.AddVocabularies([voc], {}, {}));
      })
  }
}
