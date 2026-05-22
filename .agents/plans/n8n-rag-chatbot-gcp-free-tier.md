# n8n RAG Chatbot — GCP Always Free Tier Implementation Plan

## Stack Overview

- **Host**: GCP e2-micro VM (Always Free — 1 GB RAM, 30 GB disk)
- **Orchestration**: n8n via Docker (alpine image, SQLite backend)
- **Vector DB**: Pinecone (free tier — 100K vectors)
- **Chat DB**: Supabase (free tier — 500 MB, 50K reads/day)
- **LLMs**: OpenRouter (gateway) + Groq + Gemini
- **Frontend**: Existing Angular app → Laravel proxy → n8n webhooks

---

## Architecture

```
┌─────────────────────────────────────────────────────┐
│  GCP e2-micro VM (1 GB RAM)                         │
│                                                      │
│  Docker: n8n (alpine image, SQLite backend)          │
│  ┌─────────────────────────────────────────────┐    │
│  │  Workflow A: Document Ingestion              │    │
│  │  → Pinecone (upsert vectors)                 │    │
│  │                                               │    │
│  │  Workflow B: Chat Query                       │    │
│  │  → Pinecone (retrieve top 5)                  │    │
│  │  → OpenRouter/Groq/Gemini (LLM)               │    │
│  │  → Supabase (save chat history)               │    │
│  └─────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────┘
         ▲                          │
         │ webhook calls            │
         ▼                          │
┌────────────────────────────────────┐
│  Laravel Backend (existing)        │
│  POST /api/chat → proxies to n8n  │
│  POST /api/ingest → proxies to n8n │
└────────────────────────────────────┘
         ▲                          │
         │ HTTP calls               │
         ▼                          │
┌────────────────────────────────────┐
│  Angular Frontend (existing)       │
│  ChatComponent → ChatbotService    │
│  → calls Laravel API endpoints     │
└────────────────────────────────────┘
```

---

## Phase 1 — GCP & VM Setup

### 1.1 Launch the e2-micro VM

| Setting | Value |
|---|---|
| Machine type | e2-micro (0.25 vCPU, 1 GB RAM) |
| Region | us-west1, us-central1, or us-east1 |
| OS | Ubuntu 24.04 LTS |
| Boot disk | 30 GB standard persistent disk (HDD) |
| Firewall | Allow HTTP (80), HTTPS (443), n8n (5678 — lock to your IP) |
| External IP | Reserve a static IP |

### 1.2 System Setup

```bash
# Update system
sudo apt update && sudo apt upgrade -y

# Install Docker
curl -fsSL https://get.docker.com -o get-docker.sh
sudo sh get-docker.sh
sudo usermod -aG docker $USER

# Install Docker Compose
sudo apt install -y docker-compose-plugin

# Create 2 GB swap file (critical for 1 GB RAM)
sudo fallocate -l 2G /swapfile
sudo chmod 600 /swapfile
sudo mkswap /swapfile
sudo swapon /swapfile
echo '/swapfile none swap sw 0 0' | sudo tee -a /etc/fstab

# Verify swap
sudo swapon --show
```

### 1.3 Reverse Proxy with SSL (recommended)

Using Caddy (simplest auto-SSL):

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

## Phase 2 — External Service Setup

### 2.1 Pinecone (Vector Database)

1. Sign up at [pinecone.io](https://www.pinecone.io/) (free tier)
2. Create a serverless index:
   - **Index name**: `knowledge-base`
   - **Dimensions**: `1536` (matches `text-embedding-3-small`)
   - **Metric**: `cosine`
   - **Cloud/Region**: any supported
3. Save the API key and index host URL for n8n credentials

### 2.2 Supabase (Chat History)

1. Sign up at [supabase.com](https://supabase.com/) (free tier)
2. Create a new project
3. Create the chat history table:

```sql
CREATE TABLE chat_history (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  session_id TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('user', 'assistant')),
  message TEXT NOT NULL,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_chat_history_session ON chat_history(session_id, created_at);
```

4. Get your Supabase URL and anon/service key from Settings → API

### 2.3 OpenRouter (LLM Gateway)

1. Sign up at [openrouter.ai](https://openrouter.ai/)
2. Generate an API key
3. Recommended models to try:
   - **Groq**: `groq/llama3-70b-8192` (fast, free tier)
   - **Gemini**: `google/gemini-1.5-flash` (generous free tier)
   - **OpenRouter**: `openrouter/auto` (auto-routes to cheapest available)

---

## Phase 3 — n8n Deployment (Docker)

### 3.1 Docker Compose

`docker-compose.yml`:
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

### 3.2 Configure n8n Credentials

In the n8n UI (https://your-domain.com):

| Credential | Type | Details |
|---|---|---|
| Pinecone | Pinecone Vector Store | API Key + Index host URL |
| Supabase | HTTP Request (custom) | Base URL + Bearer token |
| OpenRouter | OpenAI (compatible) | API Key, Base URL: `https://openrouter.ai/api/v1` |
| Gemini | Google Gemini | API Key (if using Gemini node directly) |

For OpenRouter via the **OpenAI node**:
- **API Key**: your OpenRouter API key
- **Base URL**: `https://openrouter.ai/api/v1`
- This gives you access to 200+ models including Groq and Gemini through one credential

---

## Phase 4 — n8n Workflows

### 4.1 Workflow A: Document Ingestion

```
Webhook Node → Default Data Loader → Text Splitter → Embeddings → Pinecone (Upsert)
```

| Node | Settings |
|---|---|
| **Webhook** | POST, path: `/ingest`, body contains `{ "document": "..." }` or binary file |
| **Default Data Loader** | Reads PDF/DOCX/TXT/MD from binary input |
| **Recursive Character Text Splitter** | Chunk size: `1000`, Overlap: `200` |
| **Embeddings OpenAI** | Model: `text-embedding-3-small`, Connector: OpenRouter credential |
| **Pinecone Vector Store** | Mode: Upsert, Index: `knowledge-base`, Namespace: `default` (or per-source) |

### 4.2 Workflow B: Chat / Query

```
Webhook Node
  → AI Agent (Tools Agent)
    → LLM: OpenRouter (OpenAI-compatible node)
    → Vector Store Tool → Pinecone (Retrieve, top 5)
    → Window Buffer Memory (last 10 messages)
  → Code Node (save to Supabase)
  → Respond to Webhook
```

#### AI Agent Configuration

**System Prompt**:
```
You are a helpful assistant for the ServeTrack volunteer management system.
Answer questions using ONLY the retrieved context below.
If the context doesn't contain the answer, say so clearly.
Always cite the source document name when referencing information.
Keep answers concise and accurate.
```

**Vector Store Tool**:
- Tool name: `search_knowledge_base`
- Description: `Search the volunteer management knowledge base for relevant information`
- Mode: Retrieve Documents (For Agent/Chain)
- Limit: `5`

#### Supabase Save Node (Code Node or HTTP Request)

After the AI Agent responds, save:
- `session_id`: from the incoming webhook payload
- `role`: "user" for query, "assistant" for response
- `message`: the message text
- `metadata`: `{}` or timing info

---

## Phase 5 — Laravel Proxy Endpoints

### 5.1 Create the Controller

`app/Http/Controllers/N8nProxyController.php`:
```php
<?php

namespace App\Http\Controllers;

use Illuminate\Http\Client\ConnectionException;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Http;

class N8nProxyController extends Controller
{
    private string $n8nBaseUrl;

    public function __construct()
    {
        $this->n8nBaseUrl = config('services.n8n.base_url');
    }

    public function chat(Request $request): JsonResponse
    {
        $request->validate([
            'message' => 'required|string|max:4000',
            'session_id' => 'required|string|max:255',
        ]);

        try {
            $response = Http::timeout(60)
                ->post("{$this->n8nBaseUrl}/webhook/chat", [
                    'message' => $request->input('message'),
                    'session_id' => $request->input('session_id'),
                    'user_id' => $request->user()?->id,
                ]);

            return response()->json($response->json());
        } catch (ConnectionException) {
            return response()->json(['error' => 'Chat service unavailable'], 503);
        }
    }

    public function ingest(Request $request): JsonResponse
    {
        $request->validate([
            'document' => 'required|file|mimes:pdf,docx,txt,md|max:10240',
        ]);

        try {
            $response = Http::timeout(120)
                ->attach('document', $request->file('document')->getContent(), $request->file('document')->getClientOriginalName())
                ->post("{$this->n8nBaseUrl}/webhook/ingest");

            return response()->json($response->json());
        } catch (ConnectionException) {
            return response()->json(['error' => 'Ingestion service unavailable'], 503);
        }
    }
}
```

### 5.2 Register Routes

`routes/api.php`:
```php
use App\Http\Controllers\N8nProxyController;

Route::post('/chat', [N8nProxyController::class, 'chat']);
Route::post('/ingest', [N8nProxyController::class, 'ingest'])->middleware('auth:sanctum');
```

### 5.3 Add Config

`config/services.php`:
```php
'n8n' => [
    'base_url' => env('N8N_BASE_URL', 'http://localhost:5678'),
],
```

`.env`:
```
N8N_BASE_URL=https://your-n8n-domain.com
```

---

## Phase 6 — Angular Frontend Integration

### 6.1 Create/Update Chatbot Service

`servetrack-frontend/src/app/services/chatbot.service.ts`:
```typescript
import { inject, Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';

export interface ChatRequest {
  message: string;
  session_id: string;
}

export interface ChatResponse {
  answer: string;
  sources?: string[];
  session_id: string;
}

@Injectable({ providedIn: 'root' })
export class ChatbotService {
  private http = inject(HttpClient);
  private apiUrl = `${environment.apiUrl}/api`;

  sendMessage(message: string, sessionId: string): Observable<ChatResponse> {
    return this.http.post<ChatResponse>(`${this.apiUrl}/chat`, {
      message,
      session_id: sessionId,
    });
  }
}
```

### 6.2 Wire into Existing Chat Component

The existing `ChatComponent` calls `ChatbotService.sendMessage()` instead of the old API method. The Laravel proxy handles the rest.

---

## Memory Optimization Summary

| Measure | Impact |
|---|---|
| `n8nio/n8n:alpine` image | ~70% smaller container (~150MB vs ~500MB) |
| `--max-old-space-size=512` | Caps Node.js heap at 512 MB |
| 2 GB swap file | Prevents OOM during brief memory spikes |
| `EXECUTIONS_DATA_PRUNE=true` | Auto-deletes old execution data |
| `EXECUTIONS_DATA_MAX_AGE=168` | Keeps only 7 days of execution history |
| SQLite (n8n default) | No extra PostgreSQL container to run |
| External services (Pinecone, OpenRouter, Supabase) | LLM calls and vector search happen off-VM |
| Monitor with `docker stats` | Watch real RAM usage in real-time |

---

## Cost Forecast

| Component | Cost |
|---|---|
| GCP e2-micro VM | **$0/mo** (Always Free) |
| GCP 30 GB persistent disk | **$0/mo** (Always Free) |
| Pinecone (free tier) | **$0/mo** (100K vectors) |
| Supabase (free tier) | **$0/mo** (500 MB DB, 50K reads/day) |
| OpenRouter + Groq + Gemini | **~$0–5/mo** (pay-per-use, depends on volume) |
| **Total** | **$0–5/mo** |

---

## Potential Bottlenecks & Mitigations

| Bottleneck | Mitigation |
|---|---|
| Running out of RAM during heavy workflows | Swap file buys headroom; queue mode if needed later |
| HDD disk latency | Acceptable for SQLite + n8n metadata; vector ops are external |
| Multiple concurrent chat users | Each request blocks until LLM responds; consider upgrading to 2-4 GB VPS if usage grows |
| Pinecone free tier limits (100K vectors) | ~100K chunks ≈ thousands of documents; monitor usage |
| Supabase free tier (50K reads/day) | Cache frequent queries client-side; monitor |

If the e2-micro proves too tight for your workload, the easiest upgrade path is migrating the Docker Compose setup to a Hetzner CAX11 (4 GB RAM, €4.51/mo) without any architecture changes.
