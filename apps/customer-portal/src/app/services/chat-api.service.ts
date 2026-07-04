import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';
import { ChatRequest, ChatResult } from '../models/chat.model';

@Injectable({ providedIn: 'root' })
export class ChatApiService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = environment.apiUrl;

  chat(payload: ChatRequest): Observable<ChatResult> {
    return this.http.post<ChatResult>(`${this.baseUrl}/chat`, payload);
  }
}
