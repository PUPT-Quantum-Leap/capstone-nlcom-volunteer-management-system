import { Injectable, signal, computed, inject } from '@angular/core';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';
import { Observable, throwError, timer } from 'rxjs';
import { catchError, concatMap, retryWhen, tap } from 'rxjs/operators';
import DOMPurify from 'dompurify';
import { marked } from 'marked';
import { ChatMessage, ChatApiResponse } from '../models/chatbot.model';
import { environment } from '../../environments/environment';

const MARKDOWN_ALLOWED_TAGS: readonly string[] = [
  'a', 'b', 'blockquote', 'br', 'code', 'em', 'h1', 'h2', 'h3', 'h4',
  'i', 'li', 'ol', 'p', 'pre', 'span', 'strong', 'table', 'tbody',
  'td', 'th', 'thead', 'tr', 'ul',
];
const MARKDOWN_ALLOWED_ATTR: readonly string[] = ['href', 'title', 'target', 'rel', 'class'];

/** Maximum allowed length of a user message (matches backend rule). */
export const CHATBOT_MAX_MESSAGE_LENGTH = 2000;

/** Maximum number of retry attempts for transient failures. */
const MAX_RETRY_ATTEMPTS = 3;

const DANGEROUS_PATTERNS: readonly RegExp[] = [
  /<script\b/i,
  /<\/script>/i,
  /<iframe\b/i,
  /<object\b/i,
  /<embed\b/i,
  /javascript:/i,
  /\bon\w+\s*=/i,
];

@Injectable({ providedIn: 'root' })
export class ChatbotService {
  private http = inject(HttpClient);
  private sanitizer = inject(DomSanitizer);
  private apiUrl = environment.apiUrl;

  private readonly markdownCache = new Map<string, SafeHtml>();
  private readonly MESSAGES_KEY = 'chatbot_messages';

  readonly showChatbot = signal(false);
  readonly messages = signal<ChatMessage[]>([]);
  readonly isLoading = signal(false);
  readonly sessionId = signal<string>(this.loadSession());

  readonly hasMessages = computed(() => this.messages().length > 0);

  private loadSession(): string {
    const stored = localStorage.getItem('chatbot_session_id');
    if (stored) return stored;
    const newId = crypto.randomUUID();
    localStorage.setItem('chatbot_session_id', newId);
    return newId;
  }

  private saveMessages(msgs: ChatMessage[]): void {
    try {
      localStorage.setItem(this.MESSAGES_KEY, JSON.stringify(msgs));
    } catch {
      // quota exceeded — silently ignore
    }
  }

  private loadMessages(): ChatMessage[] {
    try {
      const stored = localStorage.getItem(this.MESSAGES_KEY);
      return stored ? (JSON.parse(stored) as ChatMessage[]) : [];
    } catch {
      return [];
    }
  }

  toggleChatbot(): void {
    this.showChatbot.update((v) => !v);
    if (this.showChatbot()) {
      this.loadHistory();
    }
  }

  openChatbot(): void {
    this.showChatbot.set(true);
    this.loadHistory();
  }

  closeChatbot(): void {
    this.showChatbot.set(false);
  }

  parseMarkdown(text: string): SafeHtml {
    if (!text) return this.sanitizer.bypassSecurityTrustHtml('');
    const cached = this.markdownCache.get(text);
    if (cached) return cached;

    const rawHtml = marked.parse(text, { async: false, gfm: true, breaks: true }) as string;
    const clean = DOMPurify.sanitize(rawHtml, {
      ALLOWED_TAGS: [...MARKDOWN_ALLOWED_TAGS],
      ALLOWED_ATTR: [...MARKDOWN_ALLOWED_ATTR],
      ALLOW_DATA_ATTR: false,
    });
    const safe = clean.replace(/<a\s/gi, '<a target="_blank" rel="noopener noreferrer" ');
    const trusted = this.sanitizer.bypassSecurityTrustHtml(safe);
    this.markdownCache.set(text, trusted);
    return trusted;
  }

  sanitizeUserInput(text: string): string {
    if (!text) return '';
    const dropContentTags = /<(script|style|iframe|object|embed)\b[^>]*>[\s\S]*?<\/\1>/gi;
    const stripped = text
      .replace(dropContentTags, '')
      .replace(/<[^>]*>/g, '')
      .replace(/javascript:/gi, '')
      .trim();
    if (stripped.length < 1 || stripped.length > CHATBOT_MAX_MESSAGE_LENGTH) {
      return '';
    }
    return stripped;
  }

  containsMaliciousPattern(text: string): boolean {
    if (!text) return false;
    return DANGEROUS_PATTERNS.some((pattern) => pattern.test(text));
  }

  sendMessage(text: string): Observable<ChatApiResponse> {
    const cleaned = this.sanitizeUserInput(text);
    if (!cleaned || this.isLoading()) {
      return throwError(() => new Error('Invalid message'));
    }

    const userMessage: ChatMessage = {
      id: crypto.randomUUID(),
      role: 'user',
      message: cleaned,
      created_at: new Date().toISOString(),
    };

    this.messages.update((msgs) => [...msgs, userMessage]);
    this.isLoading.set(true);

    return this.http
      .post<ChatApiResponse>(
        `${this.apiUrl}/chatbot/message`,
        { message: cleaned, session_id: this.sessionId() },
        { withCredentials: true },
      )
      .pipe(
        retryWhen((errors) =>
          errors.pipe(
            concatMap((error: HttpErrorResponse, attempt: number) => {
              if (attempt >= MAX_RETRY_ATTEMPTS || !this.isTransientError(error)) {
                return throwError(() => error);
              }
              const delayMs = Math.pow(2, attempt) * 1000;
              this.updateRetryStatus(userMessage.id!, attempt + 1);
              return timer(delayMs);
            }),
          ),
        ),
        tap((response) => {
          this.clearRetryStatus(userMessage.id!);
          if (response.success) {
            if (response.session_id) {
              this.sessionId.set(response.session_id);
              localStorage.setItem('chatbot_session_id', response.session_id);
            }
            const assistantMessage: ChatMessage = {
              role: 'assistant',
              message: response.message,
              metadata: response.metadata,
              created_at: new Date().toISOString(),
            };
            this.messages.update((msgs) => [...msgs, assistantMessage]);
            this.saveMessages(this.messages());
          }
          this.isLoading.set(false);
        }),
        catchError((error) => {
          this.clearRetryStatus(userMessage.id!);
          this.isLoading.set(false);
          const errorMsg: ChatMessage = {
            role: 'assistant',
            message: 'Sorry, I encountered an error. Please try again.',
            created_at: new Date().toISOString(),
          };
          this.messages.update((msgs) => [...msgs, errorMsg]);
          return throwError(() => error);
        }),
      );
  }

  loadHistory(): void {
    const msgs = this.loadMessages();
    if (msgs.length > 0) {
      this.messages.set(msgs);
    }
  }

  clearHistory(): Observable<{ success: boolean; message: string }> {
    this.messages.set([]);
    localStorage.removeItem(this.MESSAGES_KEY);
    localStorage.removeItem('chatbot_session_id');
    this.sessionId.set(this.loadSession());
    return new Observable((observer) => {
      observer.next({ success: true, message: 'Conversation history cleared' });
      observer.complete();
    });
  }

  isTransientError(error: HttpErrorResponse): boolean {
    if (!error.status) return true;
    return error.status >= 500;
  }

  private updateRetryStatus(messageId: string, attempt: number): void {
    this.messages.update((msgs) =>
      msgs.map((m) =>
        m.id === messageId ? { ...m, isRetrying: true, retryAttempt: attempt } : m,
      ),
    );
  }

  private clearRetryStatus(messageId: string): void {
    this.messages.update((msgs) =>
      msgs.map((m) =>
        m.id === messageId ? { ...m, isRetrying: false, retryAttempt: undefined } : m,
      ),
    );
  }
}