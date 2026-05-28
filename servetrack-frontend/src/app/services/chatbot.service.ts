import { Injectable, signal, computed, inject, effect, untracked } from '@angular/core';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';
import { Observable, of, throwError, timer } from 'rxjs';
import { catchError, concatMap, retryWhen, tap } from 'rxjs/operators';
import DOMPurify from 'dompurify';
import { marked } from 'marked';
import { ChatMessage, ChatApiResponse } from '../models/chatbot.model';
import { environment } from '../../environments/environment';
import { AuthService } from './auth.service';

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
  private authService = inject(AuthService);
  private apiUrl = environment.apiUrl;

  private readonly markdownCache = new Map<string, SafeHtml>();

  private get userId(): number | string {
    return this.authService.currentUser()?.id ?? 'guest';
  }

  private get MESSAGES_KEY(): string {
    return `user_${this.userId}_chatbot_messages`;
  }

  private get SESSION_KEY(): string {
    return `user_${this.userId}_chatbot_session_id`;
  }

  private get SHOW_KEY(): string {
    return `user_${this.userId}_chatbot_show`;
  }

  readonly showChatbot = signal(false);
  readonly messages = signal<ChatMessage[]>([]);
  readonly isLoading = signal(false);
  readonly sessionId = signal<string>('');

  readonly hasMessages = computed(() => this.messages().length > 0);

  constructor() {
    // Defer session load until after injection so userId is available
    this.sessionId.set(this.loadSession());

    // Effect to sync state when the current user changes (handles login, logout, and initial checkAuthStatus)
    effect(() => {
      // Register dependency on the current user
      const user = this.authService.currentUser();
      
      untracked(() => {
        // Load the open/closed state for this user
        this.showChatbot.set(this.loadShowState());
        // Load the history/session for this user
        this.loadHistory();
      });
    });

    // Effect to automatically save the showChatbot state when it changes
    effect(() => {
      const show = this.showChatbot();
      untracked(() => {
        this.saveShowState(show);
      });
    });

    // Effect to automatically save the messages when the messages signal changes
    effect(() => {
      const msgs = this.messages();
      untracked(() => {
        if (msgs.length === 0) {
          localStorage.removeItem(this.MESSAGES_KEY);
        } else {
          this.saveMessages(msgs);
        }
      });
    });
  }

  private loadShowState(): boolean {
    const stored = localStorage.getItem(this.SHOW_KEY);
    return stored === 'true';
  }

  private saveShowState(show: boolean): void {
    localStorage.setItem(this.SHOW_KEY, String(show));
  }

  private loadSession(): string {
    const stored = localStorage.getItem(this.SESSION_KEY);
    if (stored) return stored;
    const newId = crypto.randomUUID();
    localStorage.setItem(this.SESSION_KEY, newId);
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
      if (!stored) return [];
      const parsed: unknown = JSON.parse(stored);
      return Array.isArray(parsed) ? (parsed as ChatMessage[]) : [];
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
              localStorage.setItem(this.SESSION_KEY, response.session_id);
            }
            const assistantMessage: ChatMessage = {
              role: 'assistant',
              message: response.message,
              metadata: response.metadata,
              created_at: new Date().toISOString(),
            };
            this.messages.update((msgs) => [...msgs, assistantMessage]);
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
    // Re-sync session for the current user (handles login/logout transitions)
    this.sessionId.set(this.loadSession());
    // Always replace messages — prevents cross-user leaks if user changed
    this.messages.set(this.loadMessages());
  }

  clearHistory(): Observable<{ success: boolean; message: string }> {
    this.messages.set([]);
    localStorage.removeItem(this.MESSAGES_KEY);
    localStorage.removeItem(this.SESSION_KEY);
    this.sessionId.set(this.loadSession());
    return of({ success: true, message: 'Conversation history cleared' });
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