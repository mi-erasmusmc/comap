import { Component, Input } from '@angular/core';

import { Concept } from '../data';

@Component({
  selector: 'mapping-concept',
  templateUrl: './concept.component.html',
  styleUrls: ['./concept.component.scss']
})
export class ConceptComponent {
  @Input() concept! : Concept;
  @Input() showTag : boolean = false;
}
