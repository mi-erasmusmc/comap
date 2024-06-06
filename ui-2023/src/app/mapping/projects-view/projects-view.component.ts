import { Component } from '@angular/core';
import { Router } from '@angular/router';
import { PersistencyService, ProjectPermissions } from '../persistency.service';
import { Mapping } from '../data';
import { ApiService, ImportedMapping } from '../api.service';
import { AuthService } from '../auth.service';
import { environment } from '../../../environments/environment';
import { MatDialog } from '@angular/material/dialog';
import * as ops from '../mapping-ops';

const DEFAULT_VOCABULARIES = ["ICD10CM", "SNOMEDCT_US"];

@Component({
  selector: 'app-projects-view',
  templateUrl: './projects-view.component.html',
  styleUrls: ['./projects-view.component.scss']
})
export class ProjectsViewComponent {
  mappings : { [key : string] : String[] } = {};
  projectPermissions : { [key : string] : Set<ProjectPermissions> } | null = null;
  newNames : { [key : string] : string } = {};
  constructor(
    private persistency : PersistencyService,
    private api : ApiService,
    private auth : AuthService,
    private router : Router,
    private dialog : MatDialog
  ) {
    persistency.projectPermissions().subscribe((pp) => {
      this.projectPermissions = pp;
      this.mappings = {};
      for (let project of Object.keys(pp)) {
      }
    });
  }
}
