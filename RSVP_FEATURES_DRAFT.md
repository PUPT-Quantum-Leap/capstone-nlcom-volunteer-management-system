# RSVP Features - Detailed Draft Plans

**Status**: 🟡 Draft Phase - Ready for Review & Refinement  
**Last Updated**: April 23, 2026  
**Next Step**: Get user approval on feature designs

---

## Feature 1: Response Editing

Allow volunteers to change their RSVP time slot choice as long as the RSVP event is open (status = `active`).

### User Flow

```
Volunteer Dashboard
├── Active RSVP Card
│   ├── Title: "Relief Goods Distribution"
│   ├── Date: "April 25, 2026"
│   ├── Your Shift: "8:00 AM - 12:00 PM" ← Current selection
│   ├── ⏰ Closes: April 24, 2:00 PM
│   └── [Edit Shift] Button ← NEW
│       │
│       └─→ Edit Modal Opens
│           ├── "Change Your Time Slot"
│           ├── ⭕ 8:00 AM - 12:00 PM (3/5 available) ← Currently selected
│           ├── ⭕ 1:00 PM - 5:00 PM (5/5 FULL) ← Can't select
│           ├── ⭕ 5:00 PM - 9:00 PM (2/5 available) ← Can select
│           └── [Update] [Cancel] Buttons
│               │
│               └─→ On Submit
│                   ├── API Call: PATCH /api/rsvp/{rsvpId}/response
│                   ├── Body: { time_slot_id: 3 }
│                   ├── Success: "Shift updated!"
│                   └── Dashboard updates immediately
```

### Requirements Analysis

| Requirement | Details |
|-------------|---------|
| **When Available** | Only if RSVP status = `active` |
| **Who Can Edit** | Only the volunteer who RSVP'd |
| **What Changes** | Only the time_slot_id |
| **Capacity Check** | New slot must have available capacity |
| **Data Preservation** | Keep original volunteer_id, rsvp_id, voted_at (initial response time) |
| **Update Timestamp** | Record when the edit happened (updated_at) |
| **Cannot Do** | Can't edit once RSVP is closed |
| **Can't Revert** | Once updated, can't go back (but can edit again if still open) |

### Design Decisions

1. **Only time_slot_id changes** - Volunteer can't edit other RSVP details
2. **Atomic transaction** - Edit is all-or-nothing (database locking prevents race conditions)
3. **Preserve audit trail** - Keep voted_at (first response), update updated_at (latest change)
4. **Show remaining capacity** - Let volunteer see before choosing
5. **Can't edit closed events** - Only active RSVPs have Edit button

### Backend Implementation Details

**New Endpoint**
```
PATCH /api/rsvp/{rsvpId}/response
Authentication: Required (Sanctum token)
Authorization: Own volunteer only
Content-Type: application/json

Request Body:
{
  "time_slot_id": 3
}

Success Response (200 OK):
{
  "rsvp_response_id": 5,
  "volunteer_id": 1,
  "rsvp_id": 2,
  "time_slot_id": 3,           ← Updated
  "voted_at": "2026-04-23 10:00:00",   ← Original time
  "updated_at": "2026-04-23 15:30:00"  ← Edit time
}

Error Responses:
- 404 Not Found: RSVP or response doesn't exist
- 403 Forbidden: Not owner of response
- 422 Unprocessable: RSVP closed, slot full, invalid slot
- 401 Unauthorized: Not authenticated
```

**Files to Create/Modify**

| File | Type | Action | Purpose |
|------|------|--------|---------|
| `app/Http/Controllers/RsvpController.php` | PHP | Modify | Add `updateResponse()` method |
| `app/Http/Requests/UpdateRsvpResponseRequest.php` | PHP | Create | Validation for response edits |
| `routes/api.php` | PHP | Modify | Add `PATCH /rsvp/{rsvp}/response` route |
| `app/Models/RsvpResponse.php` | PHP | Review | Ensure relationships correct |
| `tests/Feature/RsvpTest.php` | PHP | Modify | Add tests for editing |

**Controller Logic**
```php
// RsvpController.php

public function updateResponse(UpdateRsvpResponseRequest $request, Rsvp $rsvp): JsonResponse
{
    $volunteer = $request->user()?->volunteer;
    
    // Get existing response or fail
    $response = RsvpResponse::where('volunteer_id', $volunteer->volunteer_id)
        ->where('rsvp_id', $rsvp->rsvp_id)
        ->lockForUpdate()  // Prevent race conditions
        ->firstOrFail();
    
    // Validate RSVP still active
    if ($rsvp->status !== 'active') {
        return response()->json(
            ['message' => 'This RSVP event is closed and cannot be edited'],
            422
        );
    }
    
    // Validate new time slot exists for this RSVP
    $newTimeSlot = RsvpShift::where('rsvp_id', $rsvp->rsvp_id)
        ->where('time_slot_id', $request->time_slot_id)
        ->firstOrFail();
    
    // Check capacity in new slot
    $capacity = $newTimeSlot->capacity ?? 0;
    $reserved = RsvpResponse::where('rsvp_id', $rsvp->rsvp_id)
        ->where('time_slot_id', $request->time_slot_id)
        ->where('volunteer_id', '!=', $volunteer->volunteer_id) // Exclude self
        ->count();
    
    if ($reserved >= $capacity) {
        return response()->json(
            ['message' => 'This time slot is now full. Choose another.'],
            422
        );
    }
    
    // Update response atomically
    DB::transaction(function () use ($response, $request) {
        $response->update([
            'time_slot_id' => $request->time_slot_id,
        ]);
    });
    
    return response()->json(RsvpResource::make($response), 200);
}
```

**Validation Rules**
```php
// UpdateRsvpResponseRequest.php

public function rules(): array
{
    return [
        'time_slot_id' => [
            'required',
            'integer',
            'exists:rsvp_shift,time_slot_id',
        ],
    ];
}

public function messages(): array
{
    return [
        'time_slot_id.required' => 'Please select a time slot',
        'time_slot_id.exists' => 'Selected time slot is invalid',
    ];
}
```

**Route**
```php
// routes/api.php
Route::middleware(['auth:sanctum'])->group(function () {
    Route::patch('/rsvp/{rsvp}/response', [RsvpController::class, 'updateResponse']);
});
```

### Frontend Implementation Details

**Files to Create/Modify**

| File | Type | Action | Purpose |
|------|------|--------|---------|
| `src/app/volunteer-dashboard/volunteer-dashboard.ts` | Angular | Modify | Add Edit button & modal |
| `src/app/services/rsvp.service.ts` | TypeScript | Modify | Add `updateResponse()` method |
| May need modal component | Angular | Create | Reusable edit modal |

**Service Method**
```typescript
// rsvp.service.ts

updateResponse(rsvpId: number, timeSlotId: number): Observable<RsvpResponse> {
  return this.http.patch<RsvpResponse>(
    `${this.apiUrl}/rsvp/${rsvpId}/response`,
    { time_slot_id: timeSlotId }
  ).pipe(
    catchError(error => {
      console.error('Failed to update RSVP response:', error);
      throw error;
    })
  );
}
```

**Dashboard Component Updates**
```typescript
// volunteer-dashboard.ts

export class VolunteerDashboardComponent {
  showEditModal = signal(false);
  editingRsvpId = signal<number | null>(null);
  selectedTimeSlotId = signal<number | null>(null);
  editError = signal<string | null>(null);
  editLoading = signal(false);
  
  openEditModal(rsvp: Rsvp): void {
    this.editingRsvpId.set(rsvp.rsvp_id);
    this.selectedTimeSlotId.set(rsvp.userResponse?.time_slot_id ?? null);
    this.showEditModal.set(true);
  }
  
  submitEdit(): void {
    if (!this.editingRsvpId() || !this.selectedTimeSlotId()) return;
    
    this.editLoading.set(true);
    this.editError.set(null);
    
    this.rsvpService.updateResponse(
      this.editingRsvpId()!,
      this.selectedTimeSlotId()!
    ).subscribe({
      next: (response) => {
        this.editLoading.set(false);
        this.showEditModal.set(false);
        this.loadRsvps(); // Refresh data
        // Show success message
      },
      error: (error) => {
        this.editLoading.set(false);
        this.editError.set(error.error?.message ?? 'Failed to update shift');
      }
    });
  }
}
```

**Template Changes**
```html
<!-- In RSVP card (existing): -->
<div class="rsvp-card">
  <h3>{{ rsvp.title }}</h3>
  <p>Your Shift: {{ userResponseShift(rsvp) }}</p>
  
  <!-- NEW: Edit button -->
  @if (isRsvpActive(rsvp)) {
    <button (click)="openEditModal(rsvp)" class="btn btn-primary">
      Edit Shift
    </button>
  }
</div>

<!-- NEW: Edit Modal -->
@if (showEditModal()) {
  <div class="modal">
    <div class="modal-content">
      <h2>Change Your Time Slot</h2>
      
      <form (ngSubmit)="submitEdit()">
        @for (shift of getActiveRsvpShifts(); track shift.time_slot_id) {
          <label>
            <input 
              type="radio" 
              [value]="shift.time_slot_id"
              [checked]="selectedTimeSlotId() === shift.time_slot_id"
              (change)="selectedTimeSlotId.set(shift.time_slot_id)"
            />
            {{ shift.time_slot }} 
            ({{ getRemainingCapacity(shift) }}/{{ shift.capacity }} available)
            @if (getRemainingCapacity(shift) === 0) {
              <span class="text-red-500">FULL</span>
            }
          </label>
        }
        
        @if (editError()) {
          <p class="error">{{ editError() }}</p>
        }
        
        <button type="submit" [disabled]="editLoading()">
          {{ editLoading() ? 'Updating...' : 'Update' }}
        </button>
        <button type="button" (click)="showEditModal.set(false)">Cancel</button>
      </form>
    </div>
  </div>
}
```

### Testing Plan

**Backend Tests (Pest)**
```php
// tests/Feature/RsvpTest.php

// Test 1: Happy path - edit response successfully
it('allows volunteer to edit their rsvp response', function () {
    $volunteer = Volunteer::factory()->create();
    $user = $volunteer->user;
    
    $rsvp = Rsvp::factory()->active()->create();
    $slot1 = TimeSlot::factory()->forRsvp($rsvp)->create(['text' => 'Morning']);
    $slot2 = TimeSlot::factory()->forRsvp($rsvp)->create(['text' => 'Afternoon']);
    
    // Initial RSVP to slot 1
    RsvpResponse::create([
        'volunteer_id' => $volunteer->volunteer_id,
        'rsvp_id' => $rsvp->rsvp_id,
        'time_slot_id' => $slot1->time_slot_id,
    ]);
    
    // Edit to slot 2
    $response = $this->actingAs($user)
        ->patchJson("/api/rsvp/{$rsvp->rsvp_id}/response", [
            'time_slot_id' => $slot2->time_slot_id,
        ]);
    
    $response->assertOk();
    expect($response->json('data.time_slot_id'))->toBe($slot2->time_slot_id);
});

// Test 2: Cannot edit closed RSVP
it('prevents editing response when rsvp is closed', function () {
    $volunteer = Volunteer::factory()->create();
    $user = $volunteer->user;
    
    $rsvp = Rsvp::factory()->closed()->create();
    $slot = TimeSlot::factory()->forRsvp($rsvp)->create();
    
    RsvpResponse::create([
        'volunteer_id' => $volunteer->volunteer_id,
        'rsvp_id' => $rsvp->rsvp_id,
        'time_slot_id' => $slot->time_slot_id,
    ]);
    
    $response = $this->actingAs($user)
        ->patchJson("/api/rsvp/{$rsvp->rsvp_id}/response", [
            'time_slot_id' => $slot->time_slot_id,
        ]);
    
    $response->assertUnprocessable();
    expect($response->json('message'))->toContain('closed');
});

// Test 3: Cannot edit to full slot
it('prevents editing to a slot with no capacity', function () {
    $volunteer = Volunteer::factory()->create();
    $user = $volunteer->user;
    
    $rsvp = Rsvp::factory()->active()->create();
    $slot1 = TimeSlot::factory()->forRsvp($rsvp)->create(['capacity' => 1]);
    $slot2 = TimeSlot::factory()->forRsvp($rsvp)->create(['capacity' => 1]);
    
    // Fill slot 2
    RsvpResponse::factory()->create([
        'rsvp_id' => $rsvp->rsvp_id,
        'time_slot_id' => $slot2->time_slot_id,
    ]);
    
    // Our volunteer on slot 1
    RsvpResponse::create([
        'volunteer_id' => $volunteer->volunteer_id,
        'rsvp_id' => $rsvp->rsvp_id,
        'time_slot_id' => $slot1->time_slot_id,
    ]);
    
    $response = $this->actingAs($user)
        ->patchJson("/api/rsvp/{$rsvp->rsvp_id}/response", [
            'time_slot_id' => $slot2->time_slot_id,
        ]);
    
    $response->assertUnprocessable();
});

// Test 4: Cannot edit someone else's response
it('prevents editing another volunteer response', function () {
    $vol1 = Volunteer::factory()->create();
    $vol2 = Volunteer::factory()->create();
    
    $rsvp = Rsvp::factory()->active()->create();
    $slot = TimeSlot::factory()->forRsvp($rsvp)->create();
    
    RsvpResponse::create([
        'volunteer_id' => $vol1->volunteer_id,
        'rsvp_id' => $rsvp->rsvp_id,
        'time_slot_id' => $slot->time_slot_id,
    ]);
    
    $response = $this->actingAs($vol2->user)
        ->patchJson("/api/rsvp/{$rsvp->rsvp_id}/response", [
            'time_slot_id' => $slot->time_slot_id,
        ]);
    
    $response->assertNotFound();
});

// Test 5: Preserves original voted_at timestamp
it('preserves original voted_at timestamp', function () {
    $volunteer = Volunteer::factory()->create();
    $user = $volunteer->user;
    
    $rsvp = Rsvp::factory()->active()->create();
    $slot1 = TimeSlot::factory()->forRsvp($rsvp)->create();
    $slot2 = TimeSlot::factory()->forRsvp($rsvp)->create();
    
    $originalVotedAt = now()->subHours(2);
    
    RsvpResponse::create([
        'volunteer_id' => $volunteer->volunteer_id,
        'rsvp_id' => $rsvp->rsvp_id,
        'time_slot_id' => $slot1->time_slot_id,
        'voted_at' => $originalVotedAt,
    ]);
    
    $this->actingAs($user)
        ->patchJson("/api/rsvp/{$rsvp->rsvp_id}/response", [
            'time_slot_id' => $slot2->time_slot_id,
        ]);
    
    $response = RsvpResponse::where('volunteer_id', $volunteer->volunteer_id)
        ->where('rsvp_id', $rsvp->rsvp_id)
        ->first();
    
    expect($response->voted_at)->toEqual($originalVotedAt);
    expect($response->updated_at->isAfter($originalVotedAt))->toBeTrue();
});
```

**Frontend Tests (Vitest)**
```typescript
// Edit modal tests
describe('RSVP Response Editing', () => {
  it('displays Edit Shift button for active RSVPs', () => {
    // Render dashboard with active RSVP
    // Assert Edit button visible
  });
  
  it('opens edit modal when Edit button clicked', () => {
    // Click Edit button
    // Assert modal opens
  });
  
  it('disables full time slots in modal', () => {
    // Open edit modal
    // Assert full slots show FULL label and are disabled
  });
  
  it('submits update when form submitted', () => {
    // Select new time slot
    // Click Update
    // Assert PATCH request sent
  });
  
  it('shows error message on failure', () => {
    // Mock API to return error
    // Submit form
    // Assert error message displayed
  });
  
  it('hides Edit button for closed RSVPs', () => {
    // Render dashboard with closed RSVP
    // Assert Edit button not visible
  });
});
```

### Acceptance Criteria

- ✅ Volunteer can see "Edit Shift" button on active RSVPs
- ✅ Modal opens showing available time slots with capacity
- ✅ Full slots are disabled/marked as full
- ✅ Volunteer can select new slot and submit
- ✅ Database updates with new time_slot_id
- ✅ Original voted_at timestamp preserved
- ✅ Cannot edit closed RSVPs
- ✅ Cannot edit someone else's response
- ✅ Cannot edit to slot with no capacity
- ✅ Success message shown after update
- ✅ Dashboard refreshes with new shift
- ✅ Tests pass (both backend and frontend)

---

## Feature 2: Auto-Notifications When Event Created

Automatically notify all volunteers via SMS and/or Facebook when admin creates a new active RSVP event.

### User Flow

```
Admin Dashboard
├── Create RSVP Form
│   ├── Title: [input]
│   ├── Description: [input]
│   ├── Date: [date picker]
│   ├── Time Slots: [repeater]
│   ├── ⬜ Notify volunteers immediately ← NEW
│   │   └── Help: "SMS and Facebook messages will be sent to all volunteers"
│   └── [Create Event] Button
│       │
│       └─→ Backend Processing
│           ├── Validates form data
│           ├── Creates RSVP record
│           ├── Creates TimeSlot records
│           ├── IF notify_volunteers = true AND status = active:
│           │   ├── Get all volunteers with mobile_number OR messenger_psid
│           │   ├── Queue SendRsvpSmsJob for each volunteer with phone
│           │   └── Queue SendRsvpFacebookNotificationJob for each with PSID
│           └── Returns success
│
├── Admin sees: "Event created! Notifications queued: 47 SMS, 23 Facebook"
│
└─→ Volunteers receive notifications:
    ├── SMS: "NLCOM RSVP Event\nRelief Goods Distribution\n📅 April 25...\n👉 RSVP: https://..."
    └── Facebook: "📢 New RSVP Event!\nRelief Goods Distribution\n📅 April 25...\n👉 RSVP: https://..."
```

### Requirements Analysis

| Requirement | Details |
|-------------|---------|
| **When to Notify** | Immediately after RSVP created with status=active |
| **Who to Notify** | All volunteers with phone number OR messenger PSID |
| **What to Send** | SMS + Facebook Messenger (use existing services) |
| **Include in Notification** | Event title, date, location, deadline, shareable link |
| **Optional** | Admin can disable notifications for specific event |
| **Async** | Use job queue (don't block form submission) |
| **Response** | Show success with count of notifications queued |

### Design Decisions

1. **Auto-on by default** - Notifications enabled unless explicitly disabled
2. **Async/Queued** - Don't wait for notifications to complete
3. **Per-channel opt-in** - Send SMS if phone exists, Facebook if PSID exists
4. **Reuse existing services** - Use SmsService and FacebookService already in place
5. **Show feedback** - Tell admin how many notifications queued

### Backend Implementation Details

**Modify Existing Endpoint**
```
POST /api/rsvp (EXISTING - NO NEW ENDPOINT)
Now includes auto-notification logic after creation
```

**Database Schema Changes**
```php
// Migration: add_notify_volunteers_to_rsvp_table.php
Schema::table('rsvp', function (Blueprint $table) {
    $table->boolean('notify_volunteers')->default(true);
});
```

**Files to Create/Modify**

| File | Type | Action | Purpose |
|------|------|--------|---------|
| `servetrack-backend/database/migrations/2026_04_23_add_notify_volunteers_to_rsvp.php` | PHP | Create | Add notify_volunteers column |
| `app/Http/Controllers/RsvpController.php` | PHP | Modify | Add notification logic to store() |
| `app/Http/Requests/StoreRsvpRequest.php` | PHP | Modify | Add notify_volunteers field |
| `app/Models/Rsvp.php` | PHP | Modify | Add notifyVolunteers() method |
| `tests/Feature/RsvpTest.php` | PHP | Modify | Add tests for auto-notification |

**Controller Logic (Updated)**
```php
// RsvpController.php - store() method

public function store(StoreRsvpRequest $request): JsonResponse
{
    $rsvp = DB::transaction(function () use ($request) {
        // Create RSVP
        $rsvp = Rsvp::create($request->validated());
        
        // Create time slots
        foreach ($request->shifts as $shift) {
            $timeSlot = TimeSlot::firstOrCreate(['text' => $shift['text']]);
            
            RsvpShift::create([
                'rsvp_id' => $rsvp->rsvp_id,
                'time_slot_id' => $timeSlot->time_slot_id,
                'time_slot' => $shift['time_slot'],
                'capacity' => $shift['capacity'],
            ]);
        }
        
        return $rsvp;
    });
    
    // Auto-notify if requested and RSVP is active
    if ($request->notify_volunteers && $rsvp->status === 'active') {
        $rsvp->notifyVolunteers();
    }
    
    return RsvpResource::make($rsvp)->response()->setStatusCode(201);
}
```

**Model Method**
```php
// app/Models/Rsvp.php

public function notifyVolunteers(): void
{
    // Get all volunteers with contact info
    $volunteers = Volunteer::query()
        ->where(function ($q) {
            $q->whereNotNull('mobile_number')
              ->orWhereNotNull('messenger_psid');
        })
        ->get(['volunteer_id', 'mobile_number', 'messenger_psid']);
    
    // Queue notification jobs for each volunteer
    foreach ($volunteers as $volunteer) {
        if ($volunteer->mobile_number) {
            SendRsvpSmsJob::dispatch(
                volunteerId: $volunteer->volunteer_id,
                rsvpId: $this->rsvp_id
            );
        }
        
        if ($volunteer->messenger_psid) {
            SendRsvpFacebookNotificationJob::dispatch(
                volunteerId: $volunteer->volunteer_id,
                rsvpId: $this->rsvp_id
            );
        }
    }
}
```

**Form Request Update**
```php
// app/Http/Requests/StoreRsvpRequest.php

public function rules(): array
{
    return [
        'title' => ['required', 'string', 'min:3', 'max:100'],
        'description' => ['required', 'string', 'min:10'],
        'date' => ['required', 'date', 'after_or_equal:today'],
        'event_location' => ['nullable', 'string', 'max:255'],
        'cutoff_day' => ['required', 'date', 'before_or_equal:date'],
        'cutoff_time' => ['required', 'date_format:H:i'],
        'shifts' => ['required', 'array', 'min:1'],
        'shifts.*.text' => ['required', 'string'],
        'shifts.*.time_slot' => ['required', 'string'],
        'shifts.*.capacity' => ['required', 'integer', 'min:1'],
        'notify_volunteers' => ['boolean'],  ← NEW
    ];
}
```

**Response Format**
```json
{
  "message": "RSVP created successfully",
  "data": {
    "rsvp_id": 5,
    "title": "Relief Goods Distribution",
    "status": "active",
    "notify_volunteers": true,
    "notifications_queued": {
      "sms": 45,
      "facebook": 28
    }
  }
}
```

### Frontend Implementation Details

**Files to Create/Modify**

| File | Type | Action | Purpose |
|------|------|--------|---------|
| `src/app/admin-dashboard/admin-dashboard.ts` | Angular | Modify | Add toggle in create form |
| `src/app/services/rsvp.service.ts` | TypeScript | Review | Should work as-is |

**Create Form Component Updates**
```typescript
// admin-dashboard.ts

createRsvpForm = this.fb.group({
  title: ['', [Validators.required, Validators.minLength(3)]],
  description: ['', [Validators.required, Validators.minLength(10)]],
  date: ['', Validators.required],
  event_location: [''],
  cutoff_day: ['', Validators.required],
  cutoff_time: ['', Validators.required],
  shifts: this.fb.array([...]),
  notifyVolunteers: [true],  ← NEW (default: true)
});

notifyVolunteersControl = this.createRsvpForm.get('notifyVolunteers');
notificationStatus = signal<{sms: number; facebook: number} | null>(null);
```

**Template Changes**
```html
<!-- In Create RSVP Form -->
<form [formGroup]="createRsvpForm" (ngSubmit)="submitCreateRsvp()">
  
  <!-- existing fields... -->
  <input formControlName="title" />
  <textarea formControlName="description"></textarea>
  <input formControlName="date" type="date" />
  <!-- ... more fields ... -->
  
  <!-- NEW: Notification toggle -->
  <div class="form-group">
    <label class="flex items-center gap-2">
      <input 
        type="checkbox" 
        formControlName="notifyVolunteers"
        class="w-4 h-4"
      />
      <span>Notify volunteers immediately</span>
    </label>
    <p class="text-sm text-gray-600">
      SMS and Facebook messages will be sent to all volunteers with contact info
    </p>
  </div>
  
  <button type="submit" [disabled]="createLoading()">
    {{ createLoading() ? 'Creating...' : 'Create Event' }}
  </button>
</form>

<!-- NEW: Notification feedback -->
@if (notificationStatus()) {
  <div class="alert alert-success mt-4">
    <p>✅ Event created! Notifications queued:</p>
    <ul>
      @if (notificationStatus().sms > 0) {
        <li>📱 {{ notificationStatus().sms }} SMS messages</li>
      }
      @if (notificationStatus().facebook > 0) {
        <li>💬 {{ notificationStatus().facebook }} Facebook messages</li>
      }
    </ul>
  </div>
}
```

**Handle Response**
```typescript
// admin-dashboard.ts

submitCreateRsvp(): void {
  if (!this.createRsvpForm.valid) return;
  
  this.createLoading.set(true);
  this.createError.set(null);
  
  this.rsvpService.createRsvp(this.createRsvpForm.getRawValue()).subscribe({
    next: (response) => {
      this.createLoading.set(false);
      this.notificationStatus.set(response.data.notifications_queued);
      this.createRsvpForm.reset();
      this.loadRsvps();
      // Optional: Show success toast
    },
    error: (error) => {
      this.createLoading.set(false);
      this.createError.set(error.error?.message ?? 'Failed to create RSVP');
    }
  });
}
```

### Testing Plan

**Backend Tests (Pest)**
```php
// tests/Feature/RsvpTest.php

// Test 1: Auto-notification sent on creation
it('sends notifications when create rsvp with notify_volunteers=true', function () {
    Queue::fake();
    $admin = User::factory()->admin()->create();
    
    $volunteers = Volunteer::factory(5)
        ->state(new Sequence(
            ['mobile_number' => '639123456789'],
            ['messenger_psid' => 'fb_12345'],
            ['mobile_number' => '639987654321', 'messenger_psid' => 'fb_67890'],
            ['mobile_number' => null, 'messenger_psid' => null],
            ['mobile_number' => '639111111111'],
        ))
        ->create();
    
    $response = $this->actingAs($admin)->postJson('/api/rsvp', [
        'title' => 'Relief Goods',
        'description' => 'Help distribute relief goods to communities',
        'date' => now()->addDay()->toDateString(),
        'event_location' => 'Community Center',
        'cutoff_day' => now()->addDay()->toDateString(),
        'cutoff_time' => '12:00',
        'shifts' => [
            ['text' => 'Morning', 'time_slot' => '8:00-12:00', 'capacity' => 10]
        ],
        'notify_volunteers' => true,  ← Important
    ]);
    
    $response->assertCreated();
    
    // Verify jobs were queued
    Queue::assertPushed(SendRsvpSmsJob::class, 3);  // 3 with phone
    Queue::assertPushed(SendRsvpFacebookNotificationJob::class, 2);  // 2 with PSID
    
    // Verify response includes notification counts
    expect($response->json('data.notifications_queued.sms'))->toBe(3);
    expect($response->json('data.notifications_queued.facebook'))->toBe(2);
});

// Test 2: No notifications if disabled
it('does not send notifications when notify_volunteers=false', function () {
    Queue::fake();
    $admin = User::factory()->admin()->create();
    
    Volunteer::factory(5)
        ->state(['mobile_number' => '639123456789'])
        ->create();
    
    $response = $this->actingAs($admin).postJson('/api/rsvp', [
        // ... form data ...
        'notify_volunteers' => false,  ← Disabled
    ]);
    
    $response->assertCreated();
    Queue::assertNotPushed(SendRsvpSmsJob::class);
    Queue::assertNotPushed(SendRsvpFacebookNotificationJob::class);
});

// Test 3: No notifications if RSVP is not active
it('does not send notifications if rsvp status is not active', function () {
    Queue::fake();
    $admin = User::factory()->admin()->create();
    
    Volunteer::factory(5)
        ->state(['mobile_number' => '639123456789'])
        ->create();
    
    $response = $this->actingAs($admin)->postJson('/api/rsvp', [
        // ... form data ...
        'notify_volunteers' => true,
        // RSVP created as draft (status='draft' by default)
    ]);
    
    $response->assertCreated();
    Queue::assertNotPushed(SendRsvpSmsJob::class);
    Queue::assertNotPushed(SendRsvpFacebookNotificationJob::class);
});

// Test 4: Only notifies volunteers with contact info
it('only notifies volunteers with phone or facebook psid', function () {
    Queue::fake();
    $admin = User::factory()->admin()->create();
    
    // Create volunteers with mixed contact info
    Volunteer::factory()->create(['mobile_number' => null, 'messenger_psid' => null]); // no contact
    Volunteer::factory()->create(['mobile_number' => '639123456789']); // has phone
    Volunteer::factory()->create(['messenger_psid' => 'fb_12345']); // has facebook
    
    $this->actingAs($admin)->postJson('/api/rsvp', [
        // ... form data with notify_volunteers=true ...
    ]);
    
    Queue::assertPushed(SendRsvpSmsJob::class, 1);
    Queue::assertPushed(SendRsvpFacebookNotificationJob::class, 1);
});

// Test 5: Response includes notification count summary
it('response includes notifications queued summary', function () {
    Queue::fake();
    $admin = User::factory()->admin()->create();
    
    Volunteer::factory(3)->create(['mobile_number' => '639123456789']);
    Volunteer::factory(2)->create(['messenger_psid' => 'fb_12345']);
    
    $response = $this->actingAs($admin)->postJson('/api/rsvp', [
        // ... form data with notify_volunteers=true ...
    ]);
    
    $response->assertCreated();
    expect($response->json('data.notifications_queued'))->toBe([
        'sms' => 3,
        'facebook' => 2,
    ]);
});
```

**Frontend Tests (Vitest)**
```typescript
describe('Auto-Notifications', () => {
  it('displays notify volunteers checkbox in create form', () => {
    // Render form
    // Assert checkbox visible
    // Assert help text visible
  });
  
  it('notification checkbox defaults to true', () => {
    // Assert checked by default
  });
  
  it('displays notification summary after successful create', async () => {
    // Mock API to return notification counts
    // Submit form
    // Assert success message with counts displayed
  });
  
  it('checkbox can be toggled off', () => {
    // Click checkbox to uncheck
    // Assert unchecked
  });
});
```

### Notification Message Content

**SMS Template**
```
NLCOM RSVP Event
{title}
📅 Date: {date} ({day_name})
📍 Location: {location}
⏰ RSVP Closes: {cutoff_day} {cutoff_time}

👉 RSVP: {shareable_link}

Questions? Contact us!
```

**Facebook Template**
```
📢 New RSVP Event!

{title}

📅 {date_formatted} | 📍 {location}
⏰ Closes: {cutoff_day} at {cutoff_time}

{description_excerpt}

👉 [RSVP HERE]({shareable_link})

See you there! 💪
```

### Acceptance Criteria

- ✅ Admin can toggle "Notify volunteers" checkbox (defaults ON)
- ✅ On creation with notify=true, SMS/Facebook jobs queued
- ✅ On creation with notify=false, NO jobs queued
- ✅ Jobs only queued if RSVP status is active
- ✅ Only volunteers with phone/PSID are notified
- ✅ Response shows count of SMS and Facebook messages queued
- ✅ Success message displayed to admin
- ✅ Notifications include event details and shareable link
- ✅ Form submission doesn't block (async)
- ✅ Tests pass (backend and frontend)

---

## Feature 3: User-Friendly Shareable Links (Slug-Based)

Replace numeric RSVP IDs with readable slug-based URLs.

### Current vs. New Format

```
Current:  https://servetrack.kaelvxdev.space/rsvp?id=123
New:      https://servetrack.kaelvxdev.space/rsvp/relief-goods-april-2026

Pattern: /rsvp/{slug}
Slug: Generated from title + date, URL-safe, unique
```

### User Flow

```
Admin Dashboard
├── RSVP Created: "Relief Goods Distribution" (April 25, 2026)
├── Slug Generated: "relief-goods-april-2026"
└── Share URL: "https://servetrack.kaelvxdev.space/rsvp/relief-goods-april-2026"

Volunteer receives SMS/Facebook with link:
└─→ Clicks link
    └─→ Browser navigates to: /rsvp/relief-goods-april-2026
        └─→ Angular router recognizes slug
            └─→ Loads RSVP component
                └─→ Component queries API for RSVP by slug
                    └─→ API returns RSVP data
                        └─→ Component displays event details
```

### Requirements Analysis

| Requirement | Details |
|-------------|---------|
| **Format** | URL-safe slug from title + date |
| **Uniqueness** | Must be unique (handle conflicts with suffix) |
| **Generated** | Auto-generated on RSVP creation |
| **Immutable** | Slug doesn't change after creation |
| **Conflict Handling** | Duplicates get `-2`, `-3` suffix |
| **Backward Compat** | Old `?id=123` format still works |
| **Share Format** | SMS/Facebook use slug format |
| **Admin View** | Show slug in admin dashboard |

### Design Decisions

1. **Slug from title + date** - Makes URL human-readable and contextual
2. **Auto-generated** - No admin input needed
3. **Conflict resolution** - Auto-increment suffix for duplicates
4. **API supports both** - Accept ID or slug for flexibility
5. **Frontend uses slug** - Shareable URLs and notifications use slug
6. **Immutable slug** - Never changes to maintain bookmarkable links

### Slug Generation Examples

| Title | Date | Slug | Conflict Resolution |
|-------|------|------|---------------------|
| Relief Goods Distribution | April 25, 2026 | relief-goods-april-2026 | N/A |
| Relief Goods Distribution | April 25, 2026 | N/A | relief-goods-april-2026-2 |
| Feeding Community | May 1, 2026 | feeding-community-may-2026 | N/A |
| Relief Goods Distribution | May 1, 2026 | N/A | relief-goods-may-2026 |

### Backend Implementation Details

**Database Schema**
```php
// Migration: add_slug_to_rsvp_table.php

Schema::table('rsvp', function (Blueprint $table) {
    $table->string('slug')->unique()->nullable()->after('share_url');
    $table->index('slug');
});
```

**Files to Create/Modify**

| File | Type | Action | Purpose |
|------|------|--------|---------|
| `database/migrations/2026_04_23_add_slug_to_rsvp_table.php` | PHP | Create | Add slug column with index |
| `app/Models/Rsvp.php` | PHP | Modify | Add slug generation logic |
| `app/Http/Controllers/RsvpController.php` | PHP | Modify | Add `showBySlug()` method |
| `routes/api.php` | PHP | Modify | Add slug-based route |
| `app/Http/Resources/RsvpResource.php` | PHP | Review | Include slug in response |
| `tests/Feature/RsvpTest.php` | PHP | Modify | Add slug tests |

**Model Logic**
```php
// app/Models/Rsvp.php

protected static function boot(): void
{
    parent::boot();
    
    // Auto-generate slug on creation
    static::creating(function (self $rsvp) {
        if (!$rsvp->slug) {
            $rsvp->slug = $rsvp->generateSlug();
        }
    });
}

public function generateSlug(): string
{
    // Generate from title + date
    $baseSlug = Str::slug($this->title) . '-' . 
                $this->date->format('F-Y')->toLowerCase();
    
    $slug = $baseSlug;
    $counter = 1;
    
    // Handle conflicts by appending counter
    while (self::where('slug', $slug)->exists()) {
        $slug = "{$baseSlug}-{$counter}";
        $counter++;
    }
    
    return $slug;
}

public function getShareUrl(): string
{
    $base = config('app.url');
    return "{$base}/rsvp/{$this->slug}";
}
```

**Route Setup**
```php
// routes/api.php

// NEW: Slug-based route (more specific, higher priority)
Route::get('/rsvp/{slug}', [RsvpController::class, 'showBySlug'])
    ->where('slug', '[a-z0-9\-]+')  // Only lowercase, digits, hyphens
    ->name('rsvp.show-by-slug');

// EXISTING: ID-based route (fallback)
Route::get('/rsvp/{rsvp}', [RsvpController::class, 'show'])
    ->name('rsvp.show');
```

**Controller Methods**
```php
// RsvpController.php

public function show(Rsvp $rsvp): JsonResponse
{
    return RsvpResource::make($rsvp)->response();
}

public function showBySlug(string $slug): JsonResponse
{
    $rsvp = Rsvp::where('slug', $slug)->firstOrFail();
    return RsvpResource::make($rsvp)->response();
}
```

**Resource Update**
```php
// app/Http/Resources/RsvpResource.php

public function toArray(Request $request): array
{
    return [
        'rsvp_id' => $this->rsvp_id,
        'title' => $this->title,
        'description' => $this->description,
        'date' => $this->date,
        'event_location' => $this->event_location,
        'status' => $this->status,
        'cutoff_day' => $this->cutoff_day,
        'cutoff_time' => $this->cutoff_time,
        'slug' => $this->slug,  ← NEW
        'share_url' => $this->getShareUrl(),  ← Uses slug now
        // ... rest of resource
    ];
}
```

### Frontend Implementation Details

**Files to Create/Modify**

| File | Type | Action | Purpose |
|------|------|--------|---------|
| `src/app/app.routes.ts` | Angular | Modify | Add slug-based route |
| `src/app/rsvp/rsvp.ts` | Angular | Modify | Support slug parameter |
| `src/app/services/rsvp.service.ts` | TypeScript | Review | Handle both ID and slug |

**Routing Setup**
```typescript
// src/app/app.routes.ts

export const routes: Routes = [
  {
    path: 'rsvp/:slug',
    component: RsvpComponent,
    canActivate: [authGuard]
  },
  {
    path: 'rsvp',
    component: RsvpComponent,
    canActivate: [authGuard],
    // For backward compat: ?id=123
  },
  // ... other routes
];
```

**Component Update**
```typescript
// src/app/rsvp/rsvp.ts

export class RsvpComponent implements OnInit {
  slug = input<string | null>(null);
  id = input<number | null>(null);
  
  rsvp = signal<Rsvp | null>(null);
  loading = signal(true);
  error = signal<string | null>(null);
  
  constructor(private rsvpService: RsvpService) {}
  
  ngOnInit(): void {
    this.loadRsvp();
  }
  
  loadRsvp(): void {
    // Prefer slug, fallback to ID
    const identifier = this.slug() || this.id();
    
    if (!identifier) {
      this.error.set('Invalid RSVP');
      this.loading.set(false);
      return;
    }
    
    this.rsvpService.getRsvp(identifier).subscribe({
      next: (rsvp) => {
        this.rsvp.set(rsvp);
        this.loading.set(false);
      },
      error: (err) => {
        this.error.set('RSVP not found');
        this.loading.set(false);
      }
    });
  }
}
```

**Service Method**
```typescript
// src/app/services/rsvp.service.ts

getRsvp(identifier: string | number): Observable<Rsvp> {
  // If it's a number, use /api/rsvp/{id}
  // If it's a string, use /api/rsvp/{slug}
  const url = typeof identifier === 'string' 
    ? `${this.apiUrl}/rsvp/${identifier}`
    : `${this.apiUrl}/rsvp/${identifier}`;
  
  return this.http.get<Rsvp>(url).pipe(
    catchError(error => {
      console.error('Failed to load RSVP:', error);
      throw error;
    })
  );
}
```

### Testing Plan

**Backend Tests (Pest)**
```php
// tests/Feature/RsvpTest.php

// Test 1: Slug generated on creation
it('generates slug on rsvp creation', function () {
    $rsvp = Rsvp::factory()->create([
        'title' => 'Relief Goods Distribution',
        'date' => Carbon::parse('2026-04-25'),
    ]);
    
    expect($rsvp->slug)->toBe('relief-goods-april-2026');
});

// Test 2: Slug is unique with conflicts
it('appends counter to slug on conflicts', function () {
    $rsvp1 = Rsvp::factory()->create([
        'title' => 'Relief Goods',
        'date' => Carbon::parse('2026-04-25'),
    ]);
    
    $rsvp2 = Rsvp::factory()->create([
        'title' => 'Relief Goods',
        'date' => Carbon::parse('2026-04-25'),
    ]);
    
    $rsvp3 = Rsvp::factory()->create([
        'title' => 'Relief Goods',
        'date' => Carbon::parse('2026-04-25'),
    ]);
    
    expect($rsvp1->slug)->toBe('relief-goods-april-2026');
    expect($rsvp2->slug)->toBe('relief-goods-april-2026-2');
    expect($rsvp3->slug)->toBe('relief-goods-april-2026-3');
});

// Test 3: Access RSVP by slug
it('can access rsvp via slug route', function () {
    $rsvp = Rsvp::factory()->active()->create(['title' => 'My Event', 'date' => '2026-04-25']);
    
    $response = $this->get("/api/rsvp/{$rsvp->slug}");
    
    $response->assertOk();
    expect($response->json('data.slug'))->toBe($rsvp->slug);
    expect($response->json('data.title'))->toBe('My Event');
});

// Test 4: Access RSVP by ID (backward compat)
it('can still access rsvp via id route for backward compatibility', function () {
    $rsvp = Rsvp::factory()->active()->create();
    
    $response = $this->get("/api/rsvp/{$rsvp->rsvp_id}");
    
    $response->assertOk();
    expect($response->json('data.rsvp_id'))->toBe($rsvp->rsvp_id);
});

// Test 5: Special characters in title
it('slugifies special characters correctly', function () {
    $rsvp = Rsvp::factory()->create([
        'title' => "Community's Relief & Goods!",
        'date' => Carbon::parse('2026-04-25'),
    ]);
    
    expect($rsvp->slug)->toBe('communitys-relief-goods-april-2026');
});

// Test 6: Slug included in API response
it('includes slug in rsvp resource response', function () {
    $rsvp = Rsvp::factory()->active()->create();
    
    $response = $this->get("/api/rsvp/{$rsvp->rsvp_id}");
    
    expect($response->json('data.slug'))->toBe($rsvp->slug);
    expect($response->json('data.share_url'))->toContain($rsvp->slug);
});

// Test 7: Share URL uses slug
it('share_url uses slug format', function () {
    $rsvp = Rsvp::factory()->create([
        'title' => 'My Event',
        'date' => Carbon::parse('2026-04-25'),
    ]);
    
    expect($rsvp->getShareUrl())->toBe(
        config('app.url') . "/rsvp/{$rsvp->slug}"
    );
});

// Test 8: 404 for non-existent slug
it('returns 404 for non-existent slug', function () {
    $response = $this->get('/api/rsvp/non-existent-slug');
    
    $response->assertNotFound();
});
```

**Frontend Tests (Vitest)**
```typescript
describe('Slug-based RSVP URLs', () => {
  it('loads RSVP by slug parameter', async () => {
    // Mock API with slug
    // Navigate to /rsvp/relief-goods-april-2026
    // Assert RSVP loads
  });
  
  it('loads RSVP by id parameter (backward compat)', async () => {
    // Navigate to /rsvp?id=123
    // Assert RSVP loads
  });
  
  it('shows error for invalid slug', async () => {
    // Navigate to /rsvp/invalid-slug
    // Mock API to return 404
    // Assert error message shown
  });
  
  it('service handles both slug and id', () => {
    // Test getRsvp('my-slug') returns observable
    // Test getRsvp(123) returns observable
  });
});
```

### Acceptance Criteria

- ✅ Slug generated on RSVP creation (from title + date)
- ✅ Slugs are unique (conflicts handled with counter suffix)
- ✅ Slug is immutable (doesn't change after creation)
- ✅ API accepts both ID and slug for lookups
- ✅ Frontend can navigate using slug URL
- ✅ Slug included in API responses
- ✅ Share URLs use slug format
- ✅ Backward compatible with numeric IDs
- ✅ Special characters in titles handled correctly
- ✅ 404 errors for non-existent slugs
- ✅ Tests pass (backend and frontend)

---

## Summary & Next Steps

### Three Features Drafted

1. **Response Editing** - Allow volunteers to change RSVP time slots
   - Backend: PATCH /api/rsvp/{id}/response endpoint
   - Frontend: Edit button + modal UI
   - Tests: Both backend and frontend

2. **Auto-Notifications** - Notify volunteers when events created
   - Backend: Add notification logic to RSVP creation
   - Frontend: Notify checkbox in create form
   - Shows feedback of queued notifications

3. **User-Friendly Links** - Slug-based shareable URLs
   - Backend: Slug generation and storage
   - Frontend: Route and component updates
   - Backward compatible with numeric IDs

### Ready for Review

**Questions for Product Owner Before Implementation:**

1. ✅ **Response Editing**: Looks good as described?
2. ✅ **Auto-Notifications**: Notification toggle enabled by default?
3. ✅ **Slug Format**: Is `relief-goods-april-2026` the right format?
4. **Additional Features**: Need anything else before coding?

### Implementation Readiness

- [x] Backend designs finalized
- [x] Frontend designs finalized
- [x] Database schema planned
- [x] API endpoints specified
- [x] Test cases drafted
- [x] Error handling defined
- [x] Backward compatibility planned

**Next Phase**: Implementation (when approved)
- Week 1: Response Editing
- Week 2: Auto-Notifications + Slug-based Links
- Week 3: Bug fixes and production testing

---

**Document Status**: ✅ Ready for Feedback & Approval
