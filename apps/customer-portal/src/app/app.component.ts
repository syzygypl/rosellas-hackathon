import { CommonModule } from '@angular/common';
import {
  AfterViewChecked,
  Component,
  ElementRef,
  ViewChild,
  inject,
  signal,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';
import { HttpErrorResponse } from '@angular/common/http';
import { ChatMessage, ChatSolution } from './models/chat.model';
import { ChatApiService } from './services/chat-api.service';

interface Bubble {
  cls: 'user' | 'bot';
  html: SafeHtml;
  solutionId?: number;
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
  kind: 'warning' | 'error';
  title: string;
  body: string;
}

const GREETING =
  'Cześć! 👋 Opowiedz w 1–2 zdaniach, nad jakim problemem technicznym pracujesz. ' +
  'Dopytam o szczegóły, a gotowe rozwiązania TRIZ pojawią się w panelu obok.';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './app.component.html',
  styleUrl: './app.component.css',
})
export class AppComponent implements AfterViewChecked {
  private readonly chatApi = inject(ChatApiService);
  private readonly sanitizer = inject(DomSanitizer);

  @ViewChild('messagesBox') private messagesBox?: ElementRef<HTMLElement>;

  input = '';
  bubbles = signal<Bubble[]>([{ cls: 'bot', html: GREETING }]);
  solutions = signal<SolutionCard[]>([]);
  toasts = signal<Toast[]>([]);
  loading = signal(false);

  /** Full conversation history, sent to the backend on every turn. */
  private readonly history: ChatMessage[] = [];
  private nextId = 0;
  private shouldScroll = false;

  ngAfterViewChecked(): void {
    if (this.shouldScroll && this.messagesBox) {
      const el = this.messagesBox.nativeElement;
      el.scrollTop = el.scrollHeight;
      this.shouldScroll = false;
    }
  }

  onEnter(event: Event): void {
    const keyboard = event as KeyboardEvent;
    if (!keyboard.shiftKey) {
      keyboard.preventDefault();
      this.send();
    }
  }

  send(): void {
    const text = this.input.trim();
    if (!text || this.loading()) {
      return;
    }

    this.input = '';
    this.history.push({ role: 'user', content: text });
    this.addBubble({ cls: 'user', html: this.escape(text) });
    this.loading.set(true);

    this.chatApi.chat({ messages: [...this.history] }).subscribe({
      next: (result) => {
        this.loading.set(false);
        this.history.push({ role: 'assistant', content: result.answer || '' });

        let solutionId: number | undefined;
        if (result.solution) {
          solutionId = this.addSolution(result.solution, result.engine);
        }
        if (result.warning) {
          this.showToast('warning', 'Konfiguracja OpenAI', result.warning);
        }
        this.addBubble({
          cls: 'bot',
          html: this.markdown(result.answer || '(pusta odpowiedź)'),
          solutionId,
        });
      },
      error: (err: HttpErrorResponse) => {
        this.loading.set(false);
        const detail =
          typeof err.error === 'object' && err.error?.message
            ? String(err.error.message)
            : err.message;
        this.showToast('error', 'Błąd żądania', detail);
        // keep the user message in history so a retry has full context
      },
    });
    this.shouldScroll = true;
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

  engineLabel(engine: 'agent' | 'pipeline'): string {
    return engine === 'agent' ? '🤖 agent' : '⚙️ pipeline';
  }

  private addBubble(bubble: Bubble): void {
    this.bubbles.update((bubbles) => [...bubbles, bubble]);
    this.shouldScroll = true;
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

  private showToast(kind: Toast['kind'], title: string, body: string): void {
    const id = ++this.nextId;
    this.toasts.update((toasts) => [...toasts, { id, kind, title, body }]);
    setTimeout(() => this.dismissToast(id), kind === 'error' ? 14000 : 10000);
  }

  private escape(value: string): string {
    return (value ?? '').replace(
      /[&<>]/g,
      (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' })[c]!,
    );
  }

  /** Minimal markdown for bot answers: headers, bold, code, bullet lists. */
  private markdown(value: string): SafeHtml {
    let html = this.escape(value);
    html = html
      .replace(/^#{1,3} (.*)$/gm, '<h4>$1</h4>')
      .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
      .replace(/`([^`]+)`/g, '<code>$1</code>')
      .replace(/^\s*(?:[-•*]|\d+\.) (.*)$/gm, '<li>$1</li>');
    html = html.replace(
      /(?:<li>.*?<\/li>\n?)+/gs,
      (m) => '<ul>' + m.replace(/\n/g, '') + '</ul>',
    );
    html = html.replace(/\n{2,}/g, '<br><br>').replace(/\n/g, '<br>');
    // Safe: the source is escaped above, only tags produced here remain.
    return this.sanitizer.bypassSecurityTrustHtml(html);
  }
}
