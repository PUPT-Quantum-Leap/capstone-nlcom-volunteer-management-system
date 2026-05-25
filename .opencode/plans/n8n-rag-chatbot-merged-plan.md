# ServeTrack AI Chatbot — Merged Implementation Plan

**Date:** May 22, 2026  
**Approach:** n8n RAG Chatbot on GCP Always Free Tier  
**Source Documents:**
- `docs/AI_CHATBOT_IMPLEMENTATION_PLAN.md` (original full plan)
- `.agents/plans/n8n-rag-chatbot-gcp-free-tier.md` (infrastructure plan)

---

## Architecture

```
┌─────────────────────────────────────────────────────┐
│  GCP e2-micro VM (1 GB RAM, 30 GB HDD)             │
│                                                      │
│  Docker: n8n (alpine + SQLite)                       │
│  ┌─────────────────────────────────────────────┐    │
│  │  Workflow A: Document Ingestion              │    │
│  │  Webhook → Text Splitter → Embeddings        │    │
│  │  → Pinecone (upsert vectors)                 │    │
│  │                                               │    │
│  │  Workflow B: Chat                             │    │
│  │  Webhook → AI Agent                           │    │
│  │    (LLM + Vector Store Tool + Memory)         │    │
│  │  → Supabase (save conversation)               │    │
│  │  → Respond to Webhook                         │    │
│  └─────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────┘
                            ▲
              POST /api/chatbot/* (auth + validate)
                            │
┌─────────────────────────────────────────────────────┐
│  Laravel Backend (thin proxy)                       │
│  - ChatbotController (forward to n8n webhook)       │
│  - ChatbotService (read/clear history via Supabase) │
│  - auth:sanctum + rate limiting + validation        │
└─────────────────────────────────────────────────────┘
         ▲                              │
         │ HTTP                         │
         ▼                              ▼
┌──────────────────┐   ┌────────────────────────────┐
│ Angular Frontend  │   │ External Services (free)   │
│ (already built    │   │                            │
│  from old plan)   │   │ • Pinecone (100K vectors)  │
│                   │   │ • Supabase (chat history)  │
│ ChatbotService →  │   │ • OpenRouter (LLM gateway) │
│ POST /api/chatbot │   │ • Groq / Gemini (via OR)   │
└──────────────────┘   └────────────────────────────┘
```

---

## 1. Key Decisions

| Decision | Choice | Rationale |
|---|---|---|
| **Chat history DB** | Supabase (external PostgreSQL) | Saves 150–300 MB RAM on e2-micro; avoids slow HDD writes |
| **Vector DB** | Pinecone free tier (100K vectors) | Purpose-built vector DB, zero RAM on VM, native n8n node |
| **LLM gateway** | OpenRouter | Single credential for Groq + Gemini + 200+ models |
| **n8n workflow** | AI Agent pattern | Built-in memory, context-aware tool selection |
| **Laravel role** | Thin proxy (auth + validation + history reads) | No MySQL overhead, just auth gateway |
| **Saves to Supabase** | n8n native Supabase node | Avoids MySQL writes on VM entirely |
| **Conversation memory** | n8n Window Buffer Memory (10 messages) | Multi-turn conversations, no re-queries |
| **n8n image** | `n8nio/n8n:alpine` | ~70% smaller, reduces RAM/disk usage |

---

## 2. GCP & VM Setup

### 2.1 Launch the e2-micro VM

| Setting | Value |
|---|---|
| Machine type | e2-micro (0.25 vCPU, 1 GB RAM) |
| Region | us-west1, us-central1, or us-east1 |
| OS | Ubuntu 24.04 LTS |
| Boot disk | 30 GB standard persistent disk (HDD) |
| Firewall | Allow HTTP (80), HTTPS (443), n8n (5678 — lock to your IP) |
| External IP | Reserve a static IP |

### 2.2 System Setup

```bash
# Update system
sudo apt update && sudo apt upgrade -y

# Install Docker
curl -fsSL https://get.docker.com -o get-docker.sh
sudo sh get-docker.sh

# Add user to docker group
sudo usermod -aG docker $USER

# Install Docker Compose plugin
sudo apt install -y docker-compose-plugin

# Create 2 GB swap file (critical for 1 GB RAM)
sudo fallocate -l 2G /swapfile
sudo chmod 600 /swapfile
sudo mkswap /swapfile
sudo swapon /swapfile
echo '/swapfile none swap sw 0 0' | sudo tee -a /etc/fstab

# Verify
free -h && sudo swapon --show
```

### 2.3 Reverse Proxy with SSL (Caddy)

```bash
sudo apt install -y debian-keyring debian-archive-keyring apt-transport-https
curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/gpg.key' | sudo gpg --dearmor -o /usr/share/keyrings/caddy-stable-archive-keyring.gpg
curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/debian.deb.txt' | sudo tee /etc/apt/sources.list.d/caddy-stable.list
sudo apt update && sudo apt install caddy
```

`Caddyfile`:
```
your-domain.com {
    reverse_proxy localhost:5678
}
```

---

## 3. External Service Setup

### 3.1 Pinecone (Vector Database)

1. Sign up at [pinecone.io](https://www.pinecone.io/) (free tier)
2. Create a serverless index:
   - **Index name**: `knowledge-base`
   - **Dimensions**: `1536` (matches `text-embedding-3-small`)
   - **Metric**: `cosine`
   - **Cloud/Region**: any supported
3. Save API key and index host URL for n8n credentials

### 3.2 Supabase (Chat History Database)

1. Sign up at [supabase.com](https://supabase.com/) (free tier: 500 MB, 50K reads/day)
2. Create a new project
3. Create the chat history table:

```sql
CREATE TABLE chatbot_conversations (
  id BIGSERIAL PRIMARY KEY,
  user_id BIGINT NOT NULL,
  session_id TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('user', 'assistant')),
  message TEXT NOT NULL,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_conv_session ON chatbot_conversations(session_id, created_at);
CREATE INDEX idx_conv_user ON chatbot_conversations(user_id);
```

4. Get your Supabase URL and service role key (Settings → API)

### 3.3 OpenRouter (LLM Gateway)

1. Sign up at [openrouter.ai](https://openrouter.ai/)
2. Generate an API key
3. Recommended models to use through OpenRouter:
   - `groq/llama3-70b-8192` (fast, free tier via Groq)
   - `google/gemini-1.5-flash` (generous free tier)
   - `openrouter/auto` (auto-routes to cheapest available)

---

## 4. n8n Deployment (Docker)

### 4.1 Docker Compose

```yaml
services:
  n8n:
    image: n8nio/n8n:alpine
    ports:
      - "5678:5678"
    environment:
      - N8N_METRICS=false
      - EXECUTIONS_DATA_PRUNE=true
      - EXECUTIONS_DATA_MAX_AGE=168
      - NODE_OPTIONS=--max-old-space-size=512
      - WEBHOOK_URL=https://your-domain.com
      - GENERIC_TIMEZONE=America/New_York
    volumes:
      - n8n_data:/home/node/.n8n
    restart: unless-stopped

volumes:
  n8n_data:
```

```bash
docker compose up -d
```

### 4.2 n8n Credentials

| Credential | Type | Details |
|---|---|---|
| **Pinecone** | Pinecone Vector Store | API Key + Index host URL |
| **Supabase** | Supabase | Project URL + Service Role Key |
| **OpenRouter** | OpenAI (compatible) | API Key, Base URL: `https://openrouter.ai/api/v1` |

For OpenRouter: use the **OpenAI node** with custom base URL. This gives access to Groq, Gemini, and 200+ models through one credential.

---

## 5. n8n Workflows

### 5.1 Workflow A — Document Ingestion

**Purpose**: Index documents into Pinecone for RAG retrieval.

```
Webhook / Manual Trigger
  → Read Binary Files / HTTP Request (fetch document)
  → Default Data Loader (PDF, DOCX, TXT, Markdown)
  → Recursive Character Text Splitter
    - Chunk size: 1000 characters
    - Overlap: 200 characters
  → Embeddings OpenAI node (base URL = OpenRouter API)
    - Model: text-embedding-3-small
  → Pinecone Vector Store (Upsert mode)
    - Index: knowledge-base
    - Namespace: default (or per-source)
```

### 5.2 Workflow B — Chat / Query

**Purpose**: Handle user messages with RAG + conversation memory.

```
Webhook (POST /webhook/chat)
  → AI Agent (Tools Agent)
    - System prompt (see below)
    → LLM: OpenRouter via OpenAI-compatible node
      - Model: groq/llama3-70b-8192 (or auto-route)
      - Temperature: 0.3
    → Vector Store Tool → Pinecone
      - Tool name: search_knowledge_base
      - Mode: Retrieve Documents (For Agent/Chain)
      - Limit: top 5
    → Window Buffer Memory
      - Buffer size: 10 messages
      - Session ID: from webhook payload
  → Code Node (extract and shape the response)
  → Supabase Vector Store (Insert mode)
    - Table: chatbot_conversations
    - Save user_id, session_id, role, message, metadata
  → Respond to Webhook
```

**System Prompt**:
```
You are ServeTrack AI Assistant for NLCOM (New Life Community Care Foundation).
Answer questions using ONLY the retrieved context below.
If the context doesn't contain the answer, say so clearly.
Always cite the source document name when referencing information.
Keep answers concise and accurate.

User Context:
- Role: {{user_role}}
- Name: {{user_name}}
```

**Webhook Payload (from Laravel)**:
```json
{
  "message": "user's question",
  "user_id": 123,
  "user_role": "volunteer",
  "user_name": "John Doe",
  "session_id": "uuid-here"
}
```

---

## 6. Laravel Backend

### 6.1 SupabaseService

**File:** `app/Services/SupabaseService.php`

```php
<?php

namespace App\Services;

use Illuminate\Support\Facades\Http;
use Illuminate\Support\Collection;

class SupabaseService
{
    private string $baseUrl;
    private string $serviceKey;

    public function __construct()
    {
        $this->baseUrl = config('services.supabase.url');
        $this->serviceKey = config('services.supabase.service_key');
    }

    public function getHistory(int $userId, string $sessionId, int $limit = 50): array
    {
        $response = Http::withHeaders([
            'apikey' => $this->serviceKey,
            'Authorization' => "Bearer {$this->serviceKey}",
        ])->get("{$this->baseUrl}/rest/v1/chatbot_conversations", [
            'user_id' => "eq.{$userId}",
            'session_id' => "eq.{$sessionId}",
            'order' => 'created_at.asc',
            'limit' => $limit,
        ]);

        return $response->json() ?? [];
    }

    public function clearHistory(int $userId, string $sessionId): void
    {
        Http::withHeaders([
            'apikey' => $this->serviceKey,
            'Authorization' => "Bearer {$this->serviceKey}",
        ])->delete("{$this->baseUrl}/rest/v1/chatbot_conversations", [
            'user_id' => "eq.{$userId}",
            'session_id' => "eq.{$sessionId}",
        ]);
    }
}
```

### 6.2 ChatbotController

**File:** `app/Http/Controllers/Api/ChatbotController.php`

```php
<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Requests\ChatbotMessageRequest;
use App\Services\SupabaseService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Str;

class ChatbotController extends Controller
{
    public function __construct(
        protected SupabaseService $supabase
    ) {}

    public function message(ChatbotMessageRequest $request): JsonResponse
    {
        $user = $request->user();
        $sessionId = $request->input('session_id') ?? Str::uuid()->toString();
        $message = $request->validated('message');

        try {
            $response = Http::timeout(60)->post(config('services.chatbot.n8n_webhook_url'), [
                'message' => $message,
                'user_id' => $user->id,
                'user_role' => $user->role,
                'user_name' => $user->name,
                'session_id' => $sessionId,
            ]);

            $body = $response->json();

            if (! $response->successful()) {
                return response()->json([
                    'success' => false,
                    'message' => 'Chat service error. Please try again.',
                    'session_id' => $sessionId,
                ], 502);
            }

            return response()->json([
                'success' => true,
                'message' => $body['answer'] ?? $body['message'] ?? $body['output'] ?? 'No response.',
                'session_id' => $sessionId,
                'metadata' => $body['metadata'] ?? null,
            ]);
        } catch (\Exception $e) {
            return response()->json([
                'success' => false,
                'message' => 'Chat service unavailable. Please try again later.',
                'session_id' => $sessionId,
            ], 503);
        }
    }

    public function history(Request $request): JsonResponse
    {
        $user = $request->user();
        $sessionId = $request->query('session_id') ?? Str::uuid()->toString();

        $messages = $this->supabase->getHistory($user->id, $sessionId);

        return response()->json([
            'success' => true,
            'data' => $messages,
            'session_id' => $sessionId,
        ]);
    }

    public function clear(Request $request): JsonResponse
    {
        $user = $request->user();
        $sessionId = $request->input('session_id') ?? Str::uuid()->toString();

        $this->supabase->clearHistory($user->id, $sessionId);

        return response()->json([
            'success' => true,
            'message' => 'Conversation cleared.',
            'session_id' => $sessionId,
        ]);
    }
}
```

### 6.3 ChatbotMessageRequest (unchanged from old plan)

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

### 6.4 Routes

**File:** `routes/api.php`

```php
use App\Http\Controllers\Api\ChatbotController;

Route::prefix('chatbot')->middleware(['api', 'auth:sanctum'])->group(function () {
    Route::post('/message', [ChatbotController::class, 'message'])
        ->middleware('throttle:chatbot');
    Route::get('/history', [ChatbotController::class, 'history']);
    Route::post('/clear', [ChatbotController::class, 'clear']);
});
```

### 6.5 Rate Limiter

**File:** `bootstrap/app.php`

```php
RateLimiter::for('chatbot', function (Request $request) {
    return Limit::perMinute(10)->by($request->user()?->id ?: $request->ip());
});
```

### 6.6 Configuration

**File:** `config/services.php`

```php
'supabase' => [
    'url' => env('SUPABASE_URL'),
    'service_key' => env('SUPABASE_SERVICE_KEY'),
],

'chatbot' => [
    'n8n_webhook_url' => env('N8N_CHAT_WEBHOOK_URL'),
],
```

**File:** `.env`

```ini
# Supabase
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_KEY=your-service-role-key

# n8n
N8N_CHAT_WEBHOOK_URL=https://your-n8n-domain.com/webhook/chat
```

---

## 7. Angular Frontend

No new code needed — the frontend is already fully implemented in the old plan.

### Files (from old plan)

| File | Location | Status |
|---|---|---|
| `chatbot.model.ts` | `src/app/models/chatbot.model.ts` | Already coded |
| `chatbot.service.ts` | `src/app/services/chatbot.service.ts` | Already coded |
| `chatbot-container.component.ts` | `src/app/components/chatbot/chatbot-container.component.ts` | Already coded |
| `chatbot-button.component.ts` | `src/app/components/chatbot/chatbot-button.component.ts` | Already coded |

### Only Change Needed

In `chatbot.service.ts`, update the API path from `chatbot` to `api/chatbot` if your environment config uses the full `apiUrl`:

```typescript
// Already points to environment.apiUrl which includes /api
this.http.post(`${this.apiUrl}/chatbot/message`, ...)
```

The service already uses signals, handles loading states, clear history, and welcome screen. It just needs the backend endpoints available to connect.

### Layout Integration

- **AdminLayout**: Replace the existing "Star AI" button with `<app-chatbot-button>`, add `<app-chatbot-container>` at the end of template
- **VolunteerDashboardShell**: Same pattern — add button to header, container at template end

---

## 8. Knowledge Base Setup

### 8.1 Document Processing Pipeline

```
Documents (PDF, DOCX, TXT, MD)
    │
    ▼
n8n Workflow A (Ingestion)
    │
    ├── Text Splitter (1000 char chunks, 200 overlap)
    ├── Embeddings (text-embedding-3-small via OpenRouter)
    └── Pinecone Index ("knowledge-base", 1536d, cosine)
```

### 8.2 Initial Knowledge Categories

| Category | Topics |
|---|---|
| **Volunteer** | Registration, RSVP/Voting, Attendance, Profile, Skills/Training, Lifegroups |
| **Admin** | Dashboard, ICS Management, Volunteer Management, RSVP Management, SMS, Backup |
| **General** | NLCOM mission, Events (feeding, medical, disaster response), FAQ |

---

## 9. Memory & Resource Strategy

On the e2-micro (1 GB RAM, HDD), the following optimizations apply:

| Optimization | Impact |
|---|---|
| **No MySQL container** | Saves ~200 MB RAM (chat history goes to Supabase) |
| **`n8nio/n8n:alpine`** | ~70% smaller image, lighter runtime |
| **`--max-old-space-size=512`** | Caps Node.js heap at 512 MB |
| **2 GB swap file** | Prevents OOM during brief memory spikes |
| **`EXECUTIONS_DATA_PRUNE=true`** | Auto-deletes old execution data, prevents disk fill |
| **`EXECUTIONS_DATA_MAX_AGE=168`** | Keeps only 7 days of execution history |
| **SQLite (n8n default)** | No separate PostgreSQL container needed |
| **External services only** | Pinecone, Supabase, OpenRouter run off-VM |

**Estimated idle RAM**: ~450 MB / 1024 MB (~550 MB headroom for workflow spikes)

---

## 10. Cost Breakdown

| Component | Cost | Notes |
|---|---|---|
| GCP e2-micro VM | **$0/mo** | Always Free in us-west1/central1/east1 |
| GCP 30 GB persistent disk | **$0/mo** | Always Free (HDD) |
| Pinecone free tier | **$0/mo** | 100K vectors, serverless index |
| Supabase free tier | **$0/mo** | 500 MB PostgreSQL, 50K reads/day |
| OpenRouter (pay-per-use) | **$0–5/mo** | Groq has free tier, Gemini generous free tier |
| **Total** | **$0–5/mo** | |

---

## 11. Implementation Phases

| Phase | Task | Effort | Dependencies |
|---|---|---|---|
| **1** | GCP VM creation + Docker + swap + Caddy SSL | 2 hrs | — |
| **2** | External services: Supabase, Pinecone, OpenRouter | 1 hr | — |
| **3** | n8n Docker deploy + credential config | 1 hr | Phase 1 |
| **4** | n8n Workflow A — Ingestion pipeline | 1.5 hrs | Phase 2, 3 |
| **5** | n8n Workflow B — Chat/AI Agent with RAG + memory + Supabase save | 2 hrs | Phase 2, 3 |
| **6** | Laravel: ChatbotController + SupabaseService + routes + rate limiter | 1.5 hrs | Phase 2 (Supabase URL) |
| **7** | Angular: verify components, update route path, test connection | 0.5 hr | Phase 6 |
| **8** | Knowledge base: upload documents, run ingestion, verify retrieval | 2 hrs | Phase 4 |
| **9** | E2E testing: full flow from frontend → Laravel → n8n → Pinecone → LLM → Supabase | 2 hrs | All phases |
| | **Total** | **~13.5 hrs** | |

---

## 12. File Checklist

### Backend (Creations)

```
servetrack-backend/
├── app/
│   ├── Http/
│   │   ├── Controllers/Api/ChatbotController.php
│   │   └── Requests/ChatbotMessageRequest.php
│   └── Services/SupabaseService.php
```

### Backend (Modifications)

```
servetrack-backend/
├── routes/api.php                          # Add chatbot routes
├── config/services.php                     # Add supabase + chatbot config
├── bootstrap/app.php                       # Add rate limiter
├── .env                                    # Add SUPABASE_* and N8N_* vars
└── .env.example                            # Add same vars
```

### Frontend (Already Coded — No Changes Needed)

```
servetrack-frontend/
├── src/app/models/chatbot.model.ts
├── src/app/services/chatbot.service.ts
├── src/app/components/chatbot/
│   ├── chatbot-container.component.ts
│   └── chatbot-button.component.ts
```

### Layout Integration

```
servetrack-frontend/src/app/
├── admin-dashboard/admin-layout/admin-layout.ts
└── volunteer-dashboard/volunteer-dashboard-shell/volunteer-dashboard-shell.ts
```

### n8n

```
Export two workflows from n8n:
├── servetrack-ingestion-workflow.json
└── servetrack-chat-workflow.json
```
