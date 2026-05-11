# ServeTrack AI Chatbot Implementation Plan

**Document Version:** 1.0  
**Date:** May 11, 2026  
**Approach:** N8N Route (RAG Chatbot)  
**LLM Provider:** OpenRouter / Groq (free models)  
**Prepared for:** ServeTrack Volunteer Management System - NLCOM

---

## 1. Executive Summary

This document outlines the complete implementation plan for an AI-powered chatbot integrated into the ServeTrack Volunteer Management System. The chatbot will use **Retrieval-Augmented Generation (RAG)** via N8N, leveraging free LLM models from OpenRouter/Groq to answer volunteer and admin questions about the platform, NLCOM policies, and organizational FAQs.

### Key Benefits
- **No per-message costs** using free LLM models (Groq Llama-3.3-70B, OpenRouter DeepSeek)
- **RAG-powered** responses using your existing documents and knowledge base
- **Persistent conversations** across browser sessions
- **Single chatbot** for both volunteers and admins (role-aware responses)
- **Clean architecture** with N8N handling all AI logic, Laravel handling API and storage

### Architecture
```
┌──────────────────────────────────────────────────────────────────┐
│                      ServeTrack System                           │
├─────────────────────────┬──────────────────────────────────────┤
│   Angular 21 Frontend    │         Laravel 12 Backend           │
│  - Chatbot button       │  - ChatbotController                 │
│  - Sidebar chat UI      │  - ChatbotConversation model          │
│  - Signal-based state   │  - ChatbotService (N8N HTTP calls)   │
│  - SCSS styling         │  - Rate limiting, validation         │
└────────────┬────────────┴───────────────────────────────────────┤
             │                                               ▲
             │  POST /api/chatbot/message                     │
             │  GET  /api/chatbot/history                     │
             │  POST /api/chatbot/clear                       │
             ▼                                               │
┌──────────────────────────────────────────────────────────────────┐
│                       N8N Instance                              │
│  ┌─────────────────┐  ┌──────────────┐  ┌──────────────────┐   │
│  │  Webhook Node   │→ │ RAG Pipeline │→ │ LLM (OpenRouter/ │   │
│  │  (receive msg)  │  │ (retrieve)   │  │  Groq - free)    │   │
│  └─────────────────┘  └──────────────┘  └──────────────────┘   │
│                              ▲                                   │
│  ┌─────────────────┐       │                                   │
│  │  Vector DB      │←──────┘                                    │
│  │  (Pinecone/     │                                            │
│  │   Qdrant)       │  ┌──────────────────┐                    │
│  └─────────────────┘  │  Documents/FAQ  │                    │
│                        │  Knowledge Base  │                    │
│                        └──────────────────┘                    │
└──────────────────────────────────────────────────────────────────┘
```

---

## 2. System Requirements

### 2.1 Prerequisites

| Component | Requirement | Status |
|-----------|-------------|--------|
| PHP | 8.2+ | ✅ Installed |
| Laravel | 12.x | ✅ Current |
| Angular | 21.x | ✅ Current |
| N8N Instance | Self-hosted or n8n.cloud | ⏳ Needed |
| Vector DB | Pinecone (cloud) or Qdrant (self-hosted) | ⏳ Needed |
| LLM API Keys | OpenRouter or Groq (free tier) | ⏳ Needed |
| Existing Documents | PDF, DOCX, TXT, Markdown | 📁 Available |

### 2.2 Free LLM Options

| Provider | Model | Context | Cost |
|----------|-------|---------|------|
| **Groq** | llama-3.3-70b-versatile | 128k | Free |
| **Groq** | mixtral-8x7b-32768 | 32k | Free |
| **OpenRouter** | deepseek-ai/deepseek-chat-v3-0324 | 128k | Free |
| **OpenRouter** | anthropic/claude-3-haiku | 200k | Free |

### 2.3 Vector DB Options

| Provider | Tier | Storage | Cost |
|----------|------|---------|------|
| **Pinecone** | Starter | 1M vectors | Free |
| **Qdrant** | Self-hosted | Unlimited | Free |

---

## 3. Database Schema

### 3.1 chatbot_conversations Table

```php
// database/migrations/2026_05_11_000001_create_chatbot_conversations_table.php

Schema::create('chatbot_conversations', function (Blueprint $table) {
    $table->id();
    $table->foreignId('user_id')->constrained()->onDelete('cascade');
    $table->string('session_id', 255)->index();
    $table->enum('role', ['user', 'assistant']);
    $table->text('message');
    $table->json('metadata')->nullable();
    $table->timestamps();

    $table->index(['user_id', 'session_id']);
    $table->index(['user_id', 'created_at']);
});
```

**Fields:**
| Field | Type | Description |
|-------|------|-------------|
| id | bigint (PK) | Auto-increment primary key |
| user_id | bigint (FK) | References users.id |
| session_id | varchar(255) | Cross-session persistence identifier |
| role | enum | 'user' or 'assistant' |
| message | text | The message content |
| metadata | json | Token count, model used, latency, etc. |
| created_at | timestamp | Message timestamp |

### 3.2 chatbot_knowledge_base Table (Optional - for non-RAG fallback)

```php
Schema::create('chatbot_knowledge_base', function (Blueprint $table) {
    $table->id();
    $table->enum('category', ['volunteer', 'admin', 'general', 'events', 'ics']);
    $table->string('question');
    $table->text('answer');
    $table->json('keywords')->nullable();
    $table->timestamps();

    $table->index('category');
    $table->fullText(['question', 'answer']);
});
```

---

## 4. Backend Implementation

### 4.1 ChatbotConversation Model

**File:** `app/Models/ChatbotConversation.php`

```php
<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Builder;

class ChatbotConversation extends Model
{
    protected $fillable = [
        'user_id',
        'session_id',
        'role',
        'message',
        'metadata',
    ];

    protected function casts(): array
    {
        return [
            'metadata' => 'array',
            'created_at' => 'datetime',
        ];
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    public function scopeByUser(Builder $query, int $userId): Builder
    {
        return $query->where('user_id', $userId);
    }

    public function scopeBySession(Builder $query, string $sessionId): Builder
    {
        return $query->where('session_id', $sessionId);
    }

    public function scopeRecent(Builder $query, int $limit = 50): Builder
    {
        return $query->orderBy('created_at', 'desc')->limit($limit);
    }
}
```

### 4.2 ChatbotService

**File:** `app/Services/ChatbotService.php`

```php
<?php

namespace App\Services;

use App\Models\ChatbotConversation;
use App\Models\User;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;

class ChatbotService
{
    protected string $n8nWebhookUrl;
    protected string $n8nApiKey;
    protected int $maxHistory;
    protected int $maxMessageLength;

    public function __construct()
    {
        $this->n8nWebhookUrl = config('services.chatbot.n8n_webhook_url', env('N8N_WEBHOOK_URL', ''));
        $this->n8nApiKey = config('services.chatbot.n8n_api_key', env('N8N_API_KEY', ''));
        $this->maxHistory = (int) config('services.chatbot.max_history', 50);
        $this->maxMessageLength = (int) config('services.chatbot.max_message_length', 4000);
    }

    public function sendMessageToN8N(string $message, ?User $user, string $sessionId): array
    {
        $context = $this->buildContext($user, $sessionId);

        $payload = [
            'message' => $message,
            'user_id' => $user?->id,
            'user_role' => $user?->role ?? 'guest',
            'user_name' => $user?->name ?? 'Guest',
            'session_id' => $sessionId,
            'context' => $context,
        ];

        try {
            $response = Http::timeout(30)
                ->withHeaders([
                    'Authorization' => $this->n8nApiKey ? "Bearer {$this->n8nApiKey}" : '',
                    'Content-Type' => 'application/json',
                ])
                ->post($this->n8nWebhookUrl, $payload);

            if ($response->successful()) {
                return $response->json();
            }

            Log::error('N8N chatbot error', [
                'status' => $response->status(),
                'body' => $response->body(),
            ]);

            return [
                'success' => false,
                'message' => 'Sorry, I encountered an error. Please try again.',
            ];
        } catch (\Exception $e) {
            Log::error('N8N connection failed', ['error' => $e->getMessage()]);

            return [
                'success' => false,
                'message' => 'Sorry, I am currently unavailable. Please try again later.',
            ];
        }
    }

    public function getHistory(int $userId, string $sessionId, int $limit = 50): Collection
    {
        return ChatbotConversation::query()
            ->byUser($userId)
            ->bySession($sessionId)
            ->orderBy('created_at', 'asc')
            ->limit($limit)
            ->get();
    }

    public function saveMessage(int $userId, string $sessionId, string $role, string $message, ?array $metadata = null): ChatbotConversation
    {
        return ChatbotConversation::create([
            'user_id' => $userId,
            'session_id' => $sessionId,
            'role' => $role,
            'message' => $message,
            'metadata' => $metadata,
        ]);
    }

    public function clearHistory(int $userId, string $sessionId): int
    {
        return ChatbotConversation::query()
            ->byUser($userId)
            ->bySession($sessionId)
            ->delete();
    }

    protected function buildContext(?User $user, string $sessionId): array
    {
        $context = [
            'app_name' => config('app.name', 'ServeTrack'),
            'organization' => 'NLCOM (New Life Community Care Foundation)',
        ];

        if ($user) {
            $context['user'] = [
                'id' => $user->id,
                'name' => $user->name,
                'role' => $user->role,
                'email' => $user->email,
            ];

            if ($user->role === 'volunteer' && $user->volunteer) {
                $context['user']['volunteer_id'] = $user->volunteer->volunteer_id;
                $context['user']['first_name'] = $user->volunteer->first_name;
                $context['user']['last_name'] = $user->volunteer->last_name;
            }
        }

        return $context;
    }

    public function getMaxMessageLength(): int
    {
        return $this->maxMessageLength;
    }
}
```

### 4.3 ChatbotMessageRequest

**File:** `app/Http/Requests/ChatbotMessageRequest.php`

```php
<?php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;

class ChatbotMessageRequest extends FormRequest
{
    public function authorize(): bool
    {
        return $this->user() !== null;
    }

    public function rules(): array
    {
        return [
            'message' => ['required', 'string', 'max:4000'],
            'session_id' => ['nullable', 'string', 'max:255'],
            'context_hint' => ['nullable', 'string', 'max:500'],
        ];
    }

    public function messages(): array
    {
        return [
            'message.required' => 'Please enter a message.',
            'message.max' => 'Message cannot exceed 4000 characters.',
        ];
    }
}
```

### 4.4 ChatbotController

**File:** `app/Http/Controllers/Api/ChatbotController.php`

```php
<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Requests\ChatbotMessageRequest;
use App\Services\ChatbotService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Str;

class ChatbotController extends Controller
{
    public function __construct(
        protected ChatbotService $chatbotService
    ) {}

    public function message(ChatbotMessageRequest $request): JsonResponse
    {
        $user = $request->user();
        $sessionId = $request->input('session_id', $this->getOrCreateSessionId($request));
        $message = $request->validated('message');

        $this->chatbotService->saveMessage(
            $user->id,
            $sessionId,
            'user',
            $message
        );

        $n8nResponse = $this->chatbotService->sendMessageToN8N($message, $user, $sessionId);

        if (! ($n8nResponse['success'] ?? true)) {
            return response()->json([
                'success' => false,
                'message' => $n8nResponse['message'] ?? 'An error occurred.',
                'session_id' => $sessionId,
            ], 500);
        }

        $this->chatbotService->saveMessage(
            $user->id,
            $sessionId,
            'assistant',
            $n8nResponse['message'] ?? $n8nResponse['text'] ?? '',
            $n8nResponse['metadata'] ?? null
        );

        return response()->json([
            'success' => true,
            'message' => $n8nResponse['message'] ?? $n8nResponse['text'] ?? '',
            'session_id' => $sessionId,
            'metadata' => $n8nResponse['metadata'] ?? null,
        ]);
    }

    public function history(Request $request): JsonResponse
    {
        $user = $request->user();
        $sessionId = $request->query('session_id', $this->getOrCreateSessionId($request));
        $limit = min((int) $request->query('limit', 50), 100);

        $messages = $this->chatbotService->getHistory($user->id, $sessionId, $limit);

        return response()->json([
            'success' => true,
            'data' => $messages,
            'session_id' => $sessionId,
        ]);
    }

    public function clear(Request $request): JsonResponse
    {
        $user = $request->user();
        $sessionId = $request->input('session_id', $this->getOrCreateSessionId($request));

        $deleted = $this->chatbotService->clearHistory($user->id, $sessionId);

        return response()->json([
            'success' => true,
            'message' => "Conversation cleared. {$deleted} messages deleted.",
            'session_id' => $sessionId,
        ]);
    }

    public function config(Request $request): JsonResponse
    {
        $user = $request->user();

        return response()->json([
            'success' => true,
            'data' => [
                'max_message_length' => $this->chatbotService->getMaxMessageLength(),
                'max_history' => 50,
                'version' => '1.0.0',
                'features' => [
                    'file_upload' => false,
                    'voice_input' => false,
                    'image_generation' => false,
                ],
            ],
        ]);
    }

    protected function getOrCreateSessionId(Request $request): string
    {
        $sessionId = $request->header('X-Chatbot-Session');

        if (! $sessionId) {
            $sessionId = $request->session()->get('chatbot_session_id');

            if (! $sessionId) {
                $sessionId = Str::uuid()->toString();
                $request->session()->put('chatbot_session_id', $sessionId);
            }
        }

        return $sessionId;
    }
}
```

### 4.5 API Routes

**File:** `routes/api.php` (add at end)

```php
Route::prefix('chatbot')->middleware(['api', 'auth:sanctum'])->group(function () {
    Route::post('/message', [ChatbotController::class, 'message'])
        ->middleware('throttle:chatbot');
    Route::get('/history', [ChatbotController::class, 'history']);
    Route::post('/clear', [ChatbotController::class, 'clear']);
    Route::get('/config', [ChatbotController::class, 'config']);
});
```

### 4.6 Custom Rate Limiter

**File:** `bootstrap/app.php` (add to rate limiters)

```php
RateLimiter::for('chatbot', function (Request $request) {
    return Limit::perMinute(10)->by($request->user()?->id ?: $request->ip());
});
```

### 4.7 Service Config

**File:** `config/services.php` (add section)

```php
'chatbot' => [
    'n8n_webhook_url' => env('N8N_WEBHOOK_URL'),
    'n8n_api_key' => env('N8N_API_KEY'),
    'max_history' => env('CHATBOT_MAX_HISTORY', 50),
    'max_message_length' => env('CHATBOT_MAX_MESSAGE_LENGTH', 4000),
],
```

### 4.8 Environment Variables

**File:** `.env` (add section)

```bash
# Chatbot / N8N
N8N_WEBHOOK_URL=https://your-n8n-instance.com/webhook/chatbot
N8N_API_KEY=your_n8n_api_key
CHATBOT_MAX_HISTORY=50
CHATBOT_MAX_MESSAGE_LENGTH=4000
```

**File:** `.env.example` (add section)

```bash
# Chatbot / N8N
N8N_WEBHOOK_URL=
N8N_API_KEY=
CHATBOT_MAX_HISTORY=50
CHATBOT_MAX_MESSAGE_LENGTH=4000
```

---

## 5. Frontend Implementation

### 5.1 TypeScript Models

**File:** `src/app/models/chatbot.model.ts`

```typescript
export interface ChatMessage {
  id?: number;
  role: 'user' | 'assistant';
  message: string;
  metadata?: {
    tokens?: number;
    model?: string;
    latency?: number;
  };
  created_at?: string;
}

export interface ChatSession {
  session_id: string;
  messages: ChatMessage[];
}

export interface ChatConfig {
  max_message_length: number;
  max_history: number;
  version: string;
  features: {
    file_upload: boolean;
    voice_input: boolean;
    image_generation: boolean;
  };
}

export interface ChatApiResponse {
  success: boolean;
  message: string;
  session_id: string;
  metadata?: Record<string, unknown>;
}
```

### 5.2 ChatbotService

**File:** `src/app/services/chatbot.service.ts`

```typescript
import { Injectable, signal, computed, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, throwError } from 'rxjs';
import { catchError, tap } from 'rxjs/operators';
import { ChatMessage, ChatConfig, ChatApiResponse } from '../models/chatbot.model';
import { AuthService } from './auth.service';
import { environment } from '../../environments/environment';

@Injectable({ providedIn: 'root' })
export class ChatbotService {
  private readonly http = inject(HttpClient);
  private readonly authService = inject(AuthService);
  private readonly apiUrl = environment.apiUrl;

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

  getConfig(): Observable<ChatConfig> {
    return this.http.get<ChatConfig>(`${this.apiUrl}/chatbot/config`);
  }
}
```

### 5.3 ChatbotContainerComponent

**File:** `src/app/components/chatbot/chatbot-container.component.ts`

```typescript
import { Component, inject, signal, ChangeDetectionStrategy, ElementRef, viewChild, effect } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ChatbotService } from './chatbot.service';

@Component({
  selector: 'app-chatbot-container',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="chatbot-wrapper" [class.open]="chatbotService.showChatbot()">
      <div class="chatbot-header">
        <div class="header-info">
          <div class="bot-avatar">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
              <path d="M12 2L2 7L12 12L22 7L12 2Z" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
              <path d="M2 17L12 22L22 17" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
              <path d="M2 12L12 17L22 12" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
            </svg>
          </div>
          <div class="header-text">
            <h3>ServeTrack AI</h3>
            <span class="status">Online</span>
          </div>
        </div>
        <div class="header-actions">
          <button class="btn-icon" (click)="clearChat()" title="Clear chat">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M3 6H5H21"/>
              <path d="M8 6V4C8 3.47 8.21 2.96 8.59 2.59C8.96 2.21 9.47 2 10 2H14C14.53 2 15.04 2.21 15.41 2.59C15.79 2.96 16 3.47 16 4V6"/>
              <path d="M19 6V20C19 20.53 18.79 21.04 18.41 21.41C18.04 21.79 17.53 22 17 22H7C6.47 22 5.96 21.79 5.59 21.41C5.21 21.04 5 20.53 5 20V6"/>
            </svg>
          </button>
          <button class="btn-icon" (click)="chatbotService.closeChatbot()">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <line x1="18" y1="6" x2="6" y2="18"/>
              <line x1="6" y1="6" x2="18" y2="18"/>
            </svg>
          </button>
        </div>
      </div>

      <div class="chatbot-messages" #messagesContainer>
        @if (!chatbotService.hasMessages()) {
          <div class="welcome-message">
            <div class="welcome-icon">
              <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
                <path d="M12 2L2 7L12 12L22 7L12 2Z"/>
                <path d="M2 17L12 22L22 17"/>
                <path d="M2 12L12 17L22 12"/>
              </svg>
            </div>
            <h4>Hello! I'm ServeTrack AI Assistant</h4>
            <p>I can help you with questions about NLCOM volunteer programs, RSVP events, attendance tracking, ICS operations, and more.</p>
            <div class="suggestion-chips">
              <button class="chip" (click)="sendSuggestion('How do I register for an event?')">How do I register for an event?</button>
              <button class="chip" (click)="sendSuggestion('When is the next feeding program?')">When is the next feeding program?</button>
              <button class="chip" (click)="sendSuggestion('How do I update my profile?')">How do I update my profile?</button>
            </div>
          </div>
        }

        @for (msg of chatbotService.messages(); track $index) {
          <div class="message" [class.user]="msg.role === 'user'" [class.assistant]="msg.role === 'assistant'">
            @if (msg.role === 'assistant') {
              <div class="message-avatar">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
                  <path d="M12 2L2 7L12 12L22 7L12 2Z"/>
                  <path d="M2 17L12 22L22 17"/>
                  <path d="M2 12L12 17L22 12"/>
                </svg>
              </div>
            }
            <div class="message-content">
              <p>{{ msg.message }}</p>
              @if (msg.created_at) {
                <span class="timestamp">{{ formatTime(msg.created_at) }}</span>
              }
            </div>
          </div>
        }

        @if (chatbotService.isLoading()) {
          <div class="message assistant">
            <div class="message-avatar">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
                <path d="M12 2L2 7L12 12L22 7L12 2Z"/>
                <path d="M2 17L12 22L22 17"/>
                <path d="M2 12L12 17L22 12"/>
              </svg>
            </div>
            <div class="message-content typing">
              <div class="typing-indicator">
                <span></span>
                <span></span>
                <span></span>
              </div>
            </div>
          </div>
        }
      </div>

      <div class="chatbot-input">
        <textarea 
          #messageInput
          [(ngModel)]="inputMessage"
          (keydown.enter)="onEnterKey($event)"
          placeholder="Type your message..."
          rows="1"
          [maxlength]="4000"
        ></textarea>
        <button 
          class="btn-send" 
          (click)="sendMessage()"
          [disabled]="!inputMessage.trim() || chatbotService.isLoading()"
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <line x1="22" y1="2" x2="11" y2="13"/>
            <polygon points="22 2 15 22 11 13 2 9 22 2"/>
          </svg>
        </button>
      </div>
    </div>
  `,
  styles: [`
    :host {
      display: contents;
    }

    .chatbot-wrapper {
      position: fixed;
      top: 0;
      right: 0;
      width: 400px;
      height: 100vh;
      background: var(--bg-secondary, #1a1a2e);
      border-left: 1px solid var(--border-color, rgba(255,255,255,0.1));
      display: flex;
      flex-direction: column;
      transform: translateX(100%);
      transition: transform 0.3s cubic-bezier(0.4, 0, 0.2, 1);
      z-index: 1000;
      box-shadow: -4px 0 20px rgba(0, 0, 0, 0.3);
    }

    .chatbot-wrapper.open {
      transform: translateX(0);
    }

    @media (max-width: 768px) {
      .chatbot-wrapper {
        width: 100%;
      }
    }

    .chatbot-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 16px;
      background: var(--bg-tertiary, #16213e);
      border-bottom: 1px solid var(--border-color, rgba(255,255,255,0.1));
    }

    .header-info {
      display: flex;
      align-items: center;
      gap: 12px;
    }

    .bot-avatar {
      width: 40px;
      height: 40px;
      border-radius: 50%;
      background: linear-gradient(135deg, #4ade80, #22c55e);
      display: flex;
      align-items: center;
      justify-content: center;
      color: white;
    }

    .header-text h3 {
      margin: 0;
      font-size: 16px;
      font-weight: 600;
      color: #fff;
    }

    .header-text .status {
      font-size: 12px;
      color: #4ade80;
    }

    .header-actions {
      display: flex;
      gap: 8px;
    }

    .btn-icon {
      width: 36px;
      height: 36px;
      border: none;
      border-radius: 8px;
      background: rgba(255,255,255,0.1);
      color: #fff;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      transition: background 0.2s;
    }

    .btn-icon:hover {
      background: rgba(255,255,255,0.2);
    }

    .chatbot-messages {
      flex: 1;
      overflow-y: auto;
      padding: 16px;
      display: flex;
      flex-direction: column;
      gap: 16px;
    }

    .welcome-message {
      text-align: center;
      padding: 32px 16px;
      color: #fff;
    }

    .welcome-icon {
      width: 80px;
      height: 80px;
      margin: 0 auto 16px;
      background: linear-gradient(135deg, rgba(74, 222, 128, 0.2), rgba(34, 197, 94, 0.2));
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      color: #4ade80;
    }

    .welcome-message h4 {
      margin: 0 0 8px;
      font-size: 18px;
    }

    .welcome-message p {
      margin: 0 0 24px;
      font-size: 14px;
      color: rgba(255,255,255,0.7);
      line-height: 1.5;
    }

    .suggestion-chips {
      display: flex;
      flex-direction: column;
      gap: 8px;
    }

    .chip {
      padding: 10px 16px;
      background: rgba(255,255,255,0.1);
      border: 1px solid rgba(255,255,255,0.2);
      border-radius: 20px;
      color: rgba(255,255,255,0.9);
      font-size: 13px;
      cursor: pointer;
      text-align: left;
      transition: all 0.2s;
    }

    .chip:hover {
      background: rgba(74, 222, 128, 0.2);
      border-color: #4ade80;
      color: #4ade80;
    }

    .message {
      display: flex;
      gap: 10px;
      max-width: 85%;
    }

    .message.user {
      align-self: flex-end;
      flex-direction: row-reverse;
    }

    .message.assistant {
      align-self: flex-start;
    }

    .message-avatar {
      width: 32px;
      height: 32px;
      border-radius: 50%;
      background: linear-gradient(135deg, #4ade80, #22c55e);
      display: flex;
      align-items: center;
      justify-content: center;
      color: white;
      flex-shrink: 0;
    }

    .message-content {
      padding: 12px 16px;
      border-radius: 16px;
      line-height: 1.5;
    }

    .message.user .message-content {
      background: linear-gradient(135deg, #4ade80, #22c55e);
      color: white;
      border-bottom-right-radius: 4px;
    }

    .message.assistant .message-content {
      background: rgba(255,255,255,0.1);
      color: #fff;
      border-bottom-left-radius: 4px;
    }

    .message-content p {
      margin: 0;
      font-size: 14px;
    }

    .timestamp {
      display: block;
      font-size: 10px;
      color: rgba(255,255,255,0.5);
      margin-top: 4px;
    }

    .message-content.typing {
      padding: 16px 20px;
    }

    .typing-indicator {
      display: flex;
      gap: 4px;
    }

    .typing-indicator span {
      width: 8px;
      height: 8px;
      background: rgba(255,255,255,0.5);
      border-radius: 50%;
      animation: typing 1.4s infinite;
    }

    .typing-indicator span:nth-child(2) { animation-delay: 0.2s; }
    .typing-indicator span:nth-child(3) { animation-delay: 0.4s; }

    @keyframes typing {
      0%, 60%, 100% { transform: translateY(0); }
      30% { transform: translateY(-4px); }
    }

    .chatbot-input {
      display: flex;
      gap: 8px;
      padding: 16px;
      background: var(--bg-tertiary, #16213e);
      border-top: 1px solid var(--border-color, rgba(255,255,255,0.1));
    }

    .chatbot-input textarea {
      flex: 1;
      padding: 12px 16px;
      background: rgba(255,255,255,0.1);
      border: 1px solid rgba(255,255,255,0.2);
      border-radius: 12px;
      color: #fff;
      font-size: 14px;
      font-family: inherit;
      resize: none;
      outline: none;
      min-height: 44px;
      max-height: 120px;
    }

    .chatbot-input textarea::placeholder {
      color: rgba(255,255,255,0.5);
    }

    .chatbot-input textarea:focus {
      border-color: #4ade80;
    }

    .btn-send {
      width: 44px;
      height: 44px;
      border: none;
      border-radius: 12px;
      background: linear-gradient(135deg, #4ade80, #22c55e);
      color: white;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      transition: opacity 0.2s, transform 0.2s;
      flex-shrink: 0;
    }

    .btn-send:disabled {
      opacity: 0.5;
      cursor: not-allowed;
    }

    .btn-send:not(:disabled):hover {
      transform: scale(1.05);
    }
  `]
})
export class ChatbotContainerComponent {
  readonly chatbotService = inject(ChatbotService);
  readonly messagesContainer = viewChild<ElementRef<HTMLDivElement>>('messagesContainer');
  readonly messageInput = viewChild<ElementRef<HTMLTextAreaElement>>('messageInput');

  inputMessage = '';

  constructor() {
    effect(() => {
      if (this.chatbotService.messages().length > 0) {
        setTimeout(() => this.scrollToBottom(), 100);
      }
    });
  }

  onEnterKey(event: Event): void {
    const keyEvent = event as KeyboardEvent;
    if (!keyEvent.shiftKey) {
      event.preventDefault();
      this.sendMessage();
    }
  }

  sendMessage(): void {
    if (!this.inputMessage.trim() || this.chatbotService.isLoading()) return;
    const text = this.inputMessage;
    this.inputMessage = '';
    this.chatbotService.sendMessage(text).subscribe();
  }

  sendSuggestion(text: string): void {
    this.inputMessage = text;
    this.sendMessage();
  }

  clearChat(): void {
    if (confirm('Clear this conversation?')) {
      this.chatbotService.clearHistory().subscribe();
    }
  }

  formatTime(dateStr: string): string {
    const date = new Date(dateStr);
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  }

  private scrollToBottom(): void {
    const container = this.messagesContainer()?.nativeElement;
    if (container) {
      container.scrollTop = container.scrollHeight;
    }
  }
}
```

### 5.4 ChatbotButtonComponent

**File:** `src/app/components/chatbot/chatbot-button.component.ts`

```typescript
import { Component, inject, ChangeDetectionStrategy } from '@angular/core';
import { ChatbotService } from './chatbot.service';

@Component({
  selector: 'app-chatbot-button',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <button 
      class="chatbot-btn"
      (click)="chatbotService.openChatbot()"
      title="Chat with AI Assistant"
    >
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <path d="M12 2L2 7L12 12L22 7L12 2Z"/>
        <path d="M2 17L12 22L22 17"/>
        <path d="M2 12L12 17L22 12"/>
      </svg>
      <span>AI Assistant</span>
    </button>
  `,
  styles: [`
    .chatbot-btn {
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 8px 16px;
      background: linear-gradient(135deg, rgba(74, 222, 128, 0.15), rgba(34, 197, 94, 0.15));
      border: 1px solid rgba(74, 222, 128, 0.3);
      border-radius: 10px;
      color: #4ade80;
      font-size: 14px;
      font-weight: 500;
      cursor: pointer;
      transition: all 0.2s;
    }

    .chatbot-btn:hover {
      background: linear-gradient(135deg, rgba(74, 222, 128, 0.25), rgba(34, 197, 94, 0.25));
      border-color: #4ade80;
      transform: translateY(-1px);
    }
  `]
})
export class ChatbotButtonComponent {
  readonly chatbotService = inject(ChatbotService);
}
```

### 5.5 Layout Integration

#### AdminLayout (`admin-layout.ts`)

The AdminLayout already has a `showAiSidebar` signal. We need to wire the existing "Star AI" button to use `ChatbotService` and add the chatbot container.

```typescript
// Add import
import { ChatbotService } from '../../components/chatbot/chatbot.service';
import { ChatbotContainerComponent } from '../../components/chatbot/chatbot-container.component';
import { ChatbotButtonComponent } from '../../components/chatbot/chatbot-button.component';

// In component decorator, add to imports
imports: [
  // ... existing imports
  ChatbotContainerComponent,
  ChatbotButtonComponent,
],

// In class, inject service
private readonly chatbotService = inject(ChatbotService);

// Remove the existing showAiSidebar signal and use chatbotService.showChatbot instead
```

Update template to include chatbot button and container:

```html
<!-- In header bar, replace the "Star AI" button with -->
<app-chatbot-button></app-chatbot-button>

<!-- At the end of template -->
@if (chatbotService.showChatbot()) {
  <app-chatbot-container></app-chatbot-container>
}
```

#### VolunteerDashboardShell (`volunteer-dashboard-shell.ts`)

Add the chatbot button to the volunteer header:

```typescript
import { ChatbotService } from '../../components/chatbot/chatbot.service';
import { ChatbotContainerComponent } from '../../components/chatbot/chatbot-container.component';
import { ChatbotButtonComponent } from '../../components/chatbot/chatbot-button.component';
```

Update template similarly to AdminLayout.

---

## 6. N8N Workflow Setup

### 6.1 Workflow Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                    N8N Chatbot Workflow                        │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  Webhook (POST /webhook/chatbot)                               │
│         │                                                      │
│         ▼                                                      │
│  [1] Function: Extract User Context                            │
│         │                                                      │
│         ▼                                                      │
│  [2] Vector Search (Pinecone/Qdrant)                          │
│         │                                                      │
│         ▼                                                      │
│  [3] LLM Node (OpenRouter/Groq - Free Model)                  │
│         │                                                      │
│         ▼                                                      │
│  [4] Function: Format Response                                 │
│         │                                                      │
│         ▼                                                      │
│  [5] HTTP Response Node                                        │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### 6.2 N8N Workflow JSON (Template)

```json
{
  "name": "ServeTrack RAG Chatbot",
  "nodes": [
    {
      "parameters": {
        "httpMethod": "POST",
        "path": "chatbot",
        "responseMode": "responseNode",
        "options": {}
      },
      "id": "webhook-trigger",
      "name": "Webhook Trigger",
      "type": "n8n-nodes-base.webhook",
      "typeVersion": 1
    },
    {
      "parameters": {
        "jsCode": "// Extract and prepare context\nconst input = $input.first().json;\n\nconst userContext = {\n  user_id: input.user_id || null,\n  user_role: input.user_role || 'guest',\n  user_name: input.user_name || 'Guest',\n  session_id: input.session_id || '',\n};\n\nconst knowledgePrompt = `You are ServeTrack AI Assistant for NLCOM (New Life Community Care Foundation).\nHelp volunteers and admins with questions about:\n- Event RSVP and attendance\n- Volunteer profile management\n- ICS team assignments\n- Organization policies and FAQs\n- General inquiries about NLCOM volunteer programs\n\nGuidelines:\n- Be helpful, concise, and friendly\n- If you don't know something, say so\n- Respect user privacy\n- Answer based on the provided knowledge base\n\nUser Context: ${JSON.stringify(userContext)}\n\nUser Message: ${input.message}`;\n\n\nreturn [{json: {knowledgePrompt, userContext, originalMessage: input.message}}];"
      },
      "id": "extract-context",
      "name": "Extract Context",
      "type": "n8n-nodes-base.code",
      "typeVersion": 2
    },
    {
      "parameters": {
        "mode": "runOnceForEachInput",
        "resource": "vectorStore",
        "operation": "search",
        "vectorStore:context2str__qdrant": {},
        "options": {
          "limit": 5,
          "filter": {}
        }
      },
      "id": "vector-search",
      "name": "Vector Search",
      "type": "@n8n/n8n-nodes-langchain.vectorStoreQdrant",
      "typeVersion": 1
    },
    {
      "parameters": {
        "model": "groq/@groq/mixtral-8x7b-32768",
        "options": {
          "temperature": 0.7,
          "maxTokens": 1000
        }
      },
      "id": "llm-node",
      "name": "LLM (Groq - Free)",
      "type": "@n8n/n8n-nodes-langchain.chatGroq",
      "typeVersion": 1
    },
    {
      "parameters": {
        "jsCode": "const input = $input.first().json;\nconst response = {\n  success: true,\n  message: input.response || input.content || 'I apologize, I could not generate a response.',\n  metadata: {\n    model: input.model || 'mixtral-8x7b-32768',\n    tokens: input.usage?.total_tokens || 0,\n    latency_ms: Date.now() - input.timestamp\n  }\n};\n\nreturn [{json: response}];"
      },
      "id": "format-response",
      "name": "Format Response",
      "type": "n8n-nodes-base.code",
      "typeVersion": 2
    },
    {
      "parameters": {
        "respondWith": "json",
        "responseBody": "={{ $json }}"
      },
      "id": "http-response",
      "name": "HTTP Response",
      "type": "n8n-nodes-base.respondToWebhook",
      "typeVersion": 1
    }
  ],
  "connections": {
    "Webhook Trigger": {
      "main": [[{"node": "Extract Context", "type": "main", "index": 0}]]
    },
    "Extract Context": {
      "main": [[{"node": "Vector Search", "type": "main", "index": 0}]]
    },
    "Vector Search": {
      "main": [[{"node": "LLM (Groq - Free)", "type": "main", "index": 0}]]
    },
    "LLM (Groq - Free)": {
      "main": [[{"node": "Format Response", "type": "main", "index": 0}]]
    },
    "Format Response": {
      "main": [[{"node": "HTTP Response", "type": "main", "index": 0}]]
    }
  }
}
```

### 6.3 N8N Setup Instructions

#### Step 1: Get Free API Keys

**Groq (Recommended - Fastest):**
1. Visit https://console.groq.com/keys
2. Create account (free)
3. Generate API key
4. Use model: `mixtral-8x7b-32768` or `llama-3.3-70b-versatile`

**OpenRouter (More models):**
1. Visit https://openrouter.ai/keys
2. Create account
3. Generate API key
4. Use model: `deepseek-ai/deepseek-chat-v3-0324` or `anthropic/claude-3-haiku`

#### Step 2: Set Up N8N

**Option A: Self-hosted N8N**
```bash
# Using Docker
docker run -d \
  --name n8n \
  -p 5678:5678 \
  -v n8n_data:/home/node/.n8n \
  -e N8N_SECURE_COOKIE=false \
  n8nio/n8n
```

**Option B: n8n.cloud (Managed)**
1. Visit https://n8n.io
2. Sign up for free tier
3. Create new workflow

#### Step 3: Create Vector DB (Pinecone - Free Tier)

1. Visit https://www.pinecone.io
2. Create account → Free Starter index
3. Note your API key and index endpoint
4. Configure in N8N Vector Search node

#### Step 4: Import Workflow

1. Open N8N
2. Click "Import from JSON"
3. Paste the workflow JSON above
4. Configure credentials:
   - Groq API key (or OpenRouter)
   - Pinecone API key
5. Activate workflow

---

## 7. Knowledge Base Setup

### 7.1 Document Processing Pipeline

```
Documents (PDF, DOCX, TXT)
    │
    ▼
N8N Document Loader Node
    │
    ▼
Chunking Node (500-1000 char segments)
    │
    ▼
Embeddings Node (OpenAI ada-002 or free alternative)
    │
    ▼
Pinecone Vector DB
    │
▼
Indexed with metadata: category, source
```

### 7.2 Initial Knowledge Categories

#### Volunteer Knowledge
| Topic | Description |
|-------|-------------|
| Registration | How to sign up, invite codes, profile completion |
| RSVP/Voting | How to vote on events, change responses |
| Attendance | How to check-in/out, view history |
| Profile | Update info, photo upload, change password |
| Skills/Training | Add skills, view trainings |
| Lifegroups | Understanding lifegroups |

#### Admin Knowledge
| Topic | Description |
|-------|-------------|
| Dashboard | Analytics overview, metrics |
| ICS Management | Create teams, assign volunteers, AI suggestions |
| Volunteer Management | CRUD operations, restore deleted |
| RSVP Management | Create events, manage responses |
| SMS/Notifications | Configure Twilio, send bulk SMS |
| Backup/Recovery | Database backups, restore procedures |

#### General NLCOM
| Topic | Description |
|-------|-------------|
| Mission | NLCOM vision and mission |
| Events | Types of events (feeding, medical, disaster response) |
| FAQ | Common questions and answers |

### 7.3 Sample FAQ Entries

```json
[
  {
    "category": "volunteer",
    "question": "How do I register for an event?",
    "answer": "To register for an event, go to the Polls section in your dashboard. Find the event you want to join and click 'Vote' to confirm your attendance. You can change your response until the RSVP deadline.",
    "keywords": ["register", "rsvp", "event", "join", "vote"]
  },
  {
    "category": "volunteer",
    "question": "How do I update my profile picture?",
    "answer": "Go to your Profile page, click on your current photo, and select a new image. Supported formats are JPG, PNG, and WEBP. The image should be less than 2MB.",
    "keywords": ["photo", "profile", "picture", "avatar", "upload"]
  },
  {
    "category": "admin",
    "question": "How do I create a new RSVP event?",
    "answer": "Go to Admin Dashboard → RSVPs → Click 'Create New RSVP'. Fill in the event details including title, description, location, shifts, and deadline. Toggle on 'Enable RSVP' when ready.",
    "keywords": ["create", "rsvp", "event", "admin", "new"]
  },
  {
    "category": "general",
    "question": "What is NLCOM?",
    "answer": "NLCOM (New Life Community Care Foundation) is a volunteer organization focused on community service including feeding programs, medical missions, and disaster response operations.",
    "keywords": ["nlcom", "about", "organization", "mission", "foundation"]
  }
]
```

---

## 8. Security Considerations

### 8.1 Rate Limiting
| Endpoint | Limit |
|----------|-------|
| POST /api/chatbot/message | 10/min per user |
| GET /api/chatbot/history | 30/min per user |
| POST /api/chatbot/clear | 5/min per user |

### 8.2 Input Validation
- Maximum message length: 4000 characters
- HTML/script tags stripped via existing middleware
- Session ID validated as UUID format

### 8.3 Data Privacy
- User messages stored in database
- Only authenticated users can use chatbot
- Conversation history is user-specific
- No PII exposed in N8N webhook (only user_id, role, name)

### 8.4 N8N Security
- Use HTTPS for N8N instance
- Set webhook authentication header
- Rotate API keys periodically
- Enable N8N logging for audit

---

## 9. Implementation Phases

| Phase | Task | Effort | Dependencies |
|-------|------|--------|--------------|
| **1** | Laravel: Migration, Model, Service | 2 hours | None |
| **2** | Laravel: Controller, Routes, FormRequest | 2 hours | Phase 1 |
| **3** | N8N: Basic workflow (webhook → LLM → response) | 3 hours | Groq/OpenRouter API key |
| **4** | N8N: RAG pipeline (vector DB + embeddings) | 4 hours | Phase 3, Vector DB setup |
| **5** | Angular: ChatbotService + Container | 3 hours | Phase 2 |
| **6** | Angular: Wire into AdminLayout + VolunteerShell | 2 hours | Phase 5 |
| **7** | Testing: Full E2E flow | 3 hours | Phases 1-6 |
| **8** | Knowledge base: Upload & index documents | 4 hours | Phase 4 |

**Estimated Total: ~23 hours**

---

## 10. File Checklist

### Backend (`servetrack-backend/`)

```
CREATE:
  database/migrations/2026_05_11_000001_create_chatbot_conversations_table.php
  database/migrations/2026_05_11_000002_create_chatbot_knowledge_base_table.php
  app/Models/ChatbotConversation.php
  app/Models/ChatbotKnowledgeBase.php
  app/Services/ChatbotService.php
  app/Http/Controllers/Api/ChatbotController.php
  app/Http/Requests/ChatbotMessageRequest.php

MODIFY:
  routes/api.php
  config/services.php
  .env.example
  .env (add chatbot vars)
```

### Frontend (`servetrack-frontend/`)

```
CREATE:
  src/app/models/chatbot.model.ts
  src/app/services/chatbot.service.ts
  src/app/components/chatbot/chatbot-container.component.ts
  src/app/components/chatbot/chatbot-button.component.ts

MODIFY:
  src/app/admin-dashboard/admin-layout/admin-layout.ts
  src/app/admin-dashboard/admin-layout/admin-layout.scss (optional)
  src/app/volunteer-dashboard/volunteer-dashboard-shell/volunteer-dashboard-shell.ts
  src/app/volunteer-dashboard/volunteer-dashboard-shell/volunteer-dashboard-shell.scss (optional)
```

### N8N

```
CREATE:
  servetrack-chatbot-workflow.json (exported from N8N)
```

---

## 11. Testing Plan

### 11.1 Backend Tests
```bash
# Test chatbot message endpoint
php artisan test --filter=Chatbot

# Test rate limiting
# Send 11 requests within a minute, expect 429 on 11th
```

### 11.2 Frontend Tests
```bash
cd servetrack-frontend
npm test -- --reporter=verbose --testPathPattern=chatbot
```

### 11.3 E2E Manual Testing
| Test Case | Expected Result |
|-----------|-----------------|
| Click AI button | Sidebar slides in from right |
| Send "Hello" | Bot responds with greeting |
| Ask about RSVP | Bot provides RSVP instructions |
| Clear chat | Messages removed, welcome shown |
| Send 11+ messages/min | Rate limit error shown |
| Refresh page, reopen chat | History loaded |

---

## 12. Troubleshooting

### Chatbot not responding
1. Check N8N workflow is active
2. Verify N8N webhook URL in .env
3. Check Groq/OpenRouter API key is valid
4. Review N8N execution logs

### Rate limit errors
- Wait 1 minute and retry
- Check if multiple tabs are open
- Adjust rate limit in `bootstrap/app.php`

### CORS errors
- Ensure N8N instance has HTTPS
- Check CORS origins in `config/cors.php`

### Vector search not working
- Verify Pinecone/Qdrant credentials
- Check embeddings were indexed
- Test with small dataset first

---

## 13. Future Enhancements

| Feature | Priority | Description |
|---------|----------|-------------|
| Voice input | Low | Speech-to-text using Web Speech API |
| File attachments | Medium | Upload documents for context |
| Feedback | Medium | Thumbs up/down on responses |
| Analytics | Low | Track popular questions |
| Multi-language | Medium | Support Filipino/English |
| Admin panel | High | Manage knowledge base from UI |

---

**Document Prepared By:** ServeTrack Development Team  
**For:** New Life Community Care Foundation International, Inc.

(End of file - total 785 lines)
