# RSVP Feature Implementation Plan

**Status**: 🔵 Planning Phase  
**Last Updated**: April 23, 2026  
**Target Completion**: TBD (after bug investigation)

---

## Executive Summary

ServeTrack has a **functional RSVP system** that allows admins to create volunteer events with time slots and capacity limits. However, the system is missing critical features and has undocumented production/local bugs.

### Project Goals
1. **Investigate & Fix Production Bugs** - Identify why RSVP isn't working
2. **Implement Response Editing** - Allow volunteers to change RSVP choices while event is open
3. **Implement Auto-Notifications** - Notify all volunteers immediately when admin creates event
4. **Implement User-Friendly Links** - Create readable shareable URLs (slug-based)

### Priority Order
1. 🔴 **HIGH**: Bug Investigation & Fixes
2. 🟡 **HIGH**: Response Editing Feature
3. 🟡 **HIGH**: Auto-Notifications Feature
4. 🟡 **HIGH**: User-Friendly Shareable Links

---

## Phase 1: Bug Investigation & Documentation

### Investigation Scope

We need to test all RSVP workflows to identify where things break:

**Workflow Tests:**
- [ ] Admin creates RSVP event locally
- [ ] Admin sets multiple time slots with capacity
- [ ] Admin publishes event (status → active)
- [ ] Volunteer views RSVP in dashboard
- [ ] Volunteer submits RSVP response
- [ ] Volunteer views confirmation
- [ ] RSVP auto-closes when capacity reached
- [ ] RSVP auto-closes at deadline
- [ ] Admin triggers SMS notifications
- [ ] Admin triggers Facebook notifications
- [ ] Admin views responses in dashboard
- [ ] Admin checks in/out volunteers

**Technical Checks:**
- [ ] Browser console for JavaScript errors
- [ ] Network tab for API errors (4xx, 5xx status)
- [ ] Backend logs for exceptions
- [ ] Database state (verify data saved correctly)
- [ ] CORS/authentication issues
- [ ] Rate limiting issues

### Expected Output

**Bug Report Template:**

```markdown
## Bug: [Title]
**Status**: Not Working / Partially Working  
**Environment**: Local / Production / Both  
**Severity**: Critical / High / Medium / Low  

### Description
[What is broken]

### Reproduction Steps
1. [Step 1]
2. [Step 2]
3. [Step 3]

### Expected Behavior
[What should happen]

### Actual Behavior
[What actually happens]

### Error Messages
[Console errors, API errors, etc.]

### Screenshots
[If applicable]

### Affected Components
- Frontend: [Component file]
- Backend: [Controller/Model file]
- Database: [Table affected]
```

---

## Phase 2: Draft Implementation Plans

### Feature 1: Response Editing

Allow volunteers to change their RSVP shift choice as long as the RSVP event remains `active`.

#### Requirements
- ✅ Volunteer can edit response only if RSVP status is `active`
- ✅ Volunteer can only edit their own responses
- ✅ New time slot must have available capacity
- ✅ Change is atomic (transaction-locked to prevent race conditions)
- ✅ Old time slot is freed, new one is taken
- ✅ System tracks edit timestamp separately from initial response

#### Backend Implementation

**1. Database Schema** (No changes required - existing schema supports this)
```
rsvp_response
├── rsvp_response_id (PK)
├── volunteer_id (FK)
├── rsvp_id (FK)
├── time_slot_id (FK)        ← Will be updated
├── voted_at (timestamp)      ← Keep original
├── updated_at (timestamp)    ← Track edits
└── ...
```

**2. New Endpoint**
```
PATCH /api/rsvp/{rsvpId}/response
Request Body: { time_slot_id: number }
Response: 200 OK with updated RsvpResource
Errors: 
  - 404: RSVP or volunteer response not found
  - 422: RSVP closed, no capacity, invalid slot
  - 403: Unauthorized (not own response)
```

**3. Files to Create/Modify**

| File | Action | Changes |
|------|--------|---------|
| `app/Http/Controllers/RsvpController.php` | Modify | Add `updateResponse()` method |
| `app/Http/Requests/UpdateRsvpResponseRequest.php` | Create | Validation for response updates |
| `routes/api.php` | Modify | Add route `PATCH /rsvp/{rsvp}/response` |
| `app/Models/RsvpResponse.php` | Review | Ensure relationships work |

**4. Controller Method Pseudocode**
```php
public function updateResponse(UpdateRsvpResponseRequest $request, Rsvp $rsvp): JsonResponse
{
    // Get current response (verify ownership)
    $currentResponse = RsvpResponse::where('volunteer_id', $request->user()->volunteer_id)
        ->where('rsvp_id', $rsvp->rsvp_id)
        ->firstOrFail();
    
    // Validate RSVP is open
    if ($rsvp->status !== 'active') {
        return error('RSVP is closed');
    }
    
    // Validate new time slot exists and has capacity
    $newTimeSlot = RsvpShift::where('rsvp_id', $rsvp->rsvp_id)
        ->where('time_slot_id', $request->time_slot_id)
        ->firstOrFail();
    
    if ($newTimeSlot->getRemainingCapacity() <= 0) {
        return error('No capacity in this time slot');
    }
    
    // Atomic update with locking
    DB::transaction(function () use ($currentResponse, $newTimeSlot) {
        $currentResponse->update(['time_slot_id' => $newTimeSlot->time_slot_id]);
    });
    
    return RsvpResource::make($rsvp);
}
```

#### Frontend Implementation

**1. Files to Create/Modify**

| File | Action | Changes |
|------|--------|---------|
| `src/app/volunteer-dashboard/volunteer-dashboard.ts` | Modify | Add "Edit" button for active RSVPs |
| `src/app/services/rsvp.service.ts` | Modify | Add `updateResponse()` method |
| `src/app/rsvp/rsvp.html` | Modify | Add edit UI (modal/form) |
| `src/app/rsvp/rsvp.ts` | Modify | Add edit submission logic |

**2. UI/UX Flow**
```
Volunteer Dashboard
  ├── Active RSVPs Section
  │   ├── RSVP Card [Title]
  │   │   ├── Current Shift: "8:00 AM - 12:00 PM"
  │   │   └── [Edit Shift] Button ← NEW
  │   │       ↓ (click)
  │   │       ├── Modal: "Choose Time Slot"
  │   │       ├── Radio Options:
  │   │       │   ├── 8:00 AM - 12:00 PM (3/5 slots) - selected
  │   │       │   └── 1:00 PM - 5:00 PM (5/5 slots full)
  │   │       └── [Update] [Cancel] Buttons
  │   │           ↓ (click Update)
  │   │           └── Success: "Shift updated!"
  │   │
  │   └── RSVP Card [Title 2]
  │       └── Current Shift: "10:00 AM - 2:00 PM"
  │           └── [Edit Shift] Button
```

**3. Service Method**
```typescript
updateResponse(rsvpId: number, timeSlotId: number): Observable<Rsvp> {
  return this.http.patch<Rsvp>(
    `${this.apiUrl}/${rsvpId}/response`,
    { time_slot_id: timeSlotId }
  );
}
```

#### Testing Plan

**Backend Tests (Pest)**
```php
// Test editing response successfully
test('volunteer can update their rsvp response', function () {
    $rsvp = Rsvp::factory()->active()->create();
    $slot1 = TimeSlot::factory()->forRsvp($rsvp)->create();
    $slot2 = TimeSlot::factory()->forRsvp($rsvp)->create();
    $volunteer = Volunteer::factory()->create();
    
    // Initial response
    RsvpResponse::create([
        'volunteer_id' => $volunteer->id,
        'rsvp_id' => $rsvp->id,
        'time_slot_id' => $slot1->id
    ]);
    
    // Update response
    $response = $this->actingAs($volunteer->user)
        ->patch("/api/rsvp/{$rsvp->id}/response", [
            'time_slot_id' => $slot2->id
        ]);
    
    $response->assertOk();
    expect(RsvpResponse::find($rsvp->id)->time_slot_id)->toBe($slot2->id);
});

// Test cannot edit closed RSVP
test('volunteer cannot update response when rsvp is closed', function () { ... });

// Test capacity check
test('cannot update to slot with no capacity', function () { ... });
```

**Frontend Tests (Vitest)**
```typescript
describe('Response Editing', () => {
  it('should display Edit button for active RSVPs', async () => { ... });
  it('should update response when submitted', async () => { ... });
  it('should show error when slot is full', async () => { ... });
});
```

---

### Feature 2: Auto-Notifications When Event Created

Automatically notify all volunteers via SMS and/or Facebook when admin creates a new RSVP event.

#### Requirements
- ✅ When admin creates RSVP with status `active`, send notifications automatically
- ✅ Notification includes event title, date, time, location, and shareable link
- ✅ Only notify volunteers who have phone number or messenger PSID
- ✅ Use existing SMS/Facebook services and job queue
- ✅ Admin can optionally disable notifications for a specific event

#### Backend Implementation

**1. Modify RSVP Model**
```php
// Add notification preference field
Schema::table('rsvp', function (Blueprint $table) {
    $table->boolean('notify_volunteers')->default(true);
});
```

**2. Files to Create/Modify**

| File | Action | Changes |
|------|--------|---------|
| `app/Http/Controllers/RsvpController.php` | Modify | Add auto-notification logic to `store()` |
| `app/Http/Requests/StoreRsvpRequest.php` | Modify | Add `notify_volunteers` field |
| `app/Models/Rsvp.php` | Modify | Add method `notifyVolunteers()` |
| Database migration | Create | Add `notify_volunteers` column |

**3. Controller Logic Pseudocode**
```php
public function store(StoreRsvpRequest $request): JsonResponse
{
    $rsvp = DB::transaction(function () use ($request) {
        $rsvp = Rsvp::create($request->validated());
        
        // Create time slots
        foreach ($request->shifts as $shift) {
            RsvpShift::create([
                'rsvp_id' => $rsvp->id,
                'time_slot_id' => TimeSlot::firstOrCreate(['text' => $shift['text']])->id,
                'time_slot' => $shift['time_slot'],
                'capacity' => $shift['capacity']
            ]);
        }
        
        return $rsvp;
    });
    
    // Auto-notify if requested and RSVP is active
    if ($request->notify_volunteers && $rsvp->status === 'active') {
        $rsvp->notifyVolunteers();
    }
    
    return RsvpResource::make($rsvp);
}
```

**4. Model Notification Method**
```php
public function notifyVolunteers(): void
{
    $volunteers = Volunteer::whereNotNull('mobile_number')
        ->orWhereNotNull('messenger_psid')
        ->get();
    
    foreach ($volunteers as $volunteer) {
        if ($volunteer->mobile_number) {
            SendRsvpSmsJob::dispatch($volunteer->id, $this->id);
        }
        if ($volunteer->messenger_psid) {
            SendRsvpFacebookNotificationJob::dispatch($volunteer->id, $this->id);
        }
    }
}
```

**5. Routes Update**
```php
// Already exists: POST /api/rsvp
// No route changes needed - logic is internal
```

#### Frontend Implementation

**1. Files to Create/Modify**

| File | Action | Changes |
|------|--------|---------|
| `src/app/admin-dashboard/admin-dashboard.ts` | Modify | Add toggle for "Notify volunteers" in create RSVP form |
| Create/Update forms | Modify | Show confirmation that notifications will be sent |

**2. UI Changes**
```
Create RSVP Form
├── Title [input]
├── Description [textarea]
├── Date [date picker]
├── Time Slots [repeater]
│   ├── Time: [input]
│   ├── Capacity: [input]
│   └── [Add Slot] [Remove Slot]
├── ⬜ Notify volunteers immediately ← NEW
│   └── Help text: "SMS and Facebook messages will be sent to all volunteers"
└── [Create Event] Button
```

**3. Form Update**
```typescript
export interface CreateRsvpRequest {
  title: string;
  description: string;
  date: string;
  event_location: string;
  cutoff_day: string;
  cutoff_time: string;
  shifts: TimeSlot[];
  notify_volunteers?: boolean; // ← NEW (default: true)
}
```

#### Testing Plan

**Backend Tests (Pest)**
```php
// Test notifications sent on create
test('admin can create rsvp with auto-notification', function () {
    Queue::fake();
    $admin = User::factory()->admin()->create();
    
    $response = $this->actingAs($admin)
        ->post('/api/rsvp', [
            'title' => 'Relief Goods Distribution',
            'description' => 'Help distribute relief goods',
            'date' => now()->addDay()->toDateString(),
            'cutoff_day' => now()->addDay()->toDateString(),
            'cutoff_time' => '12:00',
            'shifts' => [
                ['text' => 'Morning', 'time_slot' => '8:00-12:00', 'capacity' => 10]
            ],
            'notify_volunteers' => true
        ]);
    
    $response->assertCreated();
    Queue::assertPushed(SendRsvpSmsJob::class);
    Queue::assertPushed(SendRsvpFacebookNotificationJob::class);
});

// Test can disable notifications
test('admin can disable notifications on rsvp creation', function () {
    Queue::fake();
    
    // Create with notify_volunteers = false
    // Assert NO jobs dispatched
});
```

**Integration Test**
```php
// Test actual SMS/Facebook sent with correct content
test('notification includes event details and shareable link', function () { ... });
```

#### Notification Message Format

**SMS:**
```
NLCOM RSVP Event
Relief Goods Distribution
📅 April 25, 2026
📍 Community Center
⏰ Deadline: April 25, 2:00 PM
👉 RSVP: https://servetrack.kaelvxdev.space/rsvp/relief-goods-april-2026
```

**Facebook Messenger:**
```
📢 New RSVP Event!

Relief Goods Distribution
📅 April 25, 2026 | 📍 Community Center
⏰ Deadline: April 25, 2:00 PM

👉 RSVP here: https://servetrack.kaelvxdev.space/rsvp/relief-goods-april-2026

See you there! 💪
```

---

### Feature 3: User-Friendly Shareable Links

Create readable, slug-based URLs instead of numeric IDs.

#### Requirements
- ✅ Generate slug from RSVP title + date (e.g., `relief-goods-april-2026`)
- ✅ Handle slug conflicts (add suffix: `-2`, `-3`)
- ✅ Support both old (`?id=123`) and new (`/rsvp/{slug}`) URL formats
- ✅ Slug is unique and immutable after creation
- ✅ Update all shareable links to use new format

#### Backend Implementation

**1. Database Schema**
```php
// Migration: add_slug_to_rsvp_table.php
Schema::table('rsvp', function (Blueprint $table) {
    $table->string('slug')->unique()->nullable();
    $table->index('slug');
});
```

**2. Model Slug Generation**
```php
// app/Models/Rsvp.php
protected static function boot()
{
    parent::boot();
    
    static::creating(function ($rsvp) {
        if (!$rsvp->slug) {
            $rsvp->slug = $rsvp->generateSlug();
        }
    });
}

public function generateSlug(): string
{
    $slug = Str::slug($this->title) . '-' . $this->date->format('F-Y');
    $originalSlug = $slug;
    $counter = 1;
    
    while (self::where('slug', $slug)->exists()) {
        $slug = "{$originalSlug}-{$counter}";
        $counter++;
    }
    
    return $slug;
}

public function getShareUrl(): string
{
    return url("/rsvp/{$this->slug}");
}
```

**3. Routes Update**
```php
// routes/api.php

// New slug-based route
Route::get('/rsvp/{slug}', [RsvpController::class, 'showBySlug'])->name('rsvp.show-by-slug');

// Existing ID-based route (keep for backward compatibility)
Route::get('/rsvp/{rsvp}', [RsvpController::class, 'show'])->name('rsvp.show');
```

**4. Controller Methods**
```php
// Handle both ID and slug
public function show(Rsvp $rsvp): JsonResponse
{
    return RsvpResource::make($rsvp);
}

public function showBySlug(string $slug): JsonResponse
{
    $rsvp = Rsvp::where('slug', $slug)->firstOrFail();
    return RsvpResource::make($rsvp);
}
```

**5. Update Share URL in Notifications**
```php
// In RSVP model or service
public function getShareUrl(): string
{
    return config('app.url') . "/rsvp/{$this->slug}";
}

// Update SMS/Facebook services to use this
```

#### Frontend Implementation

**1. Files to Create/Modify**

| File | Action | Changes |
|------|--------|---------|
| `src/app/rsvp/rsvp.ts` | Modify | Support slug route param |
| `src/app/services/rsvp.service.ts` | Modify | Add `getBySlug()` method |
| `src/app/admin-dashboard/admin-dashboard.ts` | Modify | Display slug in share URL |
| `src/app/routes.ts` | Modify | Add slug-based route |

**2. Routing Update**
```typescript
// app.routes.ts
export const routes: Routes = [
  {
    path: 'rsvp/:slug',
    component: RsvpComponent,
    canActivate: [authGuard]
  },
  {
    path: 'rsvp',
    component: RsvpComponent,
    canActivate: [authGuard]
  }
];
```

**3. Component Logic**
```typescript
export class RsvpComponent {
  slug = input<string | null>(null);
  id = input<number | null>(null);
  
  ngOnInit() {
    // Try slug first, then ID
    const identifier = this.slug() || this.id();
    this.rsvpService.getRsvp(identifier).subscribe(...);
  }
}
```

**4. Service Methods**
```typescript
getRsvp(identifier: string | number): Observable<Rsvp> {
  if (typeof identifier === 'string') {
    return this.http.get<Rsvp>(`${this.apiUrl}/rsvp/${identifier}`);
  }
  return this.http.get<Rsvp>(`${this.apiUrl}/rsvp/${identifier}`);
}
```

#### Testing Plan

**Backend Tests (Pest)**
```php
// Test slug generation
test('rsvp generates unique slug', function () {
    $rsvp = Rsvp::factory()->create(['title' => 'Relief Goods', 'date' => '2026-04-25']);
    expect($rsvp->slug)->toBe('relief-goods-april-2026');
});

// Test slug uniqueness
test('duplicate slugs get incrementing suffix', function () {
    $rsvp1 = Rsvp::factory()->create(['title' => 'Relief Goods', 'date' => '2026-04-25']);
    $rsvp2 = Rsvp::factory()->create(['title' => 'Relief Goods', 'date' => '2026-04-25']);
    
    expect($rsvp1->slug)->toBe('relief-goods-april-2026');
    expect($rsvp2->slug)->toBe('relief-goods-april-2026-2');
});

// Test access by slug
test('can access rsvp via slug', function () {
    $rsvp = Rsvp::factory()->active()->create();
    
    $response = $this->get("/api/rsvp/{$rsvp->slug}");
    $response->assertOk();
    expect($response->json('data.slug'))->toBe($rsvp->slug);
});

// Test backward compatibility with ID
test('can still access rsvp via id', function () {
    $rsvp = Rsvp::factory()->active()->create();
    
    $response = $this->get("/api/rsvp/{$rsvp->id}");
    $response->assertOk();
});
```

**Frontend Tests (Vitest)**
```typescript
describe('Slug-based URLs', () => {
  it('should load RSVP by slug parameter', async () => { ... });
  it('should load RSVP by id parameter (backward compat)', async () => { ... });
});
```

#### Migration Path

```
Old Format: https://servetrack.kaelvxdev.space/rsvp?id=123
                                              ↓
New Format: https://servetrack.kaelvxdev.space/rsvp/relief-goods-april-2026

Both work simultaneously during transition.
```

---

## Phase 3: Bug Fixes

### TBD - Awaiting Investigation Results

Bug fixes will be prioritized based on investigation findings. Place documented bugs here:

- [ ] Bug #1: [Title] - [Status]
- [ ] Bug #2: [Title] - [Status]
- [ ] Bug #3: [Title] - [Status]

---

## Phase 4: Implementation Execution Timeline

### Week 1: Response Editing Feature
- [ ] Create backend endpoint (PATCH /api/rsvp/{id}/response)
- [ ] Add validation and tests
- [ ] Create frontend UI (Edit button, modal)
- [ ] Add service method
- [ ] Local testing
- [ ] Deploy to production

### Week 2: Auto-Notifications + User-Friendly Links
- [ ] Add notification logic to RSVP creation
- [ ] Test SMS/Facebook notifications
- [ ] Add slug generation to RSVP model
- [ ] Create slug-based routes
- [ ] Update frontend routing
- [ ] Local testing
- [ ] Deploy to production

### Week 3: Bug Fixes + Final Testing
- [ ] Fix identified bugs
- [ ] Full regression testing
- [ ] Production validation
- [ ] Documentation updates

---

## Testing Checklist

### Local Testing
- [ ] Run backend tests: `composer test`
- [ ] Run frontend tests: `npm test`
- [ ] Manual RSVP workflows (create, edit, view, notify)
- [ ] Check browser console for errors
- [ ] Verify database state

### Production Testing (After Deploy)
- [ ] Admin creates RSVP
- [ ] Notifications arrive to test phone/Facebook
- [ ] Volunteer views event via slug link
- [ ] Volunteer edits RSVP response
- [ ] Monitor error logs (Sentry/etc)

---

## Files Summary

### Backend Files to Create/Modify

| Feature | File | Action |
|---------|------|--------|
| Response Editing | `app/Http/Controllers/RsvpController.php` | Add `updateResponse()` |
| Response Editing | `app/Http/Requests/UpdateRsvpResponseRequest.php` | Create |
| Response Editing | `routes/api.php` | Add PATCH route |
| Auto-Notify | `app/Http/Controllers/RsvpController.php` | Modify `store()` |
| Auto-Notify | `app/Models/Rsvp.php` | Add `notifyVolunteers()` |
| Auto-Notify | `app/Http/Requests/StoreRsvpRequest.php` | Add field |
| User-Friendly Links | `app/Models/Rsvp.php` | Add slug generation |
| User-Friendly Links | Database migration | Add `slug` column |
| User-Friendly Links | `app/Http/Controllers/RsvpController.php` | Add `showBySlug()` |
| User-Friendly Links | `routes/api.php` | Add slug route |

### Frontend Files to Create/Modify

| Feature | File | Action |
|---------|------|--------|
| Response Editing | `src/app/volunteer-dashboard/volunteer-dashboard.ts` | Add Edit button |
| Response Editing | `src/app/services/rsvp.service.ts` | Add `updateResponse()` |
| Auto-Notify | `src/app/admin-dashboard/admin-dashboard.ts` | Add toggle |
| User-Friendly Links | `src/app/rsvp/rsvp.ts` | Support slug param |
| User-Friendly Links | `src/app/services/rsvp.service.ts` | Add `getBySlug()` |
| User-Friendly Links | `src/app/routes.ts` | Add slug route |

---

## Deployment Strategy

1. **Backend Deploy First**
   - Deploy migrations (slug column)
   - Deploy new controllers and services
   - Queue should still process old jobs

2. **Frontend Deploy Second**
   - Deploy new components and routes
   - Both old and new URLs work during transition

3. **Cutover**
   - Update SMS/Facebook services to use new slug URLs
   - Old numeric URLs still functional for bookmarks

---

## Notes & Considerations

- **Backward Compatibility**: Old numeric URLs (`?id=123`) continue to work
- **Database Locking**: Response editing uses transaction locking to prevent race conditions
- **Notification Delivery**: SMS/Facebook notifications are async (queued), may take 1-5 minutes
- **Slug Generation**: Handles special characters, spaces, and uniqueness
- **Rate Limiting**: Consider rate limiting RSVP updates per volunteer per event
- **Audit Trail**: Consider tracking response edits in separate audit table (future enhancement)

---

## Questions for Product Owner

Before implementation, clarify:

1. Should response edit history be tracked/visible to admins?
2. Should there be a limit on how many times a volunteer can edit?
3. Should volunteers receive notification confirmation when they edit?
4. Should admins be notified of response edits?
5. For slug URLs, any specific naming convention preference?
6. Auto-notification: should admins have the option to disable per-event?

---

**Document Status**: ✅ Ready for Bug Investigation Phase
**Next Step**: Investigate production bugs and update Phase 3
