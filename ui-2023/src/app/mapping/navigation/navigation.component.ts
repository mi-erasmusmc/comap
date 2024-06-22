import { Component, Input } from '@angular/core';
import { AuthService } from '../auth.service';

@Component({
  selector: 'app-navigation',
  templateUrl: './navigation.component.html',
  styleUrls: ['./navigation.component.scss']
})
export class NavigationComponent {
  projects! : Promise<string[]>;
  @Input() project : string | null = null;
  public constructor(
    private auth : AuthService,
  ) {
    this.projects = auth.projects.then(pps => {
      let projects = Object.keys(pps).filter(p => p == "VAC4EU" || p == "Tests" || p == this.project);
      projects.sort();
      return projects;
    });
  }
}
