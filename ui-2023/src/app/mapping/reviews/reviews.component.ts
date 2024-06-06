import { Input, Component, EventEmitter, Output, OnChanges, SimpleChanges } from '@angular/core';
import { ConceptId, Concept } from '../data';
import { ReviewData, TopicsByConcept, TopicsInfo, ReviewOperation, Refresh, MarkAsRead, ResolveTopic, NewMessage, NewTopic } from '../review';

@Component({
  selector: 'reviews',
  templateUrl: './reviews.component.html',
  styleUrls: ['./reviews.component.scss']
})
export class ReviewsComponent implements OnChanges {
  @Input() topics! : TopicsByConcept;
  @Input() concepts! : { [key : ConceptId] : Concept };
  @Input() inputDisabled! : boolean;
  @Input() userIsEditor! : boolean;
  @Input() data : ReviewData = new ReviewData();
  @Output() run = new EventEmitter<ReviewOperation>();
  ngOnChanges(changes : SimpleChanges) : void {
    let topics : ReviewData | undefined = changes['topics']?.currentValue;
    if (topics !== undefined) {
      for (let [id, info] of Object.entries(topics)) {
        this.data.newTopicHeading[id] ??= "";
        for (let topicId of Object.keys(info.topics)) {
          this.data.newMessageText[topicId] ??= "";
          this.data.topicShowMessages[topicId] ??= info.topics[topicId]!.resolved == null;
        }
      }
    }
  }
  refresh() {
    this.run.emit(new Refresh());
  }
  compareReview(o1 : { key : ConceptId, value : TopicsInfo }, o2 : { key : ConceptId, value : TopicsInfo }) {
    return o1.key.localeCompare(o2.key);
    // return (this.concepts[o1.key]?.name ?? "").localeCompare(this.concepts[o2.key]?.name ?? "");
  }
}
