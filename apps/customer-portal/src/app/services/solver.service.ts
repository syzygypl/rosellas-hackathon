import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';
import { SolveRequest, SolveResult } from '../models/solve.model';

@Injectable({ providedIn: 'root' })
export class SolverService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = environment.apiUrl;

  solve(payload: SolveRequest): Observable<SolveResult> {
    return this.http.post<SolveResult>(`${this.baseUrl}/solve`, payload);
  }
}
