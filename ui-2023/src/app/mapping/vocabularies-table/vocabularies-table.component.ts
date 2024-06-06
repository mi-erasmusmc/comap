import { Input, Component } from '@angular/core';
import { Vocabulary } from '../data';
import { SelectionModel } from '@angular/cdk/collections';

@Component({
  selector: 'vocabularies-table',
  templateUrl: './vocabularies-table.component.html',
  styleUrls: ['./vocabularies-table.component.scss']
})
export class VocabulariesTableComponent {
  @Input() vocabularies : Vocabulary[] = [];
  public selection = new SelectionModel<Vocabulary>(true, []);

  columns : string[] = ['select', 'id', 'name', 'version'];

  isAllSelected() {
    return this.selection.selected.length == this.vocabularies.length;
  }

  idTooltip(voc : Vocabulary) : string {
    if (voc.custom) {
      return "Custom vocabulary";
    } else {
      return "";
    }
  }

  toggleAllRows() {
    if (this.isAllSelected()) {
      this.selection.clear();
    } else {
      this.vocabularies.forEach(row => this.selection.select(row));
    }
  }
}
