# Poll Feature Implementation

## Overview

This document covers the full-stack implementation of the **Poll** feature for ServeTrack — New Life Community Care Foundation's volunteer management system. The feature enables administrators to create shift-selection polls, volunteers to cast a single vote per poll, and anyone with a share URL to vote via a public-facing page.

**Date**: March 10, 2026  
**Branch**: `feat/poll-platform`  
**Version**: 1.0.0

## Table of Contents

- [Schema Design](#schema-design)
- [Backend — Migrations](#backend--migrations)
- [Backend — Models](#backend--models)
- [Backend — API Layer](#backend--api-layer)
- [Backend — Routes](#backend--routes)
- [Backend — Factories & Tests](#backend--factories--tests)
- [Frontend — Service](#frontend--service)
- [Frontend — Admin Dashboard](#frontend--admin-dashboard)
- [Frontend — Volunteer Dashboard](#frontend--volunteer-dashboard)
- [Frontend — Public Voting Page](#frontend--public-voting-page)
- [Business Rules](#business-rules)
- [API Reference](#api-reference)
- [Known Pre-existing Issues](#known-pre-existing-issues)

---

## Schema Design

### Design Decisions

| Decision | Rationale |
|---|---|
| `option` is a shared lookup table | Options (time slot text) can in principle be reused across polls |
| `capacity` and `time_slot` live on `poll_option` | These are poll-specific attributes of an option, not global attributes |
| Unique constraint on `(volunteer_id, poll_id)` in `poll_vote` | Enforces one vote per volunteer per poll at the database level |
| `status` ENUM: `draft / active / closed` | Admins start polls as drafts, publish when ready, close to stop voting |
| Singular table names (`poll`, `option`, `poll_vote`, `poll_option`) | Consistent with every other table in this schema |

### Entity Relationship

```
poll ──< poll_option >── option
 │                          │
 └──< poll_vote >───────────┘
         │
         └── volunteer
```

### Table Columns

**`poll`**

| Column | Type | Notes |
|---|---|---|
| `poll_id` | BIGINT PK | Auto-increment |
| `title` | VARCHAR(100) | Required |
| `description` | TEXT | Nullable |
| `date` | DATE | Event date |
| `cutoff_day` | VARCHAR(20) | e.g. `Thursday` |
| `cutoff_time` | VARCHAR(20) | e.g. `12NN` |
| `status` | ENUM | `draft` (default), `active`, `closed` |
| `share_url` | VARCHAR(500) | Nullable, public share link |
| `created_at / updated_at` | TIMESTAMP | Laravel timestamps |

**`poll_option`** (junction)

| Column | Type | Notes |
|---|---|---|
| `poll_option_id` | BIGINT PK | |
| `poll_id` | BIGINT FK | → `poll.poll_id` CASCADE |
| `option_id` | BIGINT FK | → `option.option_id` RESTRICT |
| `time_slot` | VARCHAR(100) | e.g. `4:30am - 2:00pm` |
| `capacity` | UNSIGNED INT | Max votes for this option in this poll |

**`poll_vote`**

| Column | Type | Notes |
|---|---|---|
| `poll_vote_id` | BIGINT PK | |
| `volunteer_id` | BIGINT FK | → `volunteer.volunteer_id` CASCADE |
| `poll_id` | BIGINT FK | → `poll.poll_id` CASCADE |
| `option_id` | BIGINT FK | → `option.option_id` RESTRICT |
| `voted_at` | TIMESTAMP | Nullable |
| `sms_sent` | BOOLEAN | Default false |
| `facebook_id` | VARCHAR(100) | Nullable, for public voting |
| `facebook_name` | VARCHAR(100) | Nullable, for public voting |
| UNIQUE | `(volunteer_id, poll_id)` | One vote per volunteer per poll |

---

## Backend — Migrations

**Files changed:**

- `database/migrations/2026_02_28_143509_create_poll_table.php` — Full rewrite
- `database/migrations/2026_02_28_143510_create_poll_option_table.php` — Added `time_slot`, `capacity`
- `database/migrations/2026_02_28_143511_create_poll_vote_table.php` — Added `option_id`, `facebook_id`, `facebook_name`, unique constraint
- `database/migrations/2026_02_28_143512_create_sms_notification_table.php` — Minor FK alignment

All migrations use Laravel's `Blueprint` fluent API and are compatible with both MySQL (production) and SQLite in-memory (testing).

---

## Backend — Models

### `App\Models\Poll`

- `$table = 'poll'` — explicit table name (schema uses singular names)
- `$primaryKey = 'poll_id'`
- Relationships: `options()` BelongsToMany via `poll_option` with `withPivot('poll_option_id', 'time_slot', 'capacity')`, `votes()` HasMany

### `App\Models\Option`

- `$table = 'option'`
- `$primaryKey = 'option_id'`
- `$timestamps = false` — option table has no timestamp columns
- Relationships: `polls()` BelongsToMany, `votes()` HasMany

### `App\Models\PollVote`

- `$table = 'poll_vote'`
- `$primaryKey = 'poll_vote_id'`
- `$timestamps = false`
- Fillable: `volunteer_id`, `poll_id`, `option_id`, `voted_at`, `sms_sent`, `facebook_id`, `facebook_name`
- Relationships: `volunteer()` BelongsTo, `poll()` BelongsTo, `option()` BelongsTo, `smsNotifications()` HasMany

> **Important:** All three models declare `protected $table` explicitly. Without this, Eloquent's default pluralization (`polls`, `options`, `poll_votes`) would fail to match the actual DB tables.

---

## Backend — API Layer

### Form Requests

**`StorePollRequest`** (`app/Http/Requests/StorePollRequest.php`)

- Authorization: `$request->user()->role === 'admin'`
- Validated fields: `title` (required, max:100), `description` (nullable), `date` (required, date), `cutoff_day` (required), `cutoff_time` (required), `status` (in:draft,active,closed), `options` (required array, min:1), `options.*.text`, `options.*.time_slot`, `options.*.capacity` (integer, min:1)

**`UpdatePollRequest`** (`app/Http/Requests/UpdatePollRequest.php`)

- Authorization: same as above
- All fields are `sometimes` (optional); same validation rules apply when present

### Resource

**`PollResource`** (`app/Http/Resources/PollResource.php`)

Converts snake_case DB fields to camelCase for the frontend:

| DB field | JSON key |
|---|---|
| `poll_id` | `id` |
| `cutoff_day` | `cutOffDay` |
| `cutoff_time` | `cutOffTime` |
| `share_url` | `shareUrl` |
| `created_at` | `createdAt` |
| `pivot->time_slot` | `timeSlot` |
| `votes()->count()` | `totalVotes` (poll level) |
| `votes per option` | `votes` (option level) |

### Controller

**`PollController`** (`app/Http/Controllers/PollController.php`)

| Method | HTTP | Path | Auth | Description |
|---|---|---|---|---|
| `index` | GET | `/api/polls` | Any | Admins get all statuses; volunteers get `active` only |
| `show` | GET | `/api/polls/{id}` | Any | Single poll with options |
| `store` | POST | `/api/polls` | Admin | Create poll + options in a transaction |
| `update` | PUT | `/api/polls/{id}` | Admin | Update poll; sync options (preserve voted options) |
| `destroy` | DELETE | `/api/polls/{id}` | Admin | Delete poll (cascades) |
| `updateStatus` | PATCH | `/api/polls/{id}/status` | Admin | Change status only |
| `vote` | POST | `/api/polls/{id}/vote` | Volunteer | Cast a vote; enforces all business rules |

**Vote logic (`vote` method):**

1. Validate `option_id` is present
2. Find poll — 404 if missing
3. Reject if poll status is not `active` — 422
4. Resolve volunteer via `$request->user()->volunteer` — 403 if no profile
5. Check for existing vote — 422 if already voted
6. Verify option belongs to this poll — 422 if not
7. Check capacity against current vote count — 422 if full
8. Create `PollVote` record

---

## Backend — Routes

Added to `routes/api.php` inside the existing `auth:sanctum` middleware group:

```php
Route::get('/polls', [PollController::class, 'index']);
Route::get('/polls/{id}', [PollController::class, 'show']);
Route::post('/polls', [PollController::class, 'store']);
Route::put('/polls/{id}', [PollController::class, 'update']);
Route::delete('/polls/{id}', [PollController::class, 'destroy']);
Route::patch('/polls/{id}/status', [PollController::class, 'updateStatus']);
Route::post('/polls/{id}/vote', [PollController::class, 'vote']);
```

---

## Backend — Factories & Tests

### Factories

**`PollFactory`** (`database/factories/PollFactory.php`)

States: `active()`, `closed()` (default state is `draft`)

**`OptionFactory`** (`database/factories/OptionFactory.php`)

Generates random time slot text from a fixed list.

### Pest Feature Tests

**`tests/Feature/PollTest.php`** — 30 tests, 87 assertions

| Describe block | Tests |
|---|---|
| `GET /api/polls` | Admin sees all statuses, volunteer sees active only, unauthenticated 401, expected JSON shape |
| `GET /api/polls/{id}` | Happy path with options, 404 for missing |
| `POST /api/polls` | Admin creates, volunteer forbidden, missing fields 422, empty options 422, bad option fields 422 |
| `PUT /api/polls/{id}` | Admin updates, 404 for missing, volunteer forbidden |
| `DELETE /api/polls/{id}` | Admin deletes + `assertDatabaseMissing`, 404, volunteer forbidden |
| `PATCH /api/polls/{id}/status` | Status change + `assertDatabaseHas`, invalid value 422, volunteer forbidden |
| `POST /api/polls/{id}/vote` | Happy path, duplicate vote, closed poll, draft poll, wrong option, full capacity, missing `option_id`, 404 poll, unauthenticated, no volunteer profile |

**Running the tests:**

```bash
# Poll tests only
php artisan test --compact tests/Feature/PollTest.php

# Full suite
php artisan test --compact
```

---

## Frontend — Service

**`servetrack-frontend/src/app/services/poll.service.ts`**

Replaced the previous mock-data implementation with real HTTP calls.

| Method | HTTP | Notes |
|---|---|---|
| `getPolls()` | `GET /api/polls` | Returns `Observable<{ data: Poll[] }>` |
| `getPollById(id)` | `GET /api/polls/{id}` | Returns `Observable<{ data: Poll }>` |
| `createPoll(payload)` | `POST /api/polls` | Accepts `Record<string, unknown>` (snake_case) |
| `updatePoll(id, payload)` | `PUT /api/polls/{id}` | Accepts `Record<string, unknown>` |
| `deletePoll(id)` | `DELETE /api/polls/{id}` | |
| `updatePollStatus(id, status)` | `PATCH /api/polls/{id}/status` | |
| `vote(pollId, optionId)` | `POST /api/polls/{id}/vote` | |

---

## Frontend — Admin Dashboard

**`servetrack-frontend/src/app/admin-dashboard/admin-dashboard.ts`**

Key changes to `savePoll()`:

- Sends snake_case field names to match the backend (`cutoff_day`, `cutoff_time`, `time_slot`)
- Each option payload includes `text` (required by `StorePollRequest`)

`loadPolls()` now reads from `response.data` (the Laravel resource collection envelope).

---

## Frontend — Volunteer Dashboard

**`servetrack-frontend/src/app/volunteer-dashboard/volunteer-dashboard.ts`**

Replaced static `PollChoice[]` mock with real API wiring:

**New signals:**

```typescript
polls          = signal<Poll[]>([]);
activePoll     = signal<Poll | null>(null);
selectedOptionId = signal<number | null>(null);
pollError      = signal<string | null>(null);
```

**New methods:**

| Method | Description |
|---|---|
| `loadPolls()` | Calls `PollService.getPolls()`, stores result in `polls` signal |
| `setActivePoll(poll)` | Sets which poll the volunteer is currently viewing |
| `selectOption(optionId)` | Tracks which option is selected |
| `submitPollVote()` | Calls `PollService.vote()`, reloads polls on success |
| `getVotePercentage(poll, option)` | `votes / capacity * 100` |
| `getRemainingSlots(option)` | `capacity - votes` |
| `isOptionFull(option)` | `votes >= capacity` |

**`servetrack-frontend/src/app/volunteer-dashboard/volunteer-dashboard.html`**

Polls section rewritten with:

- Multi-poll tab selector (one tab per active poll)
- Per-option capacity progress bar
- Remaining slots count and `FULL` badge
- Inline error message display
- Disabled submit when no option selected or vote already submitted

---

## Frontend — Public Voting Page

**`servetrack-frontend/src/app/voting-poll/voting-poll.ts`**

Fully refactored to Angular 21 standards:

- `ChangeDetectionStrategy.OnPush`
- `DestroyRef` + `takeUntilDestroyed()` for subscription cleanup
- `inject()` for all dependencies (`ActivatedRoute`, `PollService`, `DestroyRef`)
- Reads poll ID from `?id=` query parameter
- Signals: `poll`, `loading`, `error`, `selectedOptionId`, `submitted`, `submitError`

**`servetrack-frontend/src/app/voting-poll/voting-poll.html`**

Rewritten with Angular 21 native control flow:

- `@if` / `@for` (no `*ngIf` / `*ngFor`)
- Loading spinner state
- Closed poll notice
- Capacity progress bar per option
- Error message display

---

## Business Rules

| Rule | Enforcement |
|---|---|
| Admins see all polls (all statuses) | `PollController::index` checks `role === 'admin'` |
| Volunteers only see `active` polls | Same method filters by status |
| One vote per volunteer per poll | Unique DB constraint + pre-insert check in `vote()` |
| Cannot vote on `draft` or `closed` polls | Status check in `vote()` → 422 |
| Cannot vote for an option not in the poll | Option membership check in `vote()` → 422 |
| Cannot exceed option capacity | Vote count check against `pivot->capacity` → 422 |
| Only admins can create/update/delete/change status | `StorePollRequest` / `UpdatePollRequest` authorization |
| User must have a linked Volunteer record to vote | `$request->user()->volunteer` null check → 403 |

---

## API Reference

### Request payload — Create poll

```json
POST /api/polls
{
  "title": "Mobile Kitchen Operations",
  "description": "Pick your preferred shift.",
  "date": "2026-09-27",
  "cutoff_day": "Thursday",
  "cutoff_time": "12NN",
  "options": [
    { "text": "4:30am - 2:00pm", "time_slot": "4:30am - 2:00pm", "capacity": 15 },
    { "text": "1:00pm - 7:00pm", "time_slot": "1:00pm - 7:00pm", "capacity": 10 }
  ]
}
```

### Response shape — Poll resource

```json
{
  "data": {
    "id": 1,
    "title": "Mobile Kitchen Operations",
    "description": "Pick your preferred shift.",
    "date": "2026-09-27",
    "cutOffDay": "Thursday",
    "cutOffTime": "12NN",
    "status": "draft",
    "shareUrl": null,
    "totalVotes": 0,
    "createdAt": "2026-03-10T08:00:00.000000Z",
    "options": [
      {
        "id": 1,
        "timeSlot": "4:30am - 2:00pm",
        "capacity": 15,
        "votes": 0
      }
    ]
  }
}
```

### Vote

```json
POST /api/polls/{id}/vote
{ "option_id": 1 }

// Success
{ "message": "Vote recorded successfully." }

// Errors (all 422 unless noted)
{ "message": "This poll is not accepting votes." }
{ "message": "You have already voted on this poll." }
{ "message": "Invalid option for this poll." }
{ "message": "This time slot is already at full capacity." }
// 403
{ "message": "Volunteer profile not found." }
// 404
{ "message": "Poll not found." }
```

---

## Known Pre-existing Issues

The following LSP / test issues existed before this feature and are unrelated:

- `AdminController.php`, `CoordinatorController.php` — LSP warning on `Log` import
- `VolunteerController.php`, `VolunteerProfileResource.php` — LSP warning on `url` helper
- `AdminVolunteerTest.php` — LSP false positives on `actingAs`, `getJson`, etc. (tests run fine)
- `ProfilePhotoTest.php` — 7 tests fail with `LogicException` during image file creation (GD library issue in the test environment); pre-dates this feature

---

**Document Information**  
**Created**: March 10, 2026  
**Last Updated**: March 10, 2026  
**Version**: 1.0.0  
**Author**: ServeTrack Development Team  
**Location**: `docs/poll-feature-implementation.md`
