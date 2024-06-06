import { Injectable } from '@angular/core';
import {
  HttpRequest,
  HttpHandler,
  HttpInterceptor,
  HttpResponse
} from '@angular/common/http';
import { environment } from '../environments/environment';
import { finalize } from 'rxjs/operators';
import { LoadingService } from './loading.service';
import { of } from 'rxjs';

const IGNORED_URLS = [
  environment.apiUrl + "/code-mapper/autocomplete-code",
]

@Injectable()
export class LoadingInterceptor implements HttpInterceptor {
  private totalRequests = 0;

  constructor(private loadingService : LoadingService) { }

  intercept(request : HttpRequest<any>, next : HttpHandler) {
    if (IGNORED_URLS.some(url => request.url == url)) {
      return next.handle(request);
    } else {
      this.totalRequests++;
      setTimeout(() => this.loadingService.setLoading(true), 0);
      return next.handle(request).pipe(
        finalize(() => {
          this.totalRequests--;
          if (this.totalRequests === 0) {
            this.loadingService.setLoading(false);
          }
        })
      );
    }
  }
}
