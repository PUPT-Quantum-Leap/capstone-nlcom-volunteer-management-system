# 🤖 ChatBot Agentic Enhancements Plan (AppVengers-Level Parity)

**Status:** Draft — pending review
**Date:** 2026-05-28
**Author:** Quantum Leap Team
**Companion to:** [`docs/CHATBOT_SIDEBAR_IMPLEMENTATION.md`](./CHATBOT_SIDEBAR_IMPLEMENTATION.md), [`docs/RSVP_AUTO_CLOSE_SETUP_GUIDE.md`](./RSVP_AUTO_CLOSE_SETUP_GUIDE.md), [`.agents/plans/n8n-rag-chatbot-merged-plan.md`](../.agents/plans/n8n-rag-chatbot-merged-plan.md)

---

## Executive Summary

`CHATBOT_SIDEBAR_IMPLEMENTATION.md` (Phases 1–6) covers sidebar layout, animations, TTS, voice input, command palette, and base testing. This plan adds **Phases 7–12**, mirroring the production agentic patterns from the AppVengers "Bonzi" chatbot (`C:/kaelDev/Programming/AppDev101/project-appvengers`) and adapting them to ServeTrack's domain.

| # | Feature | Source pattern | ServeTrack adaptation |
|---|---|---|---|
| 7 | Generative UI (Charts) | `chat-chart.ts` + `ChatVisualization` | Volunteer hours, RSVP responses, attendance trends |
| 8 | Smart Action Buttons | `ChatbotAction` + `executeAction()` | Navigate, scroll, open-modal in admin/volunteer dashboards |
| 9 | User Context Injection | `UserContextService` + `UserFinancialContext` | Volunteer stats, RSVPs, hours, points, role |
| 10 | Backend Resiliency | `tryWebhook()` primary/fallback + `@Retryable` | Laravel `Http::retry()` + fallback webhook URL |
| 11 | Traceable Session IDs + Loading UX | `chat-{email}-{random}` + cycling words | Same scheme + ServeTrack-themed loading words |
| 12 | **Agentic RSVP Creation** ⭐ | `add-saving.ts` `prefillFormFromParams()` deep links | Admin describes event → chatbot collects fields → returns deep-link button → opens prefilled RSVP modal |

**Total estimated effort:** 5–7 sprints (in addition to Phases 1–6).

**Confirmed scope:** The agentic prefill targets the **RSVP create form only** (`/admin-dashboard/rsvps` modal). ICS, SMS, polls, and other admin forms are explicitly out of scope for this plan.

---

## Table of Contents

7. [Phase 7 — Generative UI (Inline Charts)](#phase-7--generative-ui-inline-charts)
8. [Phase 8 — Smart Action Buttons](#phase-8--smart-action-buttons)
9. [Phase 9 — User Context Injection](#phase-9--user-context-injection)
10. [Phase 10 — Backend Resiliency (Primary/Fallback + Retry)](#phase-10--backend-resiliency-primaryfallback--retry)
11. [Phase 11 — Traceable Session IDs + Dynamic Loading UX](#phase-11--traceable-session-ids--dynamic-loading-ux)
12. [Phase 12 — ⭐ Agentic RSVP Event Creation](#phase-12--agentic-rsvp-event-creation)
13. [n8n Workflow Updates](#n8n-workflow-updates)
14. [Testing Strategy](#testing-strategy)
15. [Commit & Rollout Plan](#commit--rollout-plan)

---

## Phase 7 — Generative UI (Inline Charts)

### Goal
Bot can return data that renders as `doughnut` / `pie` / `bar` / `line` charts directly inside chat bubbles — not just markdown.

### Frontend changes

**1. New dependency**
- `ng2-charts` (^6.x, peer dep `chart.js@^4`). Both already widely used and lightweight.
- Run `npm install ng2-charts chart.js` (frontend only). Per AGENTS.md: get approval before locking versions in `package.json`.

**2. Extend `chatbot.model.ts`** (`servetrack-frontend/src/app/models/chatbot.model.ts`)

```typescript
export interface ChatVisualization {
  type: 'doughnut' | 'pie' | 'bar' | 'line';
  title?: string;
  data: { labels: string[]; values: number[] };
  colors?: string[]; // hex
}

export interface ChatMessage {
  id?: string;
  role: 'user' | 'assistant';
  message: string;
  metadata?: Record<string, unknown>;
  created_at?: string;
  isRetrying?: boolean;
  retryAttempt?: number;
  copied?: boolean;
  // NEW
  visualization?: ChatVisualization;
  action?: ChatbotAction; // see Phase 8
}
```

**3. New component: `ChatChartComponent`**

Path: `servetrack-frontend/src/app/components/chatbot-sidebar/sub-components/chat-chart/chat-chart.ts|html|scss`

Standalone, OnPush, signal-based. Mirrors AppVengers' `chat-chart.ts` with two adjustments:

- Use ServeTrack brand palette: `['#13518c', '#3577b6', '#fbb03b', '#2ecc71', '#e74c3c', '#9b59b6']` (matches `styles.scss` brand tokens).
- Accept `visualization` as an `input()` signal (Angular 21 idiom), not `@Input()`.

Skeleton:

```typescript
@Component({
  selector: 'app-chat-chart',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [BaseChartDirective],
  templateUrl: './chat-chart.html',
})
export class ChatChartComponent {
  readonly visualization = input.required<ChatVisualization>();
  readonly chartData = computed<ChartData>(() => this.buildChartData(this.visualization()));
  readonly chartType = computed<ChartType>(() => this.visualization().type);
  // chartOptions computed similarly, with separate paths for line/bar vs pie/doughnut
}
```

**4. Extend `ChatbotService.parseResponse()`** (will be split into a private helper inside the component, mirroring AppVengers' `extractVisualizationFromText`).

Three extraction patterns:
- ```` ```json …"visualization":… ``` ```` block
- ```` ```json …"type":"bar"… ``` ```` standalone
- Top-level `response.visualization` field from n8n

`isValidVisualization()` guard: type ∈ allowed set, `labels.length === values.length > 0`.

**5. Render in template:**

```html
@if (msg.visualization) {
  <app-chat-chart [visualization]="msg.visualization" />
}
@if (msg.message) {
  <div [innerHTML]="parseMarkdown(msg.message)"></div>
}
```

### n8n workflow updates
Chat workflow's final "Code" node merges visualization into the response when the LLM emits a fenced JSON block. (See [n8n section](#n8n-workflow-updates).)

### ServeTrack chart use-cases (initial)

| Prompt | Expected viz |
|---|---|
| "Show my hours this month" (volunteer) | `bar`, x = week, y = hours |
| "Breakdown of attendance status for the Brigada Eskwela RSVP" (admin) | `doughnut`, labels = registered/checked_in/checked_out/no_show |
| "How many volunteers per department joined last 5 events?" (admin) | `bar` grouped |
| "Attendance trend last 6 months" (admin) | `line` |

### Acceptance criteria
- [ ] Charts render in chat with title + legend
- [ ] Invalid viz JSON gracefully ignored (text still shown)
- [ ] Charts respect `prefers-reduced-motion`
- [ ] Mobile (≤480px): chart shrinks to fit bubble width, no overflow
- [ ] Vitest covers `isValidVisualization` guard + extraction patterns

---

## Phase 8 — Smart Action Buttons

### Goal
Bot messages can include a clickable button that performs `navigate`, `scroll`, or `open-modal` actions inside the SPA — without breaking session.

### Frontend changes

**1. Type additions** (in `chatbot.model.ts`):

```typescript
export interface ChatbotAction {
  type: 'navigate' | 'scroll' | 'open-modal';
  path?: string;                                  // route path
  queryParams?: Record<string, string | number>;  // for navigate / open-modal
  elementId?: string;                             // for scroll
  label?: string;                                 // button text
  icon?: string;                                  // bi-* icon class
}
```

**2. Service method:** `chatbot.service.ts` gains:

```typescript
extractAction(text: string): { action?: ChatbotAction; cleanedText: string }
```

Mirror AppVengers' three patterns:
- ```` ```json {"action":{…}} ``` ```` block
- `[ACTION:navigate:/admin-dashboard/rsvps?openModal=true]` simple inline marker
- Inline `{"action":{…}}` JSON object

Always strip the matched fragment from the displayed text before rendering markdown.

**3. Component method** in `ChatbotSidebarComponent`:

```typescript
executeAction(action: ChatbotAction): void {
  switch (action.type) {
    case 'navigate':
      this.chatbotService.closeChatbot();
      this.router.navigate([action.path], { queryParams: action.queryParams });
      break;
    case 'scroll':
      document.getElementById(action.elementId!)?.scrollIntoView({ behavior: 'smooth' });
      break;
    case 'open-modal':
      this.chatbotService.closeChatbot();
      this.router.navigate([action.path], {
        queryParams: { ...action.queryParams, openModal: action.queryParams?.['openModal'] ?? 'true' },
      });
      break;
  }
}
```

Default labels/icons follow AppVengers' `getDefaultLabel` / `getDefaultIcon` heuristics, adapted:

| Path contains | Label | Icon |
|---|---|---|
| `rsvps` | "Open RSVP form" | `bi-calendar-plus` |
| `ics` | "Open ICS dashboard" | `bi-diagram-3` |
| `attendance` | "View attendance" | `bi-clipboard-check` |
| `volunteers` | "View volunteers" | `bi-people` |
| `polls` | "Open polls" | `bi-bar-chart` |

**4. Template:**

```html
@if (msg.action) {
  <button type="button" class="chat-action-btn" (click)="executeAction(msg.action)">
    <i [class]="msg.action.icon ?? 'bi-arrow-right-circle'"></i>
    {{ msg.action.label ?? 'Take action' }}
  </button>
}
```

Style follows the existing brand tokens in `styles/chatbot-sidebar/_messages.scss` (Phase 2 from the parent plan).

### Security notes
- All `path` values are matched against an allow-list of known SPA routes (constant `KNOWN_ROUTES`); unknown paths fall back to a no-op + console warning.
- `queryParams` sanitized by Angular's `Router.navigate` URL serializer — no manual `location.href` assignment.
- `scroll` `elementId` validated against `/^[a-zA-Z0-9_-]+$/`.

### Acceptance criteria
- [ ] All three extraction patterns parse correctly (Vitest unit tests)
- [ ] Unknown action types log warning, do nothing, do not crash
- [ ] Navigation closes the sidebar (matches AppVengers UX)
- [ ] `open-modal` always appends `openModal` query param so the target component can react
- [ ] Action button is keyboard-focusable (`tabindex` default), has `aria-label`

---

## Phase 9 — User Context Injection

### Goal
Every message sent to n8n carries the user's role + key stats so the AI agent never has to "ask who you are" or re-query the database.

### Backend changes

**1. New service:** `app/Services/UserContextService.php`

```php
namespace App\Services;

use App\Models\User;

class UserContextService
{
    public function buildContext(User $user): array
    {
        return [
            'user_id'   => $user->id,
            'name'      => $user->name,
            'email'     => $user->email,
            'role'      => $user->role,                                 // 'admin' | 'volunteer'
            'department'=> $user->department ?? null,
            'stats'     => $this->stats($user),
        ];
    }

    private function stats(User $user): array
    {
        if ($user->role === 'volunteer') {
            return [
                'total_hours'        => $user->volunteerHours()->sum('hours'),
                'events_attended'    => $user->attendances()->where('status', 'checked_out')->count(),
                'upcoming_rsvps'     => $user->rsvpResponses()
                    ->whereHas('rsvp', fn ($q) => $q->where('date', '>=', now())->where('status', 'active'))
                    ->count(),
                'recent_attendance'  => $user->attendances()->latest()->limit(5)->get(['rsvp_id', 'status', 'created_at']),
            ];
        }

        // admin
        return [
            'total_volunteers'   => User::where('role', 'volunteer')->count(),
            'active_rsvps'       => \App\Models\Rsvp::where('status', 'active')->count(),
            'pending_responses'  => \App\Models\RsvpResponse::whereDate('created_at', '>=', now()->subDay())->count(),
        ];
    }
}
```

> Field names assume the existing model relations (`User::volunteerHours`, `User::attendances`, `User::rsvpResponses`). I'll verify them in `app/Models/User.php` before implementation; if any is named differently, I'll match the existing convention.

**2. Refactor `ChatbotController::message()`** to use the service. Keep it thin; logic moves to a new `ChatbotService` (see Phase 10):

```php
public function __construct(
    private ChatbotService $chatbot,
    private UserContextService $context,
) {}

public function message(ChatbotMessageRequest $request): JsonResponse
{
    $user = $request->user();
    $sessionId = $request->validated('session_id') ?? Str::uuid()->toString();

    return response()->json($this->chatbot->dispatch(
        message:    $request->validated('message'),
        sessionId:  $sessionId,
        userContext: $this->context->buildContext($user),
    ));
}
```

**3. n8n agent system prompt** receives `{{ $json.userContext }}` and uses it as context block. Example fragment:

```
You are ServeTrack AI assistant. The current user is:
- Name: {{ $json.userContext.name }}
- Role: {{ $json.userContext.role }}
- Department: {{ $json.userContext.department }}
- Stats: {{ $json.userContext.stats | toJson }}

Use this context to give personalized answers without asking the user to repeat info.
```

### Acceptance criteria
- [ ] Volunteer asking "How many hours did I log?" gets answer without DB tool call
- [ ] Admin asking "How many active RSVPs?" gets answer from injected context
- [ ] Pest feature test for `ChatbotController` asserts `userContext` is forwarded
- [ ] PII guardrail: never echo `email` back in assistant text (system prompt rule)

---

## Phase 10 — Backend Resiliency (Primary/Fallback + Retry)

### Goal
Survive a flaky n8n instance or transient network blip without 500-ing to the user.

### Backend changes

**1. New service:** `app/Services/ChatbotService.php`

```php
namespace App\Services;

use Firebase\JWT\JWT;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Str;

class ChatbotService
{
    public function dispatch(string $message, string $sessionId, array $userContext): array
    {
        $primary  = config('services.chatbot.webhook_url');
        $fallback = config('services.chatbot.webhook_fallback_url');
        $secret   = config('services.chatbot.webhook_jwt_secret');
        $timeout  = (int) config('services.chatbot.timeout', 30);

        $traceableSessionId = $this->buildTraceableSessionId($sessionId, $userContext['email'] ?? null);

        $payload = [
            'message'      => $message,
            'sessionId'    => $traceableSessionId,
            'userContext'  => $userContext,
        ];

        $jwt = JWT::encode(['iss' => 'servetrack-backend', 'exp' => time() + 300], $secret, 'HS256');

        return $this->tryWebhook($primary, $jwt, $payload, $timeout, 'primary')
            ?? $this->tryWebhook($fallback, $jwt, $payload, $timeout, 'fallback')
            ?? $this->serviceUnavailableResponse($traceableSessionId);
    }

    private function tryWebhook(?string $url, string $jwt, array $payload, int $timeout, string $label): ?array
    {
        if (! $url) { return null; }

        try {
            $response = Http::withToken($jwt)
                ->timeout($timeout)
                ->retry(2, 1000, function (\Throwable $e) {
                    return $e instanceof \Illuminate\Http\Client\ConnectionException;
                }, throw: false)
                ->post($url, $payload);

            if ($response->successful()) {
                Log::info("chatbot.webhook.{$label}.ok", ['session' => $payload['sessionId']]);
                $body = $response->json();
                return [
                    'success'    => true,
                    'message'    => $body['output']  ?? $body['response'] ?? $body['message'] ?? '',
                    'action'     => $body['action']        ?? null,
                    'visualization' => $body['visualization'] ?? null,
                    'session_id' => $payload['sessionId'],
                ];
            }

            // 4xx → don't retry/fallback for auth issues; let the caller see the error.
            if ($response->clientError() && in_array($response->status(), [401, 403], true)) {
                return ['success' => false, 'message' => 'Chatbot authentication failed.', 'session_id' => $payload['sessionId']];
            }

            Log::warning("chatbot.webhook.{$label}.unsuccessful", ['status' => $response->status()]);
            return null; // trigger fallback
        } catch (\Throwable $e) {
            Log::error("chatbot.webhook.{$label}.error", ['error' => $e->getMessage()]);
            return null; // trigger fallback
        }
    }

    private function serviceUnavailableResponse(string $sessionId): array
    {
        return [
            'success'    => false,
            'message'    => "Sorry, I'm experiencing technical difficulties. Please try again in a few moments.",
            'session_id' => $sessionId,
        ];
    }

    private function buildTraceableSessionId(?string $rawSessionId, ?string $email): string
    {
        $core = $rawSessionId
            ? preg_replace('/^chat-/', '', $rawSessionId)
            : Str::lower(Str::random(8));

        if (! $email) {
            return "chat-anonymous-{$core}";
        }

        $emailPrefix = Str::lower(Str::before($email, '@'));
        return "chat-{$emailPrefix}-{$core}";
    }
}
```

**2. Config** (`config/services.php`):

```php
'chatbot' => [
    'webhook_url'           => env('CHATBOT_N8N_WEBHOOK_URL'),
    'webhook_fallback_url'  => env('CHATBOT_N8N_WEBHOOK_FALLBACK_URL'),
    'webhook_jwt_secret'    => env('CHATBOT_N8N_WEBHOOK_JWT_SECRET'),
    'timeout'               => (int) env('CHATBOT_N8N_TIMEOUT', 30),
],
```

**3. `.env.example` additions:**

```
CHATBOT_N8N_WEBHOOK_URL=
CHATBOT_N8N_WEBHOOK_FALLBACK_URL=
CHATBOT_N8N_WEBHOOK_JWT_SECRET=
CHATBOT_N8N_TIMEOUT=30
```

**4. `ChatbotController` slims down** to the controller skeleton in Phase 9 — all retry/fallback logic now lives in `ChatbotService`.

### Acceptance criteria
- [ ] Pest test: primary returns 500 → fallback URL is hit, response forwarded
- [ ] Pest test: both fail → 503 with friendly text and stable `session_id`
- [ ] Pest test: 401 from primary → no fallback (auth error surfaces immediately)
- [ ] Connection exception triggers `Http::retry(2, 1000)` before fallback escalation
- [ ] Logs include `session` field for trace correlation

---

## Phase 11 — Traceable Session IDs + Dynamic Loading UX

### 11a. Traceable session IDs
Implemented as part of Phase 10 (`buildTraceableSessionId()`). Output format:
```
chat-{email-prefix}-{8charRandom}     // authenticated
chat-anonymous-{8charRandom}          // not authenticated (public chatbot embeds, if any)
```

The frontend `ChatbotService` already persists session IDs per user (`user_${this.userId}_chatbot_session_id`) — Phase 11 just ensures the **server** rewrites/sanitizes incoming IDs into the traceable form before forwarding.

### 11b. Dynamic loading words
Replace static "..." dots with cycling status text matching the volunteer-management domain:

```typescript
// chatbot-sidebar.component.ts
private readonly LOADING_WORDS = [
  'Thinking…',
  'Analyzing volunteer records…',
  'Checking the schedule…',
  'Looking up RSVPs…',
  'Crunching attendance numbers…',
  'Consulting the knowledge base…',
  'Drafting your answer…',
] as const;

readonly loadingWord = signal(this.LOADING_WORDS[0]);

// inside ngOnInit, mirror Bonzi's interval pattern:
effect(() => {
  if (this.chatbotService.isLoading()) {
    const id = setInterval(() => {
      const next = this.LOADING_WORDS[Math.floor(Math.random() * this.LOADING_WORDS.length)];
      this.loadingWord.set(next);
    }, 800);
    return () => clearInterval(id);
  }
  return undefined;
});
```

### Acceptance criteria
- [ ] Each new conversation produces a unique `chat-{prefix}-{random}` ID visible in Supabase `chatbot_conversations.session_id`
- [ ] Loading indicator cycles word every 800 ms while `isLoading()` is true
- [ ] Cycling stops cleanly on response received (no orphan timers — verified via Vitest fake timers)

---

## Phase 12 — ⭐ Agentic RSVP Event Creation

This is the headline feature. Same UX pattern as AppVengers' "describe a budget → get a prefilled form" flow, retargeted to RSVP creation.

### 12.1 User flow

```
1. Admin opens chatbot, types e.g.
   "Create an RSVP for a feeding program at Brgy. San Isidro on June 15"

2. Bot detects intent. If required fields are missing, asks ONE follow-up at a time:
   - "Got it. What's the cut-off date and time for responses?"
   - "How many volunteer shifts do you need? (e.g. one morning + one afternoon)"
   - "What's the capacity of each shift?"
   - "Any description / instructions for volunteers?"

3. Once the agent has enough info, it returns a confirmation summary +
   a single Smart Action button:

   ┌─────────────────────────────────────────────┐
   │ Here's what I have:                         │
   │ • Title: Feeding Program — San Isidro       │
   │ • Date: June 15, 2026                       │
   │ • Cut-off: June 13, 2026 5:00 PM            │
   │ • Shifts: Morning 8–12 (20), PM 1–5 (15)    │
   │ • Description: …                            │
   │                                             │
   │ Click below to review and save.             │
   │                                             │
   │ [ 📅 Open pre-filled RSVP form ]            │
   └─────────────────────────────────────────────┘

4. Admin clicks button → /admin-dashboard/rsvps?openModal=create-rsvp&...
   The RsvpsComponent reacts to query params, prefills the FormArray of
   shifts, opens the modal. Admin reviews → clicks "Create RSVP" → saved.
```

> The bot **never** auto-submits. The admin always reviews. This matches AppVengers' `add-saving.ts` and aligns with our safety guardrails (medium-risk action requires user confirmation).

### 12.2 Action contract (n8n → frontend)

The chat workflow's final response, when intent is "create RSVP" and all fields collected:

```json
{
  "output": "Here's what I have:\n- **Title:** Feeding Program — San Isidro\n- **Date:** June 15, 2026\n…\n\nClick below to review and save.",
  "action": {
    "type": "open-modal",
    "path": "/admin-dashboard/rsvps",
    "queryParams": {
      "openModal": "create-rsvp",
      "title": "Feeding Program — San Isidro",
      "eventLocation": "Brgy. San Isidro",
      "date": "2026-06-15",
      "cutOffDay": "2026-06-13",
      "cutOffTime": "17:00",
      "description": "Volunteers will help distribute meals to ~200 families.",
      "shifts": "[{\"text\":\"Morning\",\"timeSlot\":\"08:00-12:00\",\"capacity\":20},{\"text\":\"Afternoon\",\"timeSlot\":\"13:00-17:00\",\"capacity\":15}]"
    },
    "label": "Open pre-filled RSVP form",
    "icon": "bi-calendar-plus"
  }
}
```

`shifts` is JSON-stringified because Angular's `Router.navigate` only accepts primitive query param values. Frontend parses with a guarded `JSON.parse`.

### 12.3 Frontend changes

#### `RsvpsComponent` (`servetrack-frontend/src/app/admin-dashboard/rsvps/rsvps.ts`)

Add at constructor / after existing `effect()` blocks:

```typescript
private readonly route = inject(ActivatedRoute);
private readonly toast = inject(ToastService); // assume existing or create
private readonly fb = inject(FormBuilder);

// helper, mirrors AppVengers' parseFlexibleDate
private parseFlexibleDate(input: string | null | undefined, fallbackToToday = false): string {
  if (!input) return '';
  if (/^\d{4}-\d{2}-\d{2}$/.test(input)) return input;
  if (/^\d{4}-\d{2}$/.test(input)) return `${input}-01`;
  if (/^\d{4}$/.test(input)) {
    const today = new Date();
    if (parseInt(input, 10) === today.getFullYear() && fallbackToToday) {
      return today.toISOString().slice(0, 10);
    }
    return `${input}-01-01`;
  }
  return '';
}

private readonly TIME_RX = /^([01]\d|2[0-3]):[0-5]\d$/;

private prefillRsvpFromQueryParams(params: Params): void {
  // Reset shifts FormArray
  this.rsvpShifts.clear();

  // Parse shifts JSON safely
  let shifts: Array<{ text?: string; timeSlot: string; capacity: number }> = [];
  if (typeof params['shifts'] === 'string') {
    try {
      const parsed = JSON.parse(params['shifts']);
      if (Array.isArray(parsed)) {
        shifts = parsed.filter(
          (s) =>
            s &&
            typeof s.timeSlot === 'string' &&
            typeof s.capacity === 'number' &&
            s.capacity > 0,
        );
      }
    } catch {
      /* ignore — admin can still add manually */
    }
  }

  // Default to two empty shifts if none provided (matches openCreateRsvpModal)
  if (shifts.length === 0) {
    this.addRsvpShift();
    this.addRsvpShift();
  } else {
    for (const s of shifts) {
      this.rsvpShifts.push(
        this.fb.group({
          text: [s.text ?? '', Validators.maxLength(100)],
          timeSlot: [s.timeSlot, [Validators.required, Validators.maxLength(50)]],
          capacity: [s.capacity, [Validators.required, Validators.min(1), Validators.max(1000)]],
        }),
      );
    }
  }

  this.rsvpForm.patchValue({
    title:         (params['title'] ?? '').slice(0, 200),
    eventLocation: (params['eventLocation'] ?? '').slice(0, 255),
    date:          this.parseFlexibleDate(params['date'], false),
    cutOffDay:     this.parseFlexibleDate(params['cutOffDay'], false),
    cutOffTime:    this.TIME_RX.test(params['cutOffTime'] ?? '') ? params['cutOffTime'] : '',
    description:   (params['description'] ?? '').slice(0, 2000),
    status:        'active',
  });

  this.editingRsvp.set(null);
  this.lockBodyScroll();
  this.showRsvpModal.set(true);

  this.feedbackType.set('info');
  this.feedbackMessage.set('AI Pre-fill — please review the form carefully before submitting.');
  setTimeout(() => this.feedbackMessage.set(''), 6000);
}

constructor() {
  // …existing constructor body…

  // React to chatbot deep links
  this.route.queryParams.pipe(takeUntilDestroyed(this.destroyRef)).subscribe((params) => {
    if (params['openModal'] === 'create-rsvp') {
      this.prefillRsvpFromQueryParams(params);
    }
  });
}
```

**Why query params (not service-state passing)?**
- Survives a hard refresh / direct paste
- Single source of truth (URL)
- Decouples chatbot from admin-dashboard module
- Mirrors AppVengers exactly — proven pattern

#### Sanitization
- All string fields truncated to backend max lengths (matches `CreateRsvpDto` rules in `app/Http/Requests/StoreRsvpRequest.php` — to be verified during impl)
- `cutOffTime` regex-validated against `HH:MM`
- `shifts` JSON guarded with try/catch + array-shape check
- Reactive form validators **still run** before save — agent prefill is _suggestive_, not authoritative

### 12.4 n8n workflow updates (Chat workflow)

Add a **Tools Agent** with two tools and a structured output:

1. **Tool: `search_knowledge_base`** (existing Pinecone retrieval — unchanged)
2. **Tool: `propose_rsvp_creation`** — function tool that the agent calls when intent matches.
   - Input schema: `{ title, eventLocation?, date, cutOffDay, cutOffTime, description, shifts: [{text?, timeSlot, capacity}] }`
   - The tool's "execution" is just an n8n `Set` node that echoes the validated payload back to the agent so it can compose the action JSON.

**System prompt addition** (Chat workflow's AI Agent node):

```
When the admin (role = 'admin') asks to create an RSVP event:

1. Extract any provided fields. Required fields:
   - title (3+ chars)
   - date (YYYY-MM-DD, future)
   - cutOffDay (YYYY-MM-DD, ≤ date)
   - cutOffTime (HH:MM 24h)
   - description (10+ chars)
   - at least one shift with timeSlot (e.g. "08:00-12:00") and capacity (1-1000)

2. If any required field is missing or invalid, ask ONE concise follow-up question.
   Do NOT call the propose_rsvp_creation tool yet.

3. When all required fields are valid, call the propose_rsvp_creation tool, then
   return a confirmation message in this exact JSON format wrapped in your reply:

   ```json
   {
     "action": {
       "type": "open-modal",
       "path": "/admin-dashboard/rsvps",
       "queryParams": {
         "openModal": "create-rsvp",
         "title": "<title>",
         "eventLocation": "<location or empty>",
         "date": "<YYYY-MM-DD>",
         "cutOffDay": "<YYYY-MM-DD>",
         "cutOffTime": "<HH:MM>",
         "description": "<description>",
         "shifts": "<JSON.stringify(shifts array)>"
       },
       "label": "Open pre-filled RSVP form",
       "icon": "bi-calendar-plus"
     }
   }
   ```

   Above the JSON block, write a friendly bullet-point summary of every field
   so the admin can sanity-check before clicking the button.

4. Never refer to tools, function calls, or n8n in your replies.
5. Reject the request gracefully if the user is not an admin.
```

A final **Code** node in the workflow merges the parsed `action` and the natural-language summary into the response shape Phase 10's backend expects:

```javascript
const llmText = $input.first().json.output ?? '';
const actionMatch = llmText.match(/```json\s*({[\s\S]*?"action"[\s\S]*?})\s*```/);
let action = null;
let outputText = llmText;
if (actionMatch) {
  try { action = JSON.parse(actionMatch[1]).action; } catch { /* keep null */ }
  outputText = llmText.replace(actionMatch[0], '').trim();
}
return [{ json: { output: outputText, action } }];
```

### 12.5 Admin role guard

Backend already enforces `auth:sanctum` on `/api/chatbot/message`. Add a soft check in the system prompt _and_ a hard check in the action consumer:

- `RsvpsComponent` is already only mounted under `path: 'admin-dashboard'` which is guarded by `authGuard` — non-admins never reach the route. ✓
- For volunteer-side accidents (volunteer asks "create an event"), the agent should reply: _"Only admins can create RSVP events. Want me to show you the upcoming ones instead?"_

### 12.6 Acceptance criteria

- [ ] Admin: "Create RSVP for feeding on June 15" → bot asks for cut-off → asks for shifts → asks for description → returns Smart Action button
- [ ] Clicking the button opens `/admin-dashboard/rsvps?openModal=create-rsvp&…` — modal opens **with all fields filled**, with a banner: _"AI Pre-fill — please review…"_
- [ ] Bad date in URL (`/admin-dashboard/rsvps?openModal=create-rsvp&date=lol`) → modal opens with date field empty (no crash, no console error)
- [ ] Malformed `shifts` JSON → falls back to two empty shift rows
- [ ] Existing reactive validators still block submit when fields are invalid
- [ ] Volunteer asking "create an event" gets the polite reroute message
- [ ] Pest test for n8n payload structure (mock webhook)
- [ ] Vitest test for `prefillRsvpFromQueryParams` covering: happy path, malformed shifts, malformed dates, missing fields, oversized strings (truncation)
- [ ] Direct URL paste (refresh-safe): link still works after page reload

### 12.7 Future extensions (not in scope, just noted)

| Idea | Notes |
|---|---|
| **Bulk SMS draft** (`/admin-dashboard/sms?prefill=…`) | Agent drafts message → admin reviews → sends |
| **Edit RSVP via prompt** (`?openModal=edit-rsvp&id=…`) | Adds diff preview before save |
| **Volunteer self-service** ("Sign me up for the June 15 feeding program") | Server-side action with explicit confirm modal — higher risk, separate plan |

> Per scope confirmation, **ICS prefill is intentionally excluded** — the agentic prefill pattern is RSVP-only. Other admin forms (SMS, edit-RSVP) could reuse the same `prefillFromQueryParams` pattern if a future plan adopts them.

---

## n8n Workflow Updates

### Chat workflow (Workflow B from `n8n-rag-chatbot-merged-plan.md`) — additions

```
Webhook (POST /webhook/chat)
  ↓
Set node — extract { message, sessionId, userContext } from JWT-authed body
  ↓
AI Agent (Tools Agent)
  - System prompt: existing RAG instructions
                 + Phase 9 user-context block
                 + Phase 12 RSVP-creation rules
  - Tools:
      • search_knowledge_base (Pinecone Vector Store Tool)        [existing]
      • propose_rsvp_creation (Function Tool, see 12.4)           [NEW]
      • get_my_volunteer_stats (Function Tool, optional Phase 9)  [optional]
  - Memory: Window Buffer (10), keyed by sessionId                [existing]
  ↓
Code node — split { output, action, visualization } from LLM text  [NEW]
  ↓
Supabase node — insert chatbot_conversations row                   [existing]
  ↓
Respond to Webhook — { output, action, visualization }
```

### Health & ops
- Add a second n8n instance (or duplicate workflow on the same instance with a different webhook path) and point `CHATBOT_N8N_WEBHOOK_FALLBACK_URL` at it. Even one extra workflow URL on the same VM gives Phase 10 something to fall back to during transient workflow restarts.
- n8n credential rotation: same JWT secret used by Laravel and the n8n webhook auth check. Document in `.env.example` only — no secrets in git.

---

## Testing Strategy

### Backend (Pest, `servetrack-backend/tests/Feature/`)

Files to add:
- `tests/Feature/ChatbotControllerTest.php` (extend existing if any)
- `tests/Unit/UserContextServiceTest.php`
- `tests/Unit/ChatbotServiceTest.php`

Cases (datasets where applicable):

```php
it('forwards user context with each message', function () { … });
it('falls back to secondary webhook when primary returns 500', function () { … });
it('returns 503-style payload when both webhooks fail', function () { … });
it('does not fall back on 401 from primary', function () { … });
it('builds traceable session id with email prefix', function () { … });
it('strips existing chat- prefix to avoid duplication', function () { … });

dataset('volunteer stats inputs', [
    [/* user with hours */, /* expected payload subset */],
    [/* user with no attendance */, …],
]);
```

Run with: `php artisan test --compact --filter=Chatbot`

### Frontend (Vitest, `servetrack-frontend/src/app/`)

Files to add or extend:
- `services/chatbot.service.spec.ts` — extend with `extractAction`, `extractVisualization`, `parseFlexibleDate`
- `components/chatbot-sidebar/sub-components/chat-chart/chat-chart.spec.ts` (new)
- `admin-dashboard/rsvps/rsvps.spec.ts` (new)

Critical RSVP prefill cases:

```typescript
describe('RsvpsComponent — chatbot deep link', () => {
  it('prefills the form from valid query params', () => { … });
  it('falls back to empty shifts when shifts JSON is malformed', () => { … });
  it('rejects non-HH:MM cutOffTime', () => { … });
  it('truncates oversized strings to backend limits', () => { … });
  it('opens the modal automatically on openModal=create-rsvp', () => { … });
  it('shows the AI Pre-fill banner', () => { … });
});
```

Run with: `npm test -- --run rsvps.spec.ts`

### E2E sanity (manual)

1. Log in as admin in dev (`composer run dev` + `npm start`)
2. Open chatbot, type the canonical prompt
3. Verify follow-up questions
4. Click the Smart Action button
5. Verify modal opens, fields prefilled, banner shown
6. Verify reactive validators still block invalid submit
7. Save → verify RSVP appears in list

### CI

Both suites already run on PR via `.github/workflows/`. Phase 10 webhook tests should mock `Http::fake()` to keep CI hermetic.

---

## Commit & Rollout Plan

### Commits (in order)

```
feat(chatbot): add ChatVisualization model + ChatChartComponent           [Phase 7]
feat(chatbot): add ChatbotAction model + executeAction in sidebar         [Phase 8]
feat(backend): add UserContextService + inject context into webhook       [Phase 9]
feat(backend): extract ChatbotService with primary/fallback + retries     [Phase 10]
feat(chatbot): traceable session ids + cycling loading words              [Phase 11]
feat(rsvps): prefill modal from query params (chatbot deep link)          [Phase 12 FE]
feat(n8n): publish updated chat workflow JSON with propose_rsvp tool      [Phase 12 n8n]
test: add Pest + Vitest coverage for chatbot agentic features
docs: mark CHATBOT_AGENTIC_ENHANCEMENTS_PLAN.md phases as complete
```

### Feature flags

Add to `environment.ts`:

```typescript
chatbot: {
  // existing flags from CHATBOT_SIDEBAR_IMPLEMENTATION.md
  generativeUiEnabled:    false,  // Phase 7
  smartActionsEnabled:    false,  // Phase 8
  agenticRsvpEnabled:     false,  // Phase 12 — keep OFF until n8n workflow is live
}
```

Each phase enables independently. Production rollout sequence:
1. Phases 7, 8, 11 (UI-only) → flags ON for staging → 24 h soak → prod ON
2. Phases 9, 10 (backend) → deploy with fallback URL pointing at primary (no-op fallback) → flip flag → add real fallback
3. Phase 12 → admin-only beta cohort → all admins → review feedback → general

### Rollback

Same as parent plan: flip flag OFF; UI/UX features fail safe to text-only chat. For Phase 12, the worst-case is the deep-link button does nothing (no crash) because `RsvpsComponent`'s reactive form still requires manual review.

---

## Effort Estimate (additive to Phases 1–6)

| Phase | Est. days | Risk |
|---|---|---|
| 7 — Generative UI | 2–3 | Low (well-trodden ng2-charts) |
| 8 — Smart Actions | 2–3 | Low (pattern proven in AppVengers) |
| 9 — User Context | 2 | Low (existing relations) |
| 10 — Resiliency | 2 | Medium (test fallback edge cases) |
| 11 — Sessions + UX | 1 | Low |
| 12 — Agentic RSVP | 4–5 | Medium-High (n8n prompt engineering + e2e) |
| Tests + docs | 2 | Low |
| **Total** | **15–18 days** | **Medium** |

---

## Final notes

- All scope here is _additive_ to the existing `CHATBOT_SIDEBAR_IMPLEMENTATION.md`. Nothing breaks Phases 1–6.
- The agentic prefill pattern (Phase 12) is intentionally scoped to **RSVP creation only**. The same `prefillFromQueryParams` shape would generalize cleanly if you later want to add SMS-draft or edit-RSVP flows, but those are out of scope here.
