import { CommonModule } from '@angular/common';
import {
  AfterViewChecked,
  Component,
  ElementRef,
  OnDestroy,
  ViewChild,
  computed,
  inject,
  signal,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';
import { HttpErrorResponse } from '@angular/common/http';
import { Subscription } from 'rxjs';
import { ChatMessage, ChatSolution } from './models/chat.model';
import { ChatApiService } from './services/chat-api.service';
import { VoiceApiService } from './services/voice-api.service';
import { VoiceCaptureService } from './services/voice-capture.service';
import { escapeHtml, renderMarkdownHtml, stripMarkdownToPlainText } from './markdown.util';

interface Bubble {
  cls: 'user' | 'bot';
  /** Source text (markdown for bot, plain for user) — kept for persistence. */
  raw: string;
  html: SafeHtml;
  solutionId?: number;
  /** Quick-reply options shown as buttons while this is the latest bubble. */
  suggestions?: string[];
  /** Marks the error notice that offers retrying the failed request. */
  retry?: boolean;
}

interface SolutionCard {
  id: number;
  engine: 'agent' | 'pipeline';
  sol: ChatSolution;
  reportHtml: SafeHtml | null;
  flash: boolean;
}

interface Toast {
  id: number;
  kind: 'info' | 'warning' | 'error';
  title: string;
  body: string;
}

/** Serializable snapshot of the conversation kept in sessionStorage. */
interface PersistedState {
  history: ChatMessage[];
  bubbles: Omit<Bubble, 'html'>[];
  solutions: { id: number; engine: 'agent' | 'pipeline'; sol: ChatSolution }[];
  nextId: number;
}

const STORAGE_KEY = 'triz-chat-state';

const GREETING =
  'Cześć! 👋 Opowiedz w 1–2 zdaniach, nad jakim problemem technicznym pracujesz. ' +
  'Dopytam o szczegóły, a gotowe rozwiązania TRIZ pojawią się w panelu obok. ' +
  'Możesz też kliknąć jeden z przykładów poniżej.';

/** Clickable example problems attached to the greeting. */
const EXAMPLE_PROBLEMS = [
  'Projektuję dron dostawczy: większy udźwig wymaga cięższych akumulatorów, które skracają czas lotu.',
  'Przyspieszenie cięcia laserem pogarsza jakość krawędzi detalu.',
  'Odchudzona obudowa urządzenia robi się zbyt wiotka i podatna na drgania.',
];

/** Rotating status lines shown next to the typing dots on long agent turns. */
const PROGRESS_STATUSES = [
  'Analizuję problem…',
  'Przeszukuję parametry i macierz sprzeczności TRIZ…',
  'Dobieram zasady wynalazcze…',
  'Piszę kartę rozwiązań…',
];
const PROGRESS_STEP_MS = 7000;

/** Voice-mode phases; the mic records only in 'listening'. */
type VoiceState = 'off' | 'listening' | 'transcribing' | 'thinking' | 'speaking';

const VOICE_STATE_LABELS: Record<Exclude<VoiceState, 'off'>, string> = {
  listening: 'Słucham…',
  transcribing: 'Rozpoznaję…',
  thinking: 'Myślę…',
  speaking: 'Mówię…',
};

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './app.component.html',
  styleUrl: './app.component.css',
})
export class AppComponent implements AfterViewChecked, OnDestroy {
  private readonly chatApi = inject(ChatApiService);
  private readonly voiceApi = inject(VoiceApiService);
  private readonly capture = inject(VoiceCaptureService);
  private readonly sanitizer = inject(DomSanitizer);

  @ViewChild('messagesBox') private messagesBox?: ElementRef<HTMLElement>;
  @ViewChild('composerInput') private composerInput?: ElementRef<HTMLTextAreaElement>;

  input = '';
  bubbles = signal<Bubble[]>([]);
  solutions = signal<SolutionCard[]>([]);
  toasts = signal<Toast[]>([]);
  loading = signal(false);
  loadingStatus = signal('');
  voiceState = signal<VoiceState>('off');
  voiceMode = computed(() => this.voiceState() !== 'off');
  sessionId = this.loadSessionId();

  /** Full conversation history, sent to the backend on every turn. */
  private history: ChatMessage[] = [];
  private nextId = 0;
  private nextToastId = 0;
  private shouldScroll = false;
  private statusTimer: ReturnType<typeof setInterval> | null = null;
  private player: HTMLAudioElement | null = null;
  private utteranceSub: Subscription | null = null;

  constructor() {
    if (!this.restore()) {
      this.bubbles.set([this.greetingBubble()]);
    }
  }

  ngAfterViewChecked(): void {
    if (this.shouldScroll && this.messagesBox) {
      const el = this.messagesBox.nativeElement;
      el.scrollTop = el.scrollHeight;
      this.shouldScroll = false;
    }
  }

  ngOnDestroy(): void {
    this.stopVoiceMode();
  }

  onEnter(event: Event): void {
    const keyboard = event as KeyboardEvent;
    if (!keyboard.shiftKey) {
      keyboard.preventDefault();
      this.send();
    }
  }

  send(): void {
    this.sendText(this.input);
  }

  sendSuggestion(text: string): void {
    this.sendText(text);
  }

  /** Re-send the request for the trailing user message after a failure. */
  retry(): void {
    if (this.loading()) {
      return;
    }
    this.dispatch();
  }

  /** Toggle hands-free voice mode; the click is the gesture that unlocks audio. */
  async toggleVoice(): Promise<void> {
    if (this.voiceMode()) {
      this.stopVoiceMode();
      return;
    }
    this.player ??= new Audio();
    this.player.play().catch(() => undefined); // unlock playback within the gesture
    try {
      await this.capture.enable();
    } catch {
      this.showToast(
        'error',
        'Tryb głosowy',
        'Brak dostępu do mikrofonu. Sprawdź uprawnienia przeglądarki i spróbuj ponownie.',
      );
      return;
    }
    this.utteranceSub = this.capture.utterance$.subscribe((blob) => this.onUtterance(blob));
    this.capture.startListening();
    this.voiceState.set('listening');
  }

  voiceStateLabel(): string {
    const state = this.voiceState();
    return state === 'off' ? '' : VOICE_STATE_LABELS[state];
  }

  private stopVoiceMode(): void {
    this.voiceState.set('off');
    this.utteranceSub?.unsubscribe();
    this.utteranceSub = null;
    this.capture.disable();
    if (this.player) {
      this.player.pause();
      this.player.removeAttribute('src');
    }
  }

  private onUtterance(blob: Blob): void {
    if (!this.voiceMode()) {
      return;
    }
    this.voiceState.set('transcribing');
    this.voiceApi.transcribe(blob).subscribe({
      next: ({ text }) => {
        const spoken = (text || '').trim();
        if (!spoken || this.loading()) {
          this.resumeListening();
          return;
        }
        this.voiceState.set('thinking');
        this.sendText(spoken);
      },
      error: (err: HttpErrorResponse) => {
        this.showToast('error', 'Tryb głosowy', this.errorDetail(err));
        // Without an OpenAI key every attempt fails the same way — leave voice mode.
        if (err.status === 503) {
          this.stopVoiceMode();
        } else {
          this.resumeListening();
        }
      },
    });
  }

  private speakAnswer(answer: string): void {
    const text = stripMarkdownToPlainText(answer);
    if (!text || !this.player) {
      this.resumeListening();
      return;
    }
    this.voiceState.set('speaking');
    this.voiceApi.speak(text).subscribe({
      next: (blob) => {
        if (!this.voiceMode() || !this.player) {
          return;
        }
        const url = URL.createObjectURL(blob);
        const player = this.player;
        const done = () => {
          URL.revokeObjectURL(url);
          this.resumeListening();
        };
        player.onended = done;
        player.onerror = done;
        player.src = url;
        player.play().catch(done);
      },
      error: () => {
        this.showToast('warning', 'Tryb głosowy', 'Nie udało się odczytać odpowiedzi na głos.');
        this.resumeListening();
      },
    });
  }

  private resumeListening(): void {
    if (!this.voiceMode()) {
      return;
    }
    this.capture.startListening();
    this.voiceState.set('listening');
  }

  resetChat(): void {
    if (this.loading()) {
      return;
    }
    if (this.voiceMode()) {
      this.player?.pause();
      this.resumeListening();
    }
    this.history = [];
    this.nextId = 0;
    this.input = '';
    this.solutions.set([]);
    this.bubbles.set([this.greetingBubble()]);
    sessionStorage.removeItem(STORAGE_KEY);
    this.focusComposer();
  }

  autoGrow(): void {
    const el = this.composerInput?.nativeElement;
    if (el) {
      el.style.height = 'auto';
      el.style.height = `${el.scrollHeight}px`; // CSS max-height caps it
    }
  }

  private sendText(raw: string): void {
    const text = raw.trim();
    if (!text || this.loading()) {
      return;
    }

    this.input = '';
    if (this.composerInput) {
      this.composerInput.nativeElement.style.height = 'auto';
    }
    this.history.push({ role: 'user', content: text });
    this.addBubble({ cls: 'user', raw: text, html: this.escape(text) });
    this.dispatch();
  }

  private dispatch(): void {
    this.loading.set(true);
    this.startProgress();

    this.chatApi.chat({ sessionId: this.sessionId, messages: [...this.history] }).subscribe({
      next: (result) => {
        this.finishRequest();
        this.history.push({
          role: 'assistant',
          content: result.answer || '',
          solved: Boolean(result.solution),
        });

        let solutionId: number | undefined;
        if (result.solution) {
          solutionId = this.addSolution(result.solution, result.engine);
        }
        if (result.warning) {
          this.showToast('warning', 'Konfiguracja OpenAI', result.warning);
        }
        const answer = result.answer || '(pusta odpowiedź)';
        this.addBubble({
          cls: 'bot',
          raw: answer,
          html: this.markdown(answer),
          solutionId,
          suggestions: result.suggestions?.filter((s) => s.trim()),
        });
        if (this.voiceMode()) {
          this.speakAnswer(answer);
        }
      },
      error: (err: HttpErrorResponse) => {
        this.finishRequest();
        this.showToast('error', 'Błąd żądania', this.errorDetail(err));
        // The user message stays in history, so the retry has full context.
        const notice = 'Nie udało się uzyskać odpowiedzi.';
        this.addBubble({ cls: 'bot', raw: notice, html: notice, retry: true });
        if (this.voiceMode()) {
          this.resumeListening();
        }
      },
    });
    this.shouldScroll = true;
  }

  private errorDetail(err: HttpErrorResponse): string {
    return typeof err.error === 'object' && err.error?.message
      ? String(err.error.message)
      : err.message;
  }

  private finishRequest(): void {
    this.loading.set(false);
    if (this.statusTimer) {
      clearInterval(this.statusTimer);
      this.statusTimer = null;
    }
    this.loadingStatus.set('');
    this.focusComposer();
  }

  private startProgress(): void {
    let step = 0;
    this.loadingStatus.set(PROGRESS_STATUSES[0]);
    this.statusTimer = setInterval(() => {
      step = Math.min(step + 1, PROGRESS_STATUSES.length - 1);
      this.loadingStatus.set(PROGRESS_STATUSES[step]);
    }, PROGRESS_STEP_MS);
  }

  private focusComposer(): void {
    setTimeout(() => this.composerInput?.nativeElement.focus());
  }

  private greetingBubble(): Bubble {
    return { cls: 'bot', raw: GREETING, html: GREETING, suggestions: [...EXAMPLE_PROBLEMS] };
  }

  scrollToSolution(id: number): void {
    const card = document.getElementById('sol-' + id);
    card?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    this.solutions.update((cards) =>
      cards.map((c) => ({ ...c, flash: c.id === id })),
    );
    setTimeout(
      () =>
        this.solutions.update((cards) =>
          cards.map((c) => ({ ...c, flash: false })),
        ),
      1500,
    );
  }

  dismissToast(id: number): void {
    this.toasts.update((toasts) => toasts.filter((t) => t.id !== id));
  }

  async copySessionId(): Promise<void> {
    try {
      await navigator.clipboard.writeText(this.sessionId);
    } catch {
      const input = document.createElement('input');
      input.value = this.sessionId;
      input.style.position = 'fixed';
      input.style.opacity = '0';
      document.body.appendChild(input);
      input.select();
      document.execCommand('copy');
      input.remove();
    }
    this.showToast('info', 'Session id copied', this.sessionId);
  }

  engineLabel(engine: 'agent' | 'pipeline'): string {
    return engine === 'agent' ? '🤖 agent' : '⚙️ pipeline';
  }

  private addBubble(bubble: Bubble): void {
    this.bubbles.update((bubbles) => [...bubbles, bubble]);
    this.shouldScroll = true;
    this.persist();
  }

  private addSolution(sol: ChatSolution, engine: 'agent' | 'pipeline'): number {
    const id = ++this.nextId;
    const card: SolutionCard = {
      id,
      engine,
      sol,
      reportHtml: sol.report ? this.markdown(sol.report) : null,
      flash: true,
    };
    this.solutions.update((cards) => [card, ...cards]);
    setTimeout(
      () =>
        this.solutions.update((cards) =>
          cards.map((c) => (c.id === id ? { ...c, flash: false } : c)),
        ),
      1500,
    );
    return id;
  }

  private persist(): void {
    try {
      const state: PersistedState = {
        history: this.history,
        bubbles: this.bubbles().map(({ html, ...rest }) => rest),
        solutions: this.solutions().map(({ id, engine, sol }) => ({ id, engine, sol })),
        nextId: this.nextId,
      };
      sessionStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch {
      // Persistence is best-effort; a full or blocked storage must not break the chat.
    }
  }

  private restore(): boolean {
    try {
      const json = sessionStorage.getItem(STORAGE_KEY);
      if (!json) {
        return false;
      }
      const state = JSON.parse(json) as PersistedState;
      if (!Array.isArray(state?.history) || !Array.isArray(state?.bubbles) || !state.bubbles.length) {
        return false;
      }
      this.history = state.history;
      this.nextId = state.nextId || 0;
      this.bubbles.set(
        state.bubbles.map((b) => ({
          ...b,
          html: b.cls === 'user' ? this.escape(b.raw) : this.markdown(b.raw),
        })),
      );
      this.solutions.set(
        (state.solutions ?? []).map((c) => ({
          ...c,
          reportHtml: c.sol.report ? this.markdown(c.sol.report) : null,
          flash: false,
        })),
      );
      this.shouldScroll = true;
      return true;
    } catch {
      return false;
    }
  }

  private showToast(kind: Toast['kind'], title: string, body: string): void {
    const id = ++this.nextToastId;
    this.toasts.update((toasts) => [...toasts, { id, kind, title, body }]);
    setTimeout(() => this.dismissToast(id), kind === 'error' ? 14000 : 10000);
  }

  private loadSessionId(): string {
    const key = 'rosellas-chat-session-id';
    const existing = sessionStorage.getItem(key);
    if (existing) return existing;
    const id =
      typeof crypto !== 'undefined' && 'randomUUID' in crypto
        ? crypto.randomUUID()
        : `session-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
    sessionStorage.setItem(key, id);
    return id;
  }

  private escape(value: string): string {
    return escapeHtml(value);
  }

  private markdown(value: string): SafeHtml {
    // Safe: renderMarkdownHtml escapes the source before adding its own tags.
    return this.sanitizer.bypassSecurityTrustHtml(renderMarkdownHtml(value));
  }
}
