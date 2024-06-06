import { Component, OnInit, ChangeDetectorRef, NgZone, ViewChild, TemplateRef } from '@angular/core';
import { Title } from "@angular/platform-browser";
import { Router, ActivatedRoute } from '@angular/router';
import { MatSnackBar } from '@angular/material/snack-bar';
import { MatDialog, MatDialogRef } from '@angular/material/dialog';
import { MatTabGroup } from '@angular/material/tabs';
import { HttpClient } from '@angular/common/http';
import { Subscription, Observable, map } from 'rxjs';
import { Start, StartType, Indexing, CsvImport, Vocabularies, Concept, Concepts, Codes, Mapping, Code, JSONObject, ConceptsCodes, Revision } from '../data';
import { AllTopics, AllTopics0, ReviewData } from '../review';
import * as ops from '../mapping-ops';
import { ApiService } from '../api.service';
import { PersistencyService } from '../persistency.service';
import { AuthService } from '../auth.service';
import { HasPendingChanges } from '../pending-changes.guard';
import { ReviewOperation } from '../review';
import { ImportCsvDialogComponent } from '../import-csv-dialog/import-csv-dialog.component';

enum Tabs {
  Start = 0,
  Concepts = 1,
  Codes = 2,
  Vocabularies = 3,
  Review = 4,
  Tools = 5,
  History = 6,
}

@Component({
  selector: 'app-mapping-view',
  templateUrl: './mapping-view.component.html',
  styleUrls: ['./mapping-view.component.scss']
})
export class MappingViewComponent implements HasPendingChanges {
  sub : Subscription | null = null;
  projectName! : string;
  mappingName! : string;
  viewName! : string;
  mapping : Mapping = Mapping.empty();
  version : number = -1;
  revisions : Revision[] = [];
  allTopics : AllTopics = new AllTopics();
  reviewData : ReviewData = new ReviewData();
  selectedIndex : number = 1;
  fresh : boolean = false; // never saved, keep reviews local

  constructor(
    private http : HttpClient,
    private route : ActivatedRoute,
    private router : Router,
    private cdr : ChangeDetectorRef,
    private ngZone : NgZone,
    private persistency : PersistencyService,
    private apiService : ApiService,
    private auth : AuthService,
    private title : Title,
    private dialog : MatDialog,
    private snackBar : MatSnackBar,
  ) { }

  hasPendingChanges() {
    return this.mapping.undoStack.length > 0;
  }

  ngOnInit() {
    this.sub = this.route.params.subscribe(params => {
      this.projectName = params['project'];
      this.mappingName = params['mapping'];
      this.title.setTitle(`CodeMapper: ${this.projectName} - ${this.mappingName}`);
      this.persistency.latestRevisionOrImportMapping(this.projectName, this.mappingName)
        .subscribe(
          ([version, mapping]) => {
            mapping.cleanupRecacheCheck()
            this.mapping = mapping;
            this.version = version;
            this.reloadReviews();
            this.reloadRevisions();
          },
          (err) => {
            console.warn("Could not load mapping, trying initial", err);
            let initial = this.router.lastSuccessfulNavigation?.extras.state?.['initial'];
            if (initial && initial.mapping instanceof Mapping) {
              this.setInitialMapping(initial.mapping as Mapping, initial.allTopics);
            } else {
              console.error("No predefined mapping");
              this.router.navigate(["project", this.projectName]);
            }
          }
        );
    });
  }

  setInitialMapping(mapping : Mapping, allTopics : any) {
    this.fresh = true;
    this.mapping = mapping;
    if (allTopics) {
      this.allTopics = allTopics;
    }
    if (mapping.start == null) {
      this.selectedIndex = 0;
    }
    this.updateMapping(this.mapping);
  }

  reloadReviews() {
    if (!this.fresh) {
      this.apiService.allTopics(this.projectName, this.mappingName)
        .subscribe(allTopics0 => {
          let me = this.auth.userSubject.value!.username;
          let cuis = Object.keys(this.mapping.concepts);
          this.allTopics = AllTopics.fromRaw(allTopics0, me, cuis)
        });
    }
  }


  reloadRevisions() {
    if (!this.fresh) {
      this.persistency.getRevisions(this.projectName, this.mappingName)
        .subscribe(revisions => this.revisions = revisions);
    }
  }

  ngOnDestroy() {
    if (this.sub != null) {
      this.sub.unsubscribe();
      this.sub = null;
    }
  }

  run(op : ops.Operation) {
    this.mapping.run(op);
    op.afterRunCallback();
    this.updateMapping(this.mapping);
    if (op.makesFresh) {
      this.fresh = true;
    }
  }

  redo() {
    this.mapping.redo();
    this.updateMapping(this.mapping);
  }

  undo() {
    this.mapping.undo();
    this.updateMapping(this.mapping);
  }

  updateMapping(mapping : Mapping) {
    if (this.allTopics != null) {
      this.allTopics.setConcepts(Object.keys(mapping.concepts));
    }
    this.mapping = mapping.clone();
  }

  reviewRun(op : ReviewOperation) {
    console.log("review run", op);
    op.run(this.apiService, this.projectName, this.mappingName)
      .subscribe(_ => {
        this.reloadReviews();
      });
  }

  dump() {
    console.log("MAPPING", this.mapping);
    console.log("ALL TOPICS", this.allTopics);
  }

  openDialog(templateRef : TemplateRef<any>) {
    let dialogRef = this.dialog.open(templateRef, {
      width: '700px'
    });
  }

  save(summary : string) {
    this.persistency.saveRevision(this.projectName, this.mappingName, this.mapping, summary)
      .subscribe(async version => {
        if (this.fresh) {
          try {
            await this.apiService.saveAllTopics(this.projectName, this.mappingName, this.allTopics.toRaw())
              .toPromise();
            this.fresh = false;
          } catch (err) {
            console.error("Could not save all review topics", err);
            this.snackBar.open("Could not save all review topics: " + err, "Close");
          }
        }
        this.snackBar.open("Saved revision", "Ok", { duration: 2000 });
        this.mapping!.undoStack = [];
        this.mapping!.redoStack = [];
        this.version = version;
        this.reloadRevisions();
      }, err => {
        console.error("Could not save revision", err);
        this.snackBar.open("Could not save revision: " + err.message, "Close");
      });
  }

  downloadJson(mapping : Mapping, project : string, event : string, descendants : boolean) {
    let url = new URL(this.apiService.downloadJsonUrl);
    url.searchParams.set('project', project);
    url.searchParams.set('caseDefinition', event);
    url.searchParams.set('includeDescendants', "" + descendants);
    url.searchParams.set('url', window.location.href);
    window.open(url, '_blank');
  }

  download(mapping : Mapping, project : string, event : string, descendants : boolean) {
    let url = new URL(this.apiService.downloadUrl);
    url.searchParams.set('project', project);
    url.searchParams.set('caseDefinition', event);
    url.searchParams.set('includeDescendants', "" + descendants);
    url.searchParams.set('url', window.location.href);
    window.open(url, '_blank');
  }

  undoTooltip() : string | undefined {
    if (this.mapping.undoStack.length == 0) {
      return;
    }
    return `Undo (${this.mapping.undoStack[0][0]})`
  }

  redoTooltip() : string | undefined {
    if (this.mapping.redoStack.length == 0) {
      return;
    }
    return `Redo (${this.mapping.redoStack[0][0]})`
  }

  async setStartIndexing(indexing : Indexing) {
    if (this.mapping.start === null) {
      let vocIds = Object.keys(this.mapping.vocabularies);
      await this.apiService.concepts(indexing.selected, vocIds)
        .subscribe(({ concepts, codes }) => {
          let op = new ops.SetStartIndexing(indexing, concepts, codes)
            .withAfterRunCallback(() => this.selectedIndex = 1);
          this.run(op);
        });
    }
  }
  isIndexing(start : Start) : start is Indexing {
    return start != null && start.type == StartType.Indexing
  }
  isCsvImport(start : Start) : start is CsvImport {
    return start != null && start.type == StartType.CsvImport
  }
}
