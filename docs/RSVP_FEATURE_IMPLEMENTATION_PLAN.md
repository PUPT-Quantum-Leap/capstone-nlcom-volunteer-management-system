# RSVP Feature Implementation Plan

**Document Version:** 1.0  
**Date:** March 18, 2026  
**Project:** ServeTrack Volunteer Management System  
**Feature:** RSVP System with Facebook Integration

---

## Overview

This document outlines the implementation plan for transforming the existing Poll feature into a complete RSVP (Event) system with Facebook Messenger notifications, Facebook Login for seamless authentication, SMS backup notifications, and an optional check-in/out attendance tracking system.

### Use Case Summary

- Admin creates a volunteer event (e.g., feeding program for typhoon victims)
- Event typically scheduled on weekends (Saturday)
- Volunteers receive notification via Facebook Messenger/SMS
- Volunteers RSVP with their available time slots
- Admin uses RSVP data to group volunteers into shifts (e.g., morning 4AM-12PM, afternoon 1PM-6PM)
- Optional: Track actual attendance on event day

---

## Current State Analysis

### Existing Poll Feature

| Component | Status | Location |
|-----------|--------|----------|
| Poll model | Exists | `app/Models/Poll.php` |
| PollOption model | Exists | `app/Models/Option.php` |
| PollVote model | Exists | `app/Models/PollVote.php` |
| PollController | Exists | `app/Http/Controllers/PollController.php` |
| Poll API routes | Exists | `routes/api.php` |
| Frontend voting page | Exists | `voting-poll/` |
| Tests | 30 tests | `tests/Feature/PollTest.php` |

### Existing Integrations

| Integration | Status | Notes |
|-------------|--------|-------|
| Facebook ID storage | ✅ Exists | Stored in Volunteer model |
| SMS notification model | ✅ Exists | DB table only, no provider |
| Facebook Login | ❌ Not implemented | - |
| Facebook Messenger API | ❌ Not implemented | - |
| Check-in/out | ❌ Not implemented | - |

### Key Limitation from Research

> **Facebook Messenger cannot send messages to group chats via API.** Only individual DMs are possible, and only within 24 hours of user interaction with the Page.

Reference: `docs/MESSENGER_INTEGRATION_PROPOSAL.md`

---

## Implementation Plan

### Phase 1: Rename Poll → RSVP

**Objective:** Rename all poll-related components to RSVP terminology while maintaining functionality.

#### Database Migrations

| Action | Description |
|--------|-------------|
| Rename table | `poll` → `rsvp` |
| Rename table | `poll_option` → `rsvp_shift` |
| Rename table | `poll_vote` → `rsvp_response` |
| Add field | `event_location` to rsvp table |
| Add field | `event_description` to rsvp table |
| Add field | `checked_in_at` to rsvp_response table |
| Add field | `checked_out_at` to rsvp_response table |
| Add field | `attendance_status` to rsvp_response table |

#### Backend Changes

**Models:**
- Rename `Poll.php` → `Rsvp.php`
- Rename `Option.php` → `RsvpShift.php`
- Rename `PollVote.php` → `RsvpResponse.php`

**Controllers:**
- Rename `PollController.php` → `RsvpController.php`
- Update all method names and logic

**Form Requests:**
- Rename `StorePollRequest.php` → `StoreRsvpRequest.php`
- Rename `UpdatePollRequest.php` → `UpdateRsvpRequest.php`

**API Resources:**
- Rename `PollResource.php` → `RsvpResource.php`

**Routes (api.php):**
```php
// Old
Route::resource('polls', PollController::class);

// New
Route::resource('rsvp', RsvpController::class);
```

**Factories:**
- Rename `PollFactory.php` → `RsvpFactory.php`

#### Frontend Changes

**Models:**
- Rename `poll.ts` → `rsvp.ts`
- Update interfaces: `Poll` → `Rsvp`, `PollOption` → `RsvpShift`

**Service:**
- Rename `poll.service.ts` → `rsvp.service.ts`

**Components:**
- Rename `voting-poll/` folder → `rsvp/`
- Rename component files and class names

**Routes:**
- Rename `/voting-poll` → `/rsvp`

**Dashboard Integration:**
- Update admin-dashboard component references
- Update volunteer-dashboard component references

#### Tests

- Rename `tests/Feature/PollTest.php` → `tests/Feature/RsvpTest.php`
- Update all test method names and assertions

---

### Phase 2: Facebook Messenger Integration

**Objective:** Send RSVP event notifications to volunteers via Facebook Messenger DMs when admin creates an event.

#### Prerequisites

| Item | Description |
|------|-------------|
| Facebook Developer Account | Required for App creation |
| Facebook Page | Organization's page for sending DMs |
| Facebook App with Messenger | Required for Send API access |
| Page Access Token | Long-lived token for API calls |
| HTTPS endpoint | Required for webhooks (optional) |

#### Configuration (.env)

```env
# Facebook
FACEBOOK_PAGE_ID=your_page_id
FACEBOOK_PAGE_ACCESS_TOKEN=your_long_lived_token
FACEBOOK_APP_ID=your_app_id
FACEBOOK_APP_SECRET=your_app_secret
```

#### Backend Implementation

**Package Installation:**
```bash
composer require facebook/graph-sdk
```

**FacebookService (new file):**
```php
// app/Services/FacebookService.php
namespace App\Services;

use Facebook\Facebook;

class FacebookService
{
    protected Facebook $facebook;
    protected string $pageId;

    public function __construct()
    {
        $this->facebook = new Facebook([
            'app_id' => config('services.facebook.app_id'),
            'app_secret' => config('services.facebook.app_secret'),
            'default_access_token' => config('services.facebook.page_access_token'),
        ]);
        $this->pageId = config('services.facebook.page_id');
    }

    public function sendDirectMessage(string $recipientId, string $message): array
    {
        try {
            $response = $this->facebook->post(
                "/{$this->pageId}/messages",
                [
                    'recipient' => ['id' => $recipientId],
                    'message' => ['text' => $message],
                ]
            );
            return $response->getDecodedBody();
        } catch (FacebookResponseException $e) {
            Log::error('Facebook API Error: ' . $e->getMessage());
            throw $e;
        }
    }

    public function sendRsvpNotification(Volunteer $volunteer, Rsvp $rsvp): bool
    {
        if (!$volunteer->facebook_id) {
            return false;
        }

        $message = $this->formatRsvpMessage($rsvp);
        try {
            $this->sendDirectMessage($volunteer->facebook_id, $message);
            return true;
        } catch (\Exception $e) {
            Log::error("Failed to send FB message to volunteer {$volunteer->volunteer_id}: " . $e->getMessage());
            return false;
        }
    }

    protected function formatRsvpMessage(Rsvp $rsvp): string
    {
        $deadline = $rsvp->cutoff_day . ' ' . $rsvp->cutoff_time;
        $link = config('app.frontend_url') . '/rsvp?id=' . $rsvp->rsvp_id;

        return "📢 *New RSVP Event!*\n\n"
            . "*{$rsvp->title}*\n"
            . "📅 Date: {$rsvp->date}\n"
            . "📍 Location: {$rsvp->event_location}\n"
            . "⏰ Deadline: {$deadline}\n\n"
            . "[Click here to RSVP]({$link})";
    }
}
```

**RsvpController Extension:**
```php
// In RsvpController.php
public function notify(Request $request, int $id): JsonResponse
{
    $rsvp = Rsvp::findOrFail($id);
    $volunteers = Volunteer::whereNotNull('facebook_id')->get();

    $facebook = app(FacebookService::class);
    $results = [];

    foreach ($volunteers as $volunteer) {
        $results[$volunteer->volunteer_id] = $facebook->sendRsvpNotification($volunteer, $rsvp);
    }

    return response()->json([
        'success' => true,
        'total' => $volunteers->count(),
        'sent' => array_sum($results),
        'failed' => $volunteers->count() - array_sum($results),
    ]);
}
```

**New API Route:**
```php
// routes/api.php
Route::post('/rsvp/{id}/notify-facebook', [RsvpController::class, 'notify']);
```

#### Frontend Implementation

**rsvp.service.ts extension:**
```typescript
notifyViaFacebook(rsvpId: number): Observable<any> {
  return this.http.post(`/api/rsvp/${rsvpId}/notify-facebook`, {});
}
```

**Admin RSVP List (admin-dashboard.html):**
```html
<button (click)="notifyVolunteers(rsvp.id)" class="btn-facebook">
  <i class="fab fa-facebook-messenger"></i> Send FB Notification
</button>
```

---

### Phase 3: Facebook Login (Seamless Authentication)

**Objective:** Allow volunteers to log in using their Facebook account, pre-filling their profile information from Facebook.

#### Prerequisites

| Item | Description |
|------|-------------|
| Facebook Login product | Enable in Facebook App |
| Valid redirect URI | Must match Facebook App settings |
| App domain verification | Required by Facebook |

#### Configuration (.env)

```env
FACEBOOK_REDIRECT_URI=https://yourdomain.com/api/auth/facebook/callback
```

#### Backend Implementation

**Routes:**
```php
// routes/api.php
Route::get('/auth/facebook', [AuthController::class, 'redirectToFacebook']);
Route::get('/auth/facebook/callback', [AuthController::class, 'handleFacebookCallback']);
```

**AuthController extension:**
```php
public function redirectToFacebook(): RedirectResponse
{
    $fb = new Facebook([
        'app_id' => config('services.facebook.app_id'),
        'app_secret' => config('services.facebook.app_secret'),
        'default_graph_version' => 'v18.0',
    ]);

    $helper = $fb->getRedirectLoginHelper();
    $permissions = ['email', 'public_profile'];
    $loginUrl = $helper->getLoginUrl(
        config('services.facebook.redirect_uri'),
        $permissions
    );

    return redirect($loginUrl);
}

public function handleFacebookCallback(Request $request): JsonResponse
{
    $fb = new Facebook([
        'app_id' => config('services.facebook.app_id'),
        'app_secret' => config('services.facebook.app_secret'),
        'default_graph_version' => 'v18.0',
    ]);

    $helper = $fb->getRedirectLoginHelper();

    try {
        $accessToken = $helper->getAccessToken(config('services.facebook.redirect_uri'));
    } catch (FacebookResponseException $e) {
        return response()->json(['error' => 'Facebook auth failed'], 401);
    }

    $fb->setDefaultAccessToken($accessToken);

    // Get user profile
    $response = $fb->get('/me?fields=id,name,email,first_name,last_name');
    $user = $response->getGraphUser();

    // Find or create volunteer
    $volunteer = Volunteer::updateOrCreate(
        ['facebook_id' => $user['id']],
        [
            'first_name' => $user['first_name'],
            'last_name' => $user['last_name'],
            'email' => $user['email'] ?? null,
            'facebook_name' => $user['name'],
        ]
    );

    // Generate Sanctum token
    $token = $volunteer->createToken('facebook-auth')->plainTextToken;

    return response()->json([
        'token' => $token,
        'volunteer' => new VolunteerResource($volunteer),
    ]);
}
```

#### Frontend Implementation

**auth.service.ts extension:**
```typescript
loginWithFacebook(): void {
  window.location.href = '/api/auth/facebook';
}
```

**login.component.html:**
```html
<button (click)="loginWithFacebook()" class="btn-facebook-login">
  <i class="fab fa-facebook"></i> Continue with Facebook
</button>
```

---

### Phase 4: SMS Backup Notifications

**Objective:** Send RSVP notifications via SMS as a backup channel or alternative to Facebook.

#### Configuration (.env)

```env
# Twilio (example)
TWILIO_SID=your_twilio_sid
TWILIO_TOKEN=your_twilio_token
TWILIO_PHONE_NUMBER=+1234567890
```

#### Backend Implementation

**Package Installation:**
```bash
composer require twilio/sdk
```

**SmsService:**
```php
// app/Services/SmsService.php
namespace App\Services;

use Twilio\Rest\Client;

class SmsService
{
    protected Client $twilio;
    protected string $fromNumber;

    public function __construct()
    {
        $this->twilio = new Client(
            config('services.twilio.sid'),
            config('services.twilio.token')
        );
        $this->fromNumber = config('services.twilio.phone_number');
    }

    public function sendSms(string $toNumber, string $message): array
    {
        return $this->twilio->messages->create($toNumber, [
            'from' => $this->fromNumber,
            'body' => $message,
        ]);
    }

    public function sendRsvpNotification(Volunteer $volunteer, Rsvp $rsvp): bool
    {
        if (!$volunteer->mobile_number) {
            return false;
        }

        $message = $this->formatRsvpMessage($rsvp);

        try {
            $this->sendSms($volunteer->mobile_number, $message);
            return true;
        } catch (\Exception $e) {
            Log::error("SMS failed for volunteer {$volunteer->volunteer_id}: " . $e->getMessage());
            return false;
        }
    }

    protected function formatRsvpMessage(Rsvp $rsvp): string
    {
        $link = config('app.frontend_url') . '/rsvp?id=' . $rsvp->rsvp_id;
        return "New RSVP: {$rsvp->title}\n"
            . "Date: {$rsvp->date}\n"
            . "Deadline: {$rsvp->cutoff_day} {$rsvp->cutoff_time}\n"
            . "RSVP here: {$link}";
    }
}
```

**RsvpController Extension:**
```php
public function notifySms(Request $request, int $id): JsonResponse
{
    $rsvp = Rsvp::findOrFail($id);
    $volunteers = Volunteer::whereNotNull('mobile_number')->get();

    $smsService = app(SmsService::class);
    $results = [];

    foreach ($volunteers as $volunteer) {
        $results[$volunteer->volunteer_id] = $smsService->sendRsvpNotification($volunteer, $rsvp);
    }

    return response()->json([
        'success' => true,
        'total' => $volunteers->count(),
        'sent' => array_sum($results),
    ]);
}
```

**New API Route:**
```php
Route::post('/rsvp/{id}/notify-sms', [RsvpController::class, 'notifySms']);
```

**Combined Notification:**
```php
public function notifyAll(Request $request, int $id): JsonResponse
{
    $rsvp = Rsvp::findOrFail($id);
    $volunteers = Volunteer::all();

    $facebook = app(FacebookService::class);
    $sms = app(SmsService::class);

    $fbSent = 0;
    $smsSent = 0;

    foreach ($volunteers as $volunteer) {
        if ($volunteer->facebook_id) {
            $facebook->sendRsvpNotification($volunteer, $rsvp) ? $fbSent++ : null;
        }
        if ($volunteer->mobile_number) {
            $sms->sendRsvpNotification($volunteer, $rsvp) ? $smsSent++ : null;
        }
    }

    return response()->json([
        'facebook' => $fbSent,
        'sms' => $smsSent,
    ]);
}
```

#### Frontend Implementation

**admin-dashboard.html extension:**
```html
<button (click)="notifyViaSms(rsvp.id)" class="btn-sms">
  <i class="fas fa-sms"></i> Send SMS
</button>
<button (click)="notifyAll(rsvp.id)" class="btn-notify-all">
  <i class="fas fa-bell"></i> Send All Notifications
</button>
```

---

### Phase 5: Check-in/Out Attendance System

**Objective:** Track actual volunteer attendance at events.

#### Database Migration

```php
// Add to rsvp_response table
$table->timestamp('checked_in_at')->nullable();
$table->timestamp('checked_out_at')->nullable();
$table->enum('attendance_status', ['registered', 'checked_in', 'checked_out', 'no_show'])->default('registered');
```

#### Backend Implementation

**RsvpResponse Model:**
```php
public function checkIn(): void
{
    $this->checked_in_at = now();
    $this->attendance_status = 'checked_in';
    $this->save();
}

public function checkOut(): void
{
    $this->checked_out_at = now();
    $this->attendance_status = 'checked_out';
    $this->save();
}

public function markNoShow(): void
{
    $this->attendance_status = 'no_show';
    $this->save();
}
```

**RsvpController:**
```php
public function checkIn(Request $request, int $id): JsonResponse
{
    $request->validate(['volunteer_id' => 'required|exists:volunteers,volunteer_id']);
    
    $response = RsvpResponse::where('rsvp_id', $id)
        ->where('volunteer_id', $request->volunteer_id)
        ->firstOrFail();
    
    $response->checkIn();
    
    return response()->json(['success' => true, 'response' => $response]);
}

public function checkOut(Request $request, int $id): JsonResponse
{
    $request->validate(['volunteer_id' => 'required|exists:volunteers,volunteer_id']);
    
    $response = RsvpResponse::where('rsvp_id', $id)
        ->where('volunteer_id', $request->volunteer_id)
        ->firstOrFail();
    
    $response->checkOut();
    
    return response()->json(['success' => true, 'response' => $response]);
}

public function attendance(Request $request, int $id): JsonResponse
{
    $rsvp = Rsvp::with('shifts.volunteers')->findOrFail($id);
    
    $responses = RsvpResponse::where('rsvp_id', $id)->get();
    
    return response()->json([
        'total' => $responses->count(),
        'checked_in' => $responses->where('attendance_status', 'checked_in')->count(),
        'checked_out' => $responses->where('attendance_status', 'checked_out')->count(),
        'no_show' => $responses->where('attendance_status', 'no_show')->count(),
        'registered' => $responses->where('attendance_status', 'registered')->count(),
    ]);
}
```

**Routes:**
```php
Route::post('/rsvp/{id}/check-in', [RsvpController::class, 'checkIn']);
Route::post('/rsvp/{id}/check-out', [RsvpController::class, 'checkOut']);
Route::get('/rsvp/{id}/attendance', [RsvpController::class, 'attendance']);
```

#### Frontend Implementation

**check-in page (new component):**
```typescript
// rsvp-checkin.component.ts
@Component({
  selector: 'app-rsvp-checkin',
  template: `
    <h1>{{ rsvp()?.title }} - Attendance</h1>
    
    <div class="scanner">
      <input type="text" [(ngModel)]="volunteerId" placeholder="Enter Volunteer ID">
      <button (click)="checkIn()">Check In</button>
      <button (click)="checkOut()">Check Out</button>
    </div>
    
    <div class="stats">
      <div>Registered: {{ stats().registered }}</div>
      <div>Checked In: {{ stats().checkedIn }}</div>
      <div>Checked Out: {{ stats().checkedOut }}</div>
      <div>No Show: {{ stats().noShow }}</div>
    </div>
  `
})
export class RsvpCheckinComponent {
  rsvp = signal<Rsvp | null>(null);
  stats = signal({ registered: 0, checkedIn: 0, checkedOut: 0, noShow: 0 });
  
  checkIn(): void {
    this.rsvpService.checkIn(this.rsvp()!.id, this.volunteerId)
      .subscribe(() => this.loadStats());
  }
  
  checkOut(): void {
    this.rsvpService.checkOut(this.rsvp()!.id, this.volunteerId)
      .subscribe(() => this.loadStats());
  }
}
```

---

## API Summary

### RSVP Endpoints

| Method | Endpoint | Access | Description |
|--------|----------|--------|-------------|
| GET | /api/rsvp | All | List RSVP events |
| GET | /api/rsvp/{id} | All | Get RSVP details |
| POST | /api/rsvp | Admin | Create RSVP event |
| PUT | /api/rsvp/{id} | Admin | Update RSVP event |
| DELETE | /api/rsvp/{id} | Admin | Delete RSVP event |
| POST | /api/rsvp/{id}/vote | Volunteer | Submit RSVP response |
| POST | /api/rsvp/{id}/notify-facebook | Admin | Send FB notifications |
| POST | /api/rsvp/{id}/notify-sms | Admin | Send SMS notifications |
| POST | /api/rsvp/{id}/notify-all | Admin | Send all notifications |
| POST | /api/rsvp/{id}/check-in | Admin | Check in volunteer |
| POST | /api/rsvp/{id}/check-out | Admin | Check out volunteer |
| GET | /api/rsvp/{id}/attendance | Admin | Get attendance stats |

### Auth Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | /api/auth/facebook | Redirect to Facebook OAuth |
| GET | /api/auth/facebook/callback | Handle OAuth callback |

---

## File Inventory

### New Files to Create

| File | Phase | Description |
|------|-------|-------------|
| `app/Services/FacebookService.php` | 2 | Facebook Messenger API |
| `app/Http/Controllers/AuthController.php` (extend) | 3 | Facebook OAuth handlers |
| `app/Services/SmsService.php` | 4 | Twilio SMS integration |
| `app/Http/Controllers/RsvpCheckinController.php` | 5 | Check-in/out logic |
| `servetrack-frontend/src/app/rsvp/` | 1 | RSVP components |
| `servetrack-frontend/src/app/rsvp-checkin/` | 5 | Check-in page |

### Files to Rename

| Old | New | Phase |
|-----|-----|-------|
| `app/Models/Poll.php` | `app/Models/Rsvp.php` | 1 |
| `app/Models/Option.php` | `app/Models/RsvpShift.php` | 1 |
| `app/Models/PollVote.php` | `app/Models/RsvpResponse.php` | 1 |
| `app/Http/Controllers/PollController.php` | `app/Http/Controllers/RsvpController.php` | 1 |
| `app/Http/Requests/StorePollRequest.php` | `app/Http/Requests/StoreRsvpRequest.php` | 1 |
| `app/Http/Requests/UpdatePollRequest.php` | `app/Http/Requests/UpdateRsvpRequest.php` | 1 |
| `app/Http/Resources/PollResource.php` | `app/Http/Resources/RsvpResource.php` | 1 |
| `database/factories/PollFactory.php` | `database/factories/RsvpFactory.php` | 1 |
| `tests/Feature/PollTest.php` | `tests/Feature/RsvpTest.php` | 1 |
| `servetrack-frontend/src/app/voting-poll/` | `servetrack-frontend/src/app/rsvp/` | 1 |
| `servetrack-frontend/src/app/models/poll.ts` | `servetrack-frontend/src/app/models/rsvp.ts` | 1 |
| `servetrack-frontend/src/app/services/poll.service.ts` | `servetrack-frontend/src/app/services/rsvp.service.ts` | 1 |

### Files to Modify

| File | Changes |
|------|---------|
| `routes/api.php` | Update routes, add new endpoints |
| `config/services.php` | Add Facebook, Twilio config |
| `.env.example` | Add new environment variables |
| `servetrack-frontend/src/app/admin-dashboard/*` | Update to use RSVP |
| `servetrack-frontend/src/app/volunteer-dashboard/*` | Update to use RSVP |
| `servetrack-frontend/src/app/app.routes.ts` | Update routes |

---

## Testing Strategy

### Phase 1 - RSVP Rename
- Run existing 30 tests after renaming
- Update test assertions to match new names
- Ensure all CRUD operations work

### Phase 2 - Facebook Integration
- Test sending to single volunteer
- Test sending to multiple volunteers
- Test failure handling (invalid FB ID, API error)
- Test rate limiting

### Phase 3 - Facebook Login
- Test OAuth flow end-to-end
- Test new volunteer creation
- Test existing volunteer login
- Test token generation

### Phase 4 - SMS
- Test SMS sending
- Test failure handling
- Test combined notification

### Phase 5 - Check-in
- Test check-in workflow
- Test check-out workflow
- Test attendance statistics
- Test no-show marking

---

## Implementation Order

1. **Phase 1:** Rename Poll → RSVP (start here, foundational)
2. **Phase 2:** Facebook Messenger notifications (most valuable)
3. **Phase 3:** Facebook Login (enhances UX)
4. **Phase 4:** SMS backup (optional backup)
5. **Phase 5:** Check-in/out (if time permits)

---

## Notes

- Facebook API requires HTTPS in production
- Page access tokens may expire; implement refresh logic
- Consider rate limiting for bulk notifications
- SMS provider costs apply (Twilio pay-per-SMS)
- Check-in can work offline with sync when back online
