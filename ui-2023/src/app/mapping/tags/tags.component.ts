import { Component, Input } from '@angular/core';

@Component({
  selector: 'mapping-tag',
  templateUrl: './tags.component.html',
  styleUrls: ['./tags.component.scss']
})
export class TagsComponent {
  @Input() tag! : string;
}
