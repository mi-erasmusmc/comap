import { Input } from '@angular/core';
import { Component } from '@angular/core';
import { Mapping, Revision } from '../data';


@Component({
  selector: 'history',
  templateUrl: './history.component.html',
  styleUrls: ['./history.component.scss']
})
export class HistoryComponent {
  @Input() mapping! : Mapping;
  @Input() revisions! : Revision[];
  @Input() version! : number;

  firstLine(summary : string) : string {
    return summary.split('\n')[0] ?? ""
  }
}
