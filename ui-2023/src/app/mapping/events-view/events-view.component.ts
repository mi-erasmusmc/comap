import { Component } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { Title } from "@angular/platform-browser";
import { MatDialog, MatDialogRef } from '@angular/material/dialog';
import { environment } from '../../../environments/environment';
import { PersistencyService, ProjectPermissions } from '../persistency.service';
import { ApiService, ImportedMapping } from '../api.service';
import { Mapping, Start, StartType } from '../data';
import { AllTopics } from '../review';
import * as ops from '../mapping-ops';
import { ImportCsvDialogComponent } from '../import-csv-dialog/import-csv-dialog.component';

@Component({
  selector: 'app-events-view',
  templateUrl: './events-view.component.html',
  styleUrls: ['./events-view.component.scss']
})
export class EventsViewComponent {
  projectName! : string;
  newEventName : string = "";
  events : string[] = [];
  constructor(
    private api : ApiService,
    private persistency : PersistencyService,
    private route : ActivatedRoute,
    private router : Router,
    private title : Title,
    private dialog : MatDialog,
  ) { }
  ngOnInit() {

    this.route.params.subscribe(params => {
      this.projectName = params['project'];
      this.title.setTitle(`CodeMapper: Project ${this.projectName}`);
      this.persistency.mappings(this.projectName)
        .subscribe((events) => this.events = events);
    });
  }
  createNew(projectName : string, eventName : string) {
    if (!projectName || !eventName) {
      return;
    }
    this.api.vocabularies()
      .subscribe(vocs0 => {
        let vocabularies = Object.fromEntries(
          vocs0
            .filter(v => environment.defaultVocabularies.includes(v.id))
            .map(v => [v.id, v]));
        let mapping = new Mapping(null, vocabularies, {}, {}, null);
        let initial = { mapping };
        let path = ["project", projectName, 'event', eventName];
        this.router.navigate(path, { state: { initial } });
      });
  }
  importNew(projectName : string, eventName : string) {
    if (!projectName || !eventName) {
      return;
    }
    this.dialog.open(ImportCsvDialogComponent)
      .afterClosed()
      .subscribe(imported => {
        if (typeof (imported) == 'object') {
          let start : Start = {
            type: StartType.CsvImport,
            csvContent: imported.csvContent
          };
          let { vocabularies, concepts, codes, umlsVersion } = imported.mapping;
          let mapping = new Mapping(start, vocabularies, concepts, codes, umlsVersion);
          let allTopics = AllTopics.fromRaw(imported.allTopics, null, Object.keys(concepts));
          let initial = { mapping, allTopics };
          let path = ["project", projectName, 'event', eventName];
          this.router.navigate(path, { state: { initial } });
        }
      });
  }
}
