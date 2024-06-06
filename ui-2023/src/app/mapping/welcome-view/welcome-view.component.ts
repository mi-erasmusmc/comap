import { Component } from '@angular/core';
import { VersionInfo, EMPTY_VERSION_INFO } from '../data';
import { AuthService, User } from '../auth.service';
import { ApiService } from '../api.service';
import { environment } from '../../../../src/environments/environment';

@Component({
  selector: 'app-welcome-view',
  templateUrl: './welcome-view.component.html',
  styleUrls: ['./welcome-view.component.scss']
})
export class WelcomeViewComponent {
  user : User | null = null;
  info : VersionInfo = EMPTY_VERSION_INFO;
  constructor(
    private auth : AuthService,
    private api : ApiService,
  ) {
    this.auth.userSubject.subscribe(user => this.user = user);
    this.api.versionInfo().subscribe(info => this.info = info);
  }
}
