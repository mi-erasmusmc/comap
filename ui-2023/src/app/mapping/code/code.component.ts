import { Input } from '@angular/core';
import { Component } from '@angular/core';
import { Code } from '../data';

@Component({
  selector: 'mapping-code',
  templateUrl: './code.component.html',
  styleUrls: ['./code.component.scss']
})
export class CodeComponent {
  @Input() code : Code = Code.empty(false);
  @Input() showTagIndication : boolean = false;
  @Input() showTerm : boolean = true;
  tooltipContent() : string {
    let l = [this.code.term]
    if (this.code.tag != null) {
      l.push(`tag: ${this.code.tag}`);
    }
    if (this.code.custom) {
      l.push("custom code");
    }
    return l.join(", ");
  }
}
