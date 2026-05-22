import { Injectable, signal, computed, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, throwError } from 'rxjs';
import { catchError, tap } from 'rxjs/operators';
import { ChatMessage, ChatApiResponse } from '../models/chatbot.model';
import { environment } from '../../environments/environment';

@Injectable({ providedIn: 'root' })
export class ChatbotService {
  private http = inject(HttpClient);
  private apiUrl = environment.apiUrl;

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

  toggleChatbot(): void {
    this.showChatbot.update(v => !v);
  }

  openChatbot(): void {
    this.showChatbot.set(true);
    this.loadHistory();
  }

  closeChatbot(): void {
    this.showChatbot.set(false);
  }

  sendMessage(text: string): Observable<ChatApiResponse> {
    if (!text.trim() || this.isLoading()) {
      return throwError(() => new Error('Invalid message'));
    }

    const userMessage: ChatMessage = {
      role: 'user',
      message: text.trim(),
      created_at: new Date().toISOString(),
    };

    this.messages.update(msgs => [...msgs, userMessage]);
    this.isLoading.set(true);

    return this.http.post<ChatApiResponse>(`${this.apiUrl}/chatbot/message`, {
      message: text.trim(),
      session_id: this.sessionId(),
    }).pipe(
      tap(response => {
        if (response.success) {
          this.sessionId.set(response.session_id);
          localStorage.setItem('chatbot_session_id', response.session_id);

          const assistantMessage: ChatMessage = {
            role: 'assistant',
            message: response.message,
            metadata: response.metadata,
            created_at: new Date().toISOString(),
          };
          this.messages.update(msgs => [...msgs, assistantMessage]);
        }
        this.isLoading.set(false);
      }),
      catchError(error => {
        this.isLoading.set(false);
        const errorMsg: ChatMessage = {
          role: 'assistant',
          message: 'Sorry, I encountered an error. Please try again.',
          created_at: new Date().toISOString(),
        };
        this.messages.update(msgs => [...msgs, errorMsg]);
        return throwError(() => error);
      })
    );
  }

  loadHistory(): void {
    this.http.get<{ success: boolean; data: ChatMessage[] }>(
      `${this.apiUrl}/chatbot/history?session_id=${this.sessionId()}`
    ).pipe(
      tap(response => {
        if (response.success && response.data.length > 0) {
          this.messages.set(response.data);
        }
      }),
      catchError(() => [])
    ).subscribe();
  }

  clearHistory(): Observable<{ success: boolean; message: string }> {
    return this.http.post<{ success: boolean; message: string }>(
      `${this.apiUrl}/chatbot/clear`,
      { session_id: this.sessionId() }
    ).pipe(
      tap(response => {
        if (response.success) {
          this.messages.set([]);
        }
      })
    );
  }
}
