import { Component, Injectable } from '@angular/core';
import { LoadingService } from './loading.service';

@Component({
  selector: 'app-root',
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.scss']
})
@Injectable({
  providedIn: 'root'
})
export class AppComponent {
  title = 'ui-2023';
  constructor(public loadingService : LoadingService) { }
}
