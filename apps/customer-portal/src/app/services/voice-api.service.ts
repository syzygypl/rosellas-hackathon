import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';

/** Filename hint OpenAI uses to detect the container of the uploaded audio. */
function filenameForBlob(type: string): string {
  const base = (type || '').split(';')[0];
  if (base === 'audio/mp4') return 'speech.mp4';
  if (base === 'audio/ogg') return 'speech.ogg';
  return 'speech.webm';
}

@Injectable({ providedIn: 'root' })
export class VoiceApiService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = environment.apiUrl;

  transcribe(audio: Blob): Observable<{ text: string }> {
    const form = new FormData();
    form.append('audio', audio, filenameForBlob(audio.type));
    return this.http.post<{ text: string }>(`${this.baseUrl}/voice/transcribe`, form);
  }

  speak(text: string): Observable<Blob> {
    return this.http.post(`${this.baseUrl}/voice/speak`, { text }, { responseType: 'blob' });
  }
}
