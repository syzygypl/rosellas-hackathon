import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';
import {
  CreateItemPayload,
  Item,
  UpdateItemPayload,
} from '../models/item.model';

@Injectable({ providedIn: 'root' })
export class ItemsService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = `${environment.apiUrl}/items`;

  list(): Observable<Item[]> {
    return this.http.get<Item[]>(this.baseUrl);
  }

  create(payload: CreateItemPayload): Observable<Item> {
    return this.http.post<Item>(this.baseUrl, payload);
  }

  update(id: string, payload: UpdateItemPayload): Observable<Item> {
    return this.http.patch<Item>(`${this.baseUrl}/${id}`, payload);
  }

  delete(id: string): Observable<{ deleted: boolean }> {
    return this.http.delete<{ deleted: boolean }>(`${this.baseUrl}/${id}`);
  }
}
