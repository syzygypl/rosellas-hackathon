import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';
import { AppVersion } from '../models/version.model';

@Injectable({ providedIn: 'root' })
export class VersionService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = `${environment.apiUrl}/version`;

  get(): Observable<AppVersion> {
    return this.http.get<AppVersion>(this.baseUrl);
  }
}
