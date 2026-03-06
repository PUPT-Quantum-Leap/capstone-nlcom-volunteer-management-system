# Update Profile Enhancement Plan

**Project:** ServeTrack Volunteer Management System
**Backend:** Laravel 12
**Date:** March 3, 2026
**Status:** Draft (Revised)

---

## Overview

This plan outlines improvements to the volunteer profile update functionality: fixing security issues, adding missing features, and enhancing admin capabilities.

### Prerequisites

- A `VolunteerFactory` does not exist yet — **Phase 0** creates it so all subsequent tests can use it.
- The `AppServiceProvider` already enforces a strong password policy (min 12, mixed case, numbers, symbols, uncompromised).
- The existing `AdvancedRateLimit` middleware handles auth routes; profile routes need their own throttle via Laravel's built-in `RateLimiter`.

---

## Phase 0: Test Infrastructure

### 0.1 Create VolunteerFactory

**Goal:** Enable all feature tests to quickly seed authenticated volunteers.

**Files to Create:**
- `database/factories/VolunteerFactory.php`

**Steps:**

1. **Create factory**
   ```bash
   php artisan make:factory VolunteerFactory --model=Volunteer --no-interaction
   ```

2. **Implement factory definition**
   ```php
   namespace Database\Factories;

   use App\Models\User;
   use App\Models\Volunteer;
   use Illuminate\Database\Eloquent\Factories\Factory;

   /** @extends Factory<Volunteer> */
   class VolunteerFactory extends Factory
   {
       protected $model = Volunteer::class;

       public function definition(): array
       {
           return [
               'first_name' => fake()->firstName(),
               'last_name' => fake()->lastName(),
               'facebook_name' => fake()->optional()->userName(),
               'email' => fake()->unique()->safeEmail(),
               'mobile_number' => fake()->numerify('09#########'),
               'birthdate' => fake()->dateTimeBetween('-50 years', '-18 years'),
               'address' => fake()->address(),
               'educational_attainment' => fake()->randomElement([
                   'High School', 'College', 'Vocational', "Master's Degree",
               ]),
               'last_medical_examination' => fake()->dateTimeBetween('-1 year', 'today'),
               'user_id' => User::factory(),
           ];
       }
   }
   ```

3. **Add `HasFactory` confirmation** — already present in `Volunteer.php`.

4. **Add test helper to `tests/Pest.php`**
   ```php
   use App\Models\User;
   use App\Models\Volunteer;

   function createVolunteerUser(array $userOverrides = [], array $volunteerOverrides = []): array
   {
       $user = User::factory()->create($userOverrides);
       $volunteer = Volunteer::factory()->create(
           array_merge(['user_id' => $user->id], $volunteerOverrides)
       );

       return ['user' => $user, 'volunteer' => $volunteer];
   }
   ```

---

## Phase 1: Fix Critical Issues (High Priority)

### 1.1 Fix Authorization

**Goal:** Ensure only users with a linked volunteer profile can update it.

**Files to Modify:**
- `app/Http/Requests/UpdateVolunteerProfileRequest.php`

**Change:**

```diff
  public function authorize(): bool
  {
-     return $this->user() !== null;
+     return $this->user()?->volunteer !== null;
  }
```

**Rationale:** A plain authenticated user (e.g., admin or coordinator without a volunteer record) should not be able to hit this endpoint.

---

### 1.2 Add Rate Limiting

**Goal:** Prevent abuse of profile update and password change endpoints.

**Files to Modify:**
- `app/Providers/AppServiceProvider.php`
- `routes/api.php`

**Steps:**

1. **Register rate limiters in `AppServiceProvider::boot()`**
   ```php
   use Illuminate\Cache\RateLimiting\Limit;
   use Illuminate\Support\Facades\RateLimiter;

   // Inside boot(), after the existing Password::defaults block:
   RateLimiter::for('profile-update', function (Request $request) {
       return Limit::perMinute(10)->by($request->user()?->id ?: $request->ip());
   });

   RateLimiter::for('password-change', function (Request $request) {
       return Limit::perMinute(5)->by($request->user()?->id ?: $request->ip());
   });
   ```

2. **Apply throttle to routes in `api.php`**
   ```php
   Route::put('/volunteer/profile', [VolunteerController::class, 'updateProfile'])
       ->middleware('throttle:profile-update');

   Route::post('/volunteer/change-password', [VolunteerController::class, 'changePassword'])
       ->middleware('throttle:password-change');
   ```

> [!NOTE]
> This uses Laravel's built-in `RateLimiter::for()` pattern — **not** the old `throttle:name:attempts,minutes` string syntax which doesn't work in Laravel 12.

---

### 1.3 Add Audit Logging via Eloquent Observer

**Goal:** Track all profile field changes for accountability.

**Files to Create:**
- `app/Models/ProfileChangeLog.php` + migration
- `app/Observers/VolunteerObserver.php`

**Why Observer instead of Middleware:** Eloquent fires `updating`/`updated` events and provides `getDirty()` and `getOriginal()` methods, making it trivial to capture old → new values. A middleware would need to snapshot data before the request and diff after — fragile and duplicative.

**Steps:**

1. **Create model + migration**
   ```bash
   php artisan make:model ProfileChangeLog -m --no-interaction
   ```

2. **Migration schema**
   ```php
   Schema::create('profile_change_logs', function (Blueprint $table) {
       $table->id();
       $table->foreignId('volunteer_id')->constrained('volunteer', 'volunteer_id')->cascadeOnDelete();
       $table->foreignId('changed_by_user_id')->constrained('users')->cascadeOnDelete();
       $table->string('field_name');
       $table->text('old_value')->nullable();
       $table->text('new_value')->nullable();
       $table->string('ip_address', 45)->nullable();
       $table->timestamps();
   });
   ```

3. **Create observer**
   ```bash
   php artisan make:observer VolunteerObserver --model=Volunteer --no-interaction
   ```

4. **Implement observer**
   ```php
   namespace App\Observers;

   use App\Models\ProfileChangeLog;
   use App\Models\Volunteer;

   class VolunteerObserver
   {
       public function updating(Volunteer $volunteer): void
       {
           $dirty = $volunteer->getDirty();
           $original = $volunteer->getOriginal();
           $userId = auth()->id();
           $ip = request()->ip();

           foreach ($dirty as $field => $newValue) {
               ProfileChangeLog::create([
                   'volunteer_id' => $volunteer->volunteer_id,
                   'changed_by_user_id' => $userId,
                   'field_name' => $field,
                   'old_value' => $original[$field] ?? null,
                   'new_value' => $newValue,
                   'ip_address' => $ip,
               ]);
           }
       }
   }
   ```

5. **Register observer in `AppServiceProvider::boot()`**
   ```php
   use App\Models\Volunteer;
   use App\Observers\VolunteerObserver;

   Volunteer::observe(VolunteerObserver::class);
   ```

---

### 1.4 Improve Validation

**Goal:** Add stronger validation rules for edge cases.

**Files to Modify:**
- `app/Http/Requests/UpdateVolunteerProfileRequest.php`

**Changes:**

1. **Add `volunteerPreference` allowlist** using `Rule::in()`
   ```php
   'volunteerPreference' => ['required', 'string', Rule::in([
       'sidewalk-sunday-school', 'mobile-kitchen', 'relief-operations',
       'safety-emergency', 'medical-operations', 'psychological-aid',
       'transportation-logistics', 'purchasing', 'partnerships',
       'digital-marketing', 'creatives', 'healing', 'real-estate-sports',
       'kitchen-related', 'wherever-needed', 'dont-know', 'other',
   ])],
   ```

2. **Fix `otherPreference` conditional logic**
   ```php
   // otherPreference is REQUIRED when preference is 'other', PROHIBITED otherwise
   'otherPreference' => [
       'nullable', 'string', 'max:255',
       'required_if:volunteerPreference,other',
       'prohibited_unless:volunteerPreference,other',
   ],
   ```

3. **Add custom messages for new rules**
   ```php
   'volunteerPreference.in' => 'Invalid volunteer preference selected.',
   'otherPreference.required_if' => 'Please specify your other preference.',
   'otherPreference.max' => 'Other preference cannot exceed 255 characters.',
   ```

---

## Phase 2: Add Missing Features (Medium Priority)

### 2.1 Password Change Endpoint

**Goal:** Allow volunteers to change their password from the profile page.

**Files to Create:**
- `app/Http/Requests/ChangePasswordRequest.php`

**Files to Modify:**
- `app/Http/Controllers/VolunteerController.php`
- `routes/api.php`

**Steps:**

1. **Create Form Request**
   ```bash
   php artisan make:request ChangePasswordRequest --no-interaction
   ```

2. **Implement validation**
   ```php
   namespace App\Http\Requests;

   use Illuminate\Foundation\Http\FormRequest;
   use Illuminate\Validation\Rules\Password;

   class ChangePasswordRequest extends FormRequest
   {
       public function authorize(): bool
       {
           return $this->user()?->volunteer !== null;
       }

       public function rules(): array
       {
           return [
               'currentPassword' => ['required', 'string'],
               'newPassword' => ['required', 'string', Password::defaults(), 'confirmed'],
               'newPassword_confirmation' => ['required', 'string'],
           ];
       }

       public function messages(): array
       {
           return [
               'currentPassword.required' => 'Current password is required.',
               'newPassword.required' => 'New password is required.',
               'newPassword.confirmed' => 'New password and confirmation do not match.',
               'newPassword_confirmation.required' => 'Please confirm your new password.',
           ];
       }
   }
   ```

   > [!NOTE]
   > Uses `Password::defaults()` which re-uses the rules from `AppServiceProvider` (min 12, mixed case, numbers, symbols, uncompromised).

3. **Add controller method**
   ```php
   use App\Http\Requests\ChangePasswordRequest;
   use Illuminate\Support\Facades\Hash;

   public function changePassword(ChangePasswordRequest $request): JsonResponse
   {
       $user = $request->user();

       if (! Hash::check($request->currentPassword, $user->password)) {
           return response()->json([
               'success' => false,
               'message' => 'Current password is incorrect.',
           ], 422);
       }

       $user->update([
           'password' => Hash::make($request->newPassword),
       ]);

       return response()->json([
           'success' => true,
           'message' => 'Password changed successfully.',
       ]);
   }
   ```

4. **Add route** (inside the `auth:sanctum` group in `api.php`)
   ```php
   Route::post('/volunteer/change-password', [VolunteerController::class, 'changePassword'])
       ->middleware('throttle:password-change');
   ```

---

### 2.2 Profile Photo Upload

**Goal:** Allow volunteers to upload and update profile photos.

**Files to Create:**
- `app/Http/Requests/UpdateProfilePhotoRequest.php`
- Migration: `add_profile_photo_to_volunteer_table`

**Files to Modify:**
- `app/Models/Volunteer.php`
- `app/Http/Controllers/VolunteerController.php`
- `routes/api.php`

**Steps:**

1. **Create migration**
   ```bash
   php artisan make:migration add_profile_photo_to_volunteer_table --table=volunteer --no-interaction
   ```
   ```php
   Schema::table('volunteer', function (Blueprint $table) {
       $table->string('profile_photo')->nullable()->after('last_medical_examination');
   });
   ```

2. **Add `profile_photo` to `Volunteer::$fillable`**

3. **Create Form Request**
   ```bash
   php artisan make:request UpdateProfilePhotoRequest --no-interaction
   ```
   ```php
   public function rules(): array
   {
       return [
           'photo' => ['required', 'image', 'mimes:jpg,jpeg,png,webp', 'max:2048'],
       ];
   }
   ```

4. **Add controller method** — uses `POST` (not `PUT`) since PHP doesn't parse multipart form data on PUT requests:
   ```php
   use Illuminate\Support\Facades\Storage;

   public function updateProfilePhoto(UpdateProfilePhotoRequest $request): JsonResponse
   {
       $volunteer = $request->user()->volunteer;

       if (! $volunteer) {
           return response()->json([
               'success' => false,
               'message' => 'Volunteer profile not found.',
           ], 404);
       }

       // Delete old photo if exists
       if ($volunteer->profile_photo) {
           Storage::disk('public')->delete($volunteer->profile_photo);
       }

       $path = $request->file('photo')->store('profile-photos', 'public');

       $volunteer->update(['profile_photo' => $path]);

       return response()->json([
           'success' => true,
           'message' => 'Profile photo updated successfully.',
           'data' => [
               'profile_photo_url' => Storage::disk('public')->url($path),
           ],
       ]);
   }
   ```

5. **Add route** (inside `auth:sanctum` group)
   ```php
   Route::post('/volunteer/profile/photo', [VolunteerController::class, 'updateProfilePhoto']);
   ```

6. **Ensure storage link exists** — run `php artisan storage:link` once per environment.

---

### 2.3 API Resource for Consistent Responses

**Goal:** Standardize volunteer profile API responses.

**Files to Create:**
- `app/Http/Resources/VolunteerProfileResource.php`

**Steps:**

1. **Create resource**
   ```bash
   php artisan make:resource VolunteerProfileResource --no-interaction
   ```

2. **Implement**
   ```php
   namespace App\Http\Resources;

   use Illuminate\Http\Request;
   use Illuminate\Http\Resources\Json\JsonResource;
   use Illuminate\Support\Facades\Storage;

   class VolunteerProfileResource extends JsonResource
   {
       public function toArray(Request $request): array
       {
           return [
               'volunteer_id' => $this->volunteer_id,
               'first_name' => $this->first_name,
               'last_name' => $this->last_name,
               'full_name' => $this->first_name . ' ' . $this->last_name,
               'facebook_name' => $this->facebook_name,
               'email' => $this->email,
               'mobile_number' => $this->mobile_number,
               'birthdate' => $this->birthdate?->format('Y-m-d'),
               'address' => $this->address,
               'educational_attainment' => $this->educational_attainment,
               'last_medical_examination' => $this->last_medical_examination?->format('Y-m-d'),
               'profile_photo_url' => $this->profile_photo
                   ? Storage::disk('public')->url($this->profile_photo)
                   : null,
               'skills' => $this->whenLoaded('skills', fn () => $this->skills->pluck('name')),
               'trainings' => $this->whenLoaded('trainings', fn () => $this->trainings->pluck('name')),
               'positions' => $this->whenLoaded('positions', fn () => $this->positions->pluck('name')),
               'experiences' => $this->whenLoaded('experiences', fn () => $this->experiences->pluck('name')),
               'created_at' => $this->created_at?->format('Y-m-d H:i:s'),
               'updated_at' => $this->updated_at?->format('Y-m-d H:i:s'),
           ];
       }
   }
   ```

3. **Update `profile()` and `updateProfile()` in `VolunteerController`** to return `VolunteerProfileResource::make(...)`.

---

## Phase 3: Enhance Admin Features (Low Priority)

### 3.1 Admin Search/Filter with Pagination

**Goal:** Allow admins to search, filter, sort, and paginate volunteers.

**Files to Modify:**
- `app/Http/Controllers/VolunteerController.php` — update `index()` method

**Key safeguard:** Validate the `sort` parameter against an allowlist to prevent SQL injection:

```php
public function index(Request $request): JsonResponse
{
    $query = Volunteer::with([
        'experiences', 'skills', 'trainings',
        'positions', 'availabilities', 'lifegroups',
    ]);

    // Search
    if ($search = $request->query('search')) {
        $query->where(function ($q) use ($search) {
            $q->where('first_name', 'like', '%' . $search . '%')
              ->orWhere('last_name', 'like', '%' . $search . '%')
              ->orWhere('email', 'like', '%' . $search . '%')
              ->orWhere('mobile_number', 'like', '%' . $search . '%');
        });
    }

    // Filter by position
    if ($position = $request->query('position')) {
        $query->whereHas('positions', fn ($q) => $q->where('name', $position));
    }

    // Sort — allowlist to prevent SQL injection
    $allowedSorts = ['first_name', 'last_name', 'email', 'created_at', 'updated_at'];
    $sortBy = in_array($request->query('sort'), $allowedSorts)
        ? $request->query('sort')
        : 'created_at';
    $sortOrder = $request->query('order') === 'asc' ? 'asc' : 'desc';

    $query->orderBy($sortBy, $sortOrder);

    // Paginate
    $perPage = min((int) $request->query('per_page', 15), 100);
    $volunteers = $query->paginate($perPage);

    return response()->json([
        'success' => true,
        'data' => VolunteerProfileResource::collection($volunteers),
        'meta' => [
            'total' => $volunteers->total(),
            'per_page' => $volunteers->perPage(),
            'current_page' => $volunteers->currentPage(),
            'last_page' => $volunteers->lastPage(),
        ],
    ]);
}
```

> [!WARNING]
> The admin routes reference a `role:admin|coordinator` middleware that is not yet registered. This middleware or a policy/gate needs to be created before Phase 3 can be implemented.

---

### 3.2 Admin Volunteer Detail View

**Goal:** Enhance `show()` to return stats alongside full volunteer data.

Update the existing `show(int $id)` method to include attendance stats (total, approved, pending, rejected, total hours).

---

### 3.3 Change History Endpoint

**Goal:** Expose profile change logs to admins.

**Files to Create:**
- `app/Http/Resources/ProfileChangeLogResource.php`

**Files to Modify:**
- `app/Http/Controllers/VolunteerController.php` — add `changeHistory()` method
- `routes/api.php` — add admin route

```php
Route::get('/admin/volunteers/{id}/change-history', [VolunteerController::class, 'changeHistory'])
    ->middleware(['auth:sanctum']); // Add role middleware when available
```

---

## Test Suite Plan

All tests use **Pest v3** with `RefreshDatabase`. Run with:
```bash
php artisan test --compact tests/Feature/VolunteerProfileTest.php
php artisan test --compact tests/Feature/ChangePasswordTest.php
php artisan test --compact tests/Feature/ProfilePhotoTest.php
php artisan test --compact tests/Feature/ProfileAuditLogTest.php
php artisan test --compact tests/Feature/AdminVolunteerTest.php
```

Or run all at once:
```bash
php artisan test --compact --filter=Volunteer
```

---

### File: `tests/Feature/VolunteerProfileTest.php`

```php
<?php

use App\Models\User;
use App\Models\Volunteer;

// ─── Authorization ───────────────────────────────────────────────

describe('Profile Authorization', function (): void {
    it('denies unauthenticated access to profile', function (): void {
        $this->getJson('/api/volunteer/profile')
            ->assertUnauthorized();
    });

    it('denies unauthenticated access to update profile', function (): void {
        $this->putJson('/api/volunteer/profile', [])
            ->assertUnauthorized();
    });

    it('denies profile update for authenticated user without volunteer record', function (): void {
        $user = User::factory()->create();

        $this->actingAs($user)
            ->putJson('/api/volunteer/profile', [
                'firstName' => 'Test',
                'lastName' => 'User',
                'email' => 'test@example.com',
                'mobileNumber' => '09123456789',
                'birthdate' => '1990-01-01',
                'completeAddress' => '123 Test Street, City',
                'lastMedicalExam' => '2025-06-15',
                'educationalAttainment' => 'College',
                'volunteerPreference' => 'wherever-needed',
            ])
            ->assertForbidden();
    });

    it('allows profile update for authenticated volunteer', function (): void {
        $user = User::factory()->create();
        $volunteer = Volunteer::factory()->create(['user_id' => $user->id]);

        $this->actingAs($user)
            ->putJson('/api/volunteer/profile', [
                'firstName' => 'Updated',
                'lastName' => 'Name',
                'email' => $volunteer->email,
                'mobileNumber' => '09123456789',
                'birthdate' => '1990-01-01',
                'completeAddress' => '123 Updated Street, City',
                'lastMedicalExam' => '2025-06-15',
                'educationalAttainment' => 'College',
                'volunteerPreference' => 'wherever-needed',
            ])
            ->assertSuccessful();
    });

    it('returns 404 when volunteer profile does not exist on GET', function (): void {
        $user = User::factory()->create();

        $this->actingAs($user)
            ->getJson('/api/volunteer/profile')
            ->assertNotFound();
    });
});

// ─── Validation ──────────────────────────────────────────────────

describe('Profile Update Validation', function (): void {
    beforeEach(function (): void {
        $this->user = User::factory()->create();
        $this->volunteer = Volunteer::factory()->create(['user_id' => $this->user->id]);
        $this->actingAs($this->user);
    });

    it('requires all mandatory fields', function (string $field): void {
        $this->putJson('/api/volunteer/profile', [$field => ''])
            ->assertUnprocessable()
            ->assertJsonValidationErrors([$field]);
    })->with([
        'firstName',
        'lastName',
        'email',
        'mobileNumber',
        'birthdate',
        'completeAddress',
        'lastMedicalExam',
        'educationalAttainment',
        'volunteerPreference',
    ]);

    it('rejects invalid email format', function (): void {
        $this->putJson('/api/volunteer/profile', ['email' => 'not-an-email'])
            ->assertUnprocessable()
            ->assertJsonValidationErrors(['email']);
    });

    it('rejects duplicate email from another volunteer', function (): void {
        $otherVolunteer = Volunteer::factory()->create(['email' => 'taken@example.com']);

        $this->putJson('/api/volunteer/profile', [
            'firstName' => 'Test',
            'lastName' => 'User',
            'email' => 'taken@example.com',
            'mobileNumber' => '09123456789',
            'birthdate' => '1990-01-01',
            'completeAddress' => '123 Test Street, City',
            'lastMedicalExam' => '2025-06-15',
            'educationalAttainment' => 'College',
            'volunteerPreference' => 'wherever-needed',
        ])
            ->assertUnprocessable()
            ->assertJsonValidationErrors(['email']);
    });

    it('allows keeping own email on update', function (): void {
        $this->putJson('/api/volunteer/profile', [
            'firstName' => 'Test',
            'lastName' => 'User',
            'email' => $this->volunteer->email,
            'mobileNumber' => '09123456789',
            'birthdate' => '1990-01-01',
            'completeAddress' => '123 Test Street, City',
            'lastMedicalExam' => '2025-06-15',
            'educationalAttainment' => 'College',
            'volunteerPreference' => 'wherever-needed',
        ])
            ->assertSuccessful();
    });

    it('rejects future birthdate', function (): void {
        $this->putJson('/api/volunteer/profile', ['birthdate' => '2030-01-01'])
            ->assertUnprocessable()
            ->assertJsonValidationErrors(['birthdate']);
    });

    it('rejects future medical exam date', function (): void {
        $this->putJson('/api/volunteer/profile', ['lastMedicalExam' => '2030-01-01'])
            ->assertUnprocessable()
            ->assertJsonValidationErrors(['lastMedicalExam']);
    });

    it('rejects invalid volunteer preference', function (): void {
        $this->putJson('/api/volunteer/profile', [
            'firstName' => 'Test',
            'lastName' => 'User',
            'email' => $this->volunteer->email,
            'mobileNumber' => '09123456789',
            'birthdate' => '1990-01-01',
            'completeAddress' => '123 Test Street, City',
            'lastMedicalExam' => '2025-06-15',
            'educationalAttainment' => 'College',
            'volunteerPreference' => 'invalid-preference',
        ])
            ->assertUnprocessable()
            ->assertJsonValidationErrors(['volunteerPreference']);
    });

    it('requires otherPreference when volunteerPreference is other', function (): void {
        $this->putJson('/api/volunteer/profile', [
            'firstName' => 'Test',
            'lastName' => 'User',
            'email' => $this->volunteer->email,
            'mobileNumber' => '09123456789',
            'birthdate' => '1990-01-01',
            'completeAddress' => '123 Test Street, City',
            'lastMedicalExam' => '2025-06-15',
            'educationalAttainment' => 'College',
            'volunteerPreference' => 'other',
            'otherPreference' => null,
        ])
            ->assertUnprocessable()
            ->assertJsonValidationErrors(['otherPreference']);
    });

    it('rejects otherPreference when volunteerPreference is not other', function (): void {
        $this->putJson('/api/volunteer/profile', [
            'firstName' => 'Test',
            'lastName' => 'User',
            'email' => $this->volunteer->email,
            'mobileNumber' => '09123456789',
            'birthdate' => '1990-01-01',
            'completeAddress' => '123 Test Street, City',
            'lastMedicalExam' => '2025-06-15',
            'educationalAttainment' => 'College',
            'volunteerPreference' => 'wherever-needed',
            'otherPreference' => 'Custom position',
        ])
            ->assertUnprocessable()
            ->assertJsonValidationErrors(['otherPreference']);
    });
});

// ─── Successful Update ───────────────────────────────────────────

describe('Profile Update Success', function (): void {
    it('updates volunteer fields in the database', function (): void {
        $user = User::factory()->create();
        $volunteer = Volunteer::factory()->create(['user_id' => $user->id]);

        $this->actingAs($user)
            ->putJson('/api/volunteer/profile', [
                'firstName' => 'NewFirst',
                'lastName' => 'NewLast',
                'email' => 'newemail@example.com',
                'mobileNumber' => '09999999999',
                'birthdate' => '1995-05-15',
                'completeAddress' => '456 New Address, New City',
                'lastMedicalExam' => '2025-12-01',
                'educationalAttainment' => "Master's Degree",
                'volunteerPreference' => 'medical-operations',
            ])
            ->assertSuccessful()
            ->assertJsonPath('success', true);

        $volunteer->refresh();
        expect($volunteer->first_name)->toBe('NewFirst')
            ->and($volunteer->last_name)->toBe('NewLast')
            ->and($volunteer->email)->toBe('newemail@example.com');
    });

    it('also updates the linked user name and email', function (): void {
        $user = User::factory()->create();
        $volunteer = Volunteer::factory()->create(['user_id' => $user->id]);

        $this->actingAs($user)
            ->putJson('/api/volunteer/profile', [
                'firstName' => 'Synced',
                'lastName' => 'User',
                'email' => 'synced@example.com',
                'mobileNumber' => '09123456789',
                'birthdate' => '1990-01-01',
                'completeAddress' => '123 Test Street, City',
                'lastMedicalExam' => '2025-06-15',
                'educationalAttainment' => 'College',
                'volunteerPreference' => 'wherever-needed',
            ])
            ->assertSuccessful();

        $user->refresh();
        expect($user->name)->toBe('Synced User')
            ->and($user->email)->toBe('synced@example.com');
    });
});
```

---

### File: `tests/Feature/ChangePasswordTest.php`

```php
<?php

use App\Models\User;
use App\Models\Volunteer;
use Illuminate\Support\Facades\Hash;

describe('Change Password', function (): void {
    beforeEach(function (): void {
        $this->user = User::factory()->create([
            'password' => Hash::make('OldPassword1!Secure'),
        ]);
        $this->volunteer = Volunteer::factory()->create(['user_id' => $this->user->id]);
        $this->actingAs($this->user);
    });

    it('changes password with valid current password', function (): void {
        $this->postJson('/api/volunteer/change-password', [
            'currentPassword' => 'OldPassword1!Secure',
            'newPassword' => 'NewPassword2!Strong',
            'newPassword_confirmation' => 'NewPassword2!Strong',
        ])
            ->assertSuccessful()
            ->assertJsonPath('success', true);

        $this->user->refresh();
        expect(Hash::check('NewPassword2!Strong', $this->user->password))->toBeTrue();
    });

    it('rejects incorrect current password', function (): void {
        $this->postJson('/api/volunteer/change-password', [
            'currentPassword' => 'WrongPassword!1234',
            'newPassword' => 'NewPassword2!Strong',
            'newPassword_confirmation' => 'NewPassword2!Strong',
        ])
            ->assertUnprocessable()
            ->assertJsonPath('success', false);
    });

    it('rejects mismatched new password confirmation', function (): void {
        $this->postJson('/api/volunteer/change-password', [
            'currentPassword' => 'OldPassword1!Secure',
            'newPassword' => 'NewPassword2!Strong',
            'newPassword_confirmation' => 'DifferentPassword!3',
        ])
            ->assertUnprocessable()
            ->assertJsonValidationErrors(['newPassword']);
    });

    it('rejects weak new password', function (): void {
        $this->postJson('/api/volunteer/change-password', [
            'currentPassword' => 'OldPassword1!Secure',
            'newPassword' => 'short',
            'newPassword_confirmation' => 'short',
        ])
            ->assertUnprocessable()
            ->assertJsonValidationErrors(['newPassword']);
    });

    it('requires all fields', function (string $field): void {
        $this->postJson('/api/volunteer/change-password', [$field => ''])
            ->assertUnprocessable()
            ->assertJsonValidationErrors([$field]);
    })->with([
        'currentPassword',
        'newPassword',
        'newPassword_confirmation',
    ]);

    it('denies access for user without volunteer record', function (): void {
        $plainUser = User::factory()->create();

        $this->actingAs($plainUser)
            ->postJson('/api/volunteer/change-password', [
                'currentPassword' => 'password',
                'newPassword' => 'NewPassword2!Strong',
                'newPassword_confirmation' => 'NewPassword2!Strong',
            ])
            ->assertForbidden();
    });

    it('denies unauthenticated access', function (): void {
        // Create a fresh test instance without actingAs
        $this->app->make('auth')->forgetGuards();

        $response = $this->postJson('/api/volunteer/change-password', [
            'currentPassword' => 'password',
            'newPassword' => 'NewPassword2!Strong',
            'newPassword_confirmation' => 'NewPassword2!Strong',
        ]);

        $response->assertUnauthorized();
    });
});
```

---

### File: `tests/Feature/ProfilePhotoTest.php`

```php
<?php

use App\Models\User;
use App\Models\Volunteer;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;

describe('Profile Photo Upload', function (): void {
    beforeEach(function (): void {
        Storage::fake('public');
        $this->user = User::factory()->create();
        $this->volunteer = Volunteer::factory()->create(['user_id' => $this->user->id]);
        $this->actingAs($this->user);
    });

    it('uploads a valid profile photo', function (): void {
        $photo = UploadedFile::fake()->image('avatar.jpg', 400, 400);

        $this->postJson('/api/volunteer/profile/photo', ['photo' => $photo])
            ->assertSuccessful()
            ->assertJsonPath('success', true)
            ->assertJsonStructure(['data' => ['profile_photo_url']]);

        $this->volunteer->refresh();
        expect($this->volunteer->profile_photo)->not->toBeNull();
        Storage::disk('public')->assertExists($this->volunteer->profile_photo);
    });

    it('deletes old photo when uploading new one', function (): void {
        // Upload first photo
        $oldPhoto = UploadedFile::fake()->image('old.jpg');
        $this->postJson('/api/volunteer/profile/photo', ['photo' => $oldPhoto])
            ->assertSuccessful();

        $oldPath = $this->volunteer->fresh()->profile_photo;

        // Upload replacement photo
        $newPhoto = UploadedFile::fake()->image('new.jpg');
        $this->postJson('/api/volunteer/profile/photo', ['photo' => $newPhoto])
            ->assertSuccessful();

        Storage::disk('public')->assertMissing($oldPath);
    });

    it('rejects non-image files', function (): void {
        $file = UploadedFile::fake()->create('document.pdf', 100, 'application/pdf');

        $this->postJson('/api/volunteer/profile/photo', ['photo' => $file])
            ->assertUnprocessable()
            ->assertJsonValidationErrors(['photo']);
    });

    it('rejects files exceeding 2MB', function (): void {
        $photo = UploadedFile::fake()->image('large.jpg')->size(3000);

        $this->postJson('/api/volunteer/profile/photo', ['photo' => $photo])
            ->assertUnprocessable()
            ->assertJsonValidationErrors(['photo']);
    });

    it('rejects request without photo', function (): void {
        $this->postJson('/api/volunteer/profile/photo', [])
            ->assertUnprocessable()
            ->assertJsonValidationErrors(['photo']);
    });

    it('accepts jpg, png, and webp formats', function (string $extension): void {
        $photo = UploadedFile::fake()->image("avatar.{$extension}", 200, 200);

        $this->postJson('/api/volunteer/profile/photo', ['photo' => $photo])
            ->assertSuccessful();
    })->with(['jpg', 'png', 'webp']);

    it('denies unauthenticated access', function (): void {
        $this->app->make('auth')->forgetGuards();

        $photo = UploadedFile::fake()->image('avatar.jpg');

        $this->postJson('/api/volunteer/profile/photo', ['photo' => $photo])
            ->assertUnauthorized();
    });
});
```

---

### File: `tests/Feature/ProfileAuditLogTest.php`

```php
<?php

use App\Models\ProfileChangeLog;
use App\Models\User;
use App\Models\Volunteer;

describe('Profile Audit Logging', function (): void {
    beforeEach(function (): void {
        $this->user = User::factory()->create();
        $this->volunteer = Volunteer::factory()->create([
            'user_id' => $this->user->id,
            'first_name' => 'Original',
            'last_name' => 'Name',
            'email' => 'original@example.com',
        ]);
        $this->actingAs($this->user);
    });

    it('logs each changed field on profile update', function (): void {
        $this->putJson('/api/volunteer/profile', [
            'firstName' => 'Changed',
            'lastName' => 'Name',
            'email' => 'original@example.com',
            'mobileNumber' => $this->volunteer->mobile_number,
            'birthdate' => $this->volunteer->birthdate->format('Y-m-d'),
            'completeAddress' => $this->volunteer->address,
            'lastMedicalExam' => $this->volunteer->last_medical_examination->format('Y-m-d'),
            'educationalAttainment' => $this->volunteer->educational_attainment,
            'volunteerPreference' => 'wherever-needed',
        ])
            ->assertSuccessful();

        $log = ProfileChangeLog::where('volunteer_id', $this->volunteer->volunteer_id)
            ->where('field_name', 'first_name')
            ->first();

        expect($log)->not->toBeNull()
            ->and($log->old_value)->toBe('Original')
            ->and($log->new_value)->toBe('Changed')
            ->and($log->changed_by_user_id)->toBe($this->user->id);
    });

    it('does not log unchanged fields', function (): void {
        $this->putJson('/api/volunteer/profile', [
            'firstName' => $this->volunteer->first_name,
            'lastName' => $this->volunteer->last_name,
            'email' => $this->volunteer->email,
            'mobileNumber' => $this->volunteer->mobile_number,
            'birthdate' => $this->volunteer->birthdate->format('Y-m-d'),
            'completeAddress' => $this->volunteer->address,
            'lastMedicalExam' => $this->volunteer->last_medical_examination->format('Y-m-d'),
            'educationalAttainment' => $this->volunteer->educational_attainment,
            'volunteerPreference' => 'wherever-needed',
        ])
            ->assertSuccessful();

        $logCount = ProfileChangeLog::where('volunteer_id', $this->volunteer->volunteer_id)->count();

        expect($logCount)->toBe(0);
    });

    it('logs multiple changed fields as separate records', function (): void {
        $this->putJson('/api/volunteer/profile', [
            'firstName' => 'NewFirst',
            'lastName' => 'NewLast',
            'email' => 'newemail@example.com',
            'mobileNumber' => $this->volunteer->mobile_number,
            'birthdate' => $this->volunteer->birthdate->format('Y-m-d'),
            'completeAddress' => $this->volunteer->address,
            'lastMedicalExam' => $this->volunteer->last_medical_examination->format('Y-m-d'),
            'educationalAttainment' => $this->volunteer->educational_attainment,
            'volunteerPreference' => 'wherever-needed',
        ])
            ->assertSuccessful();

        $logCount = ProfileChangeLog::where('volunteer_id', $this->volunteer->volunteer_id)->count();

        expect($logCount)->toBeGreaterThanOrEqual(3); // first_name, last_name, email
    });

    it('captures IP address in audit log', function (): void {
        $this->putJson('/api/volunteer/profile', [
            'firstName' => 'IPTest',
            'lastName' => $this->volunteer->last_name,
            'email' => $this->volunteer->email,
            'mobileNumber' => $this->volunteer->mobile_number,
            'birthdate' => $this->volunteer->birthdate->format('Y-m-d'),
            'completeAddress' => $this->volunteer->address,
            'lastMedicalExam' => $this->volunteer->last_medical_examination->format('Y-m-d'),
            'educationalAttainment' => $this->volunteer->educational_attainment,
            'volunteerPreference' => 'wherever-needed',
        ])
            ->assertSuccessful();

        $log = ProfileChangeLog::where('volunteer_id', $this->volunteer->volunteer_id)->first();

        expect($log->ip_address)->not->toBeNull();
    });
});
```

---

### File: `tests/Feature/AdminVolunteerTest.php`

```php
<?php

use App\Models\User;
use App\Models\Volunteer;
use App\Models\ProfileChangeLog;

describe('Admin Volunteer Search & Filter', function (): void {
    beforeEach(function (): void {
        $this->admin = User::factory()->create();
        $this->actingAs($this->admin);

        // Seed test volunteers
        Volunteer::factory()->create(['first_name' => 'Alice', 'last_name' => 'Smith']);
        Volunteer::factory()->create(['first_name' => 'Bob', 'last_name' => 'Jones']);
        Volunteer::factory()->create(['first_name' => 'Charlie', 'last_name' => 'Smith']);
    });

    it('returns paginated volunteer list', function (): void {
        $this->getJson('/api/volunteers?per_page=2')
            ->assertSuccessful()
            ->assertJsonCount(2, 'data')
            ->assertJsonStructure(['data', 'meta' => ['total', 'per_page', 'current_page', 'last_page']]);
    });

    it('searches volunteers by name', function (): void {
        $this->getJson('/api/volunteers?search=Alice')
            ->assertSuccessful()
            ->assertJsonCount(1, 'data');
    });

    it('searches volunteers by partial last name', function (): void {
        $this->getJson('/api/volunteers?search=Smith')
            ->assertSuccessful()
            ->assertJsonCount(2, 'data');
    });

    it('sorts volunteers by first name ascending', function (): void {
        $response = $this->getJson('/api/volunteers?sort=first_name&order=asc')
            ->assertSuccessful();

        $names = collect($response->json('data'))->pluck('first_name')->toArray();
        expect($names)->toBe(['Alice', 'Bob', 'Charlie']);
    });

    it('ignores invalid sort columns', function (): void {
        // Should fall back to created_at without error
        $this->getJson('/api/volunteers?sort=DROP TABLE--')
            ->assertSuccessful();
    });

    it('caps per_page to 100', function (): void {
        $this->getJson('/api/volunteers?per_page=500')
            ->assertSuccessful()
            ->assertJsonPath('meta.per_page', 100);
    });
});

describe('Admin Volunteer Detail View', function (): void {
    it('returns volunteer with stats for valid ID', function (): void {
        $admin = User::factory()->create();
        $volunteer = Volunteer::factory()->create();

        $this->actingAs($admin)
            ->getJson("/api/admin/volunteers/{$volunteer->volunteer_id}")
            ->assertSuccessful()
            ->assertJsonStructure([
                'data' => [
                    'volunteer',
                    'stats' => ['total_attendances', 'approved_attendances', 'pending_attendances'],
                ],
            ]);
    });

    it('returns 404 for non-existent volunteer', function (): void {
        $admin = User::factory()->create();

        $this->actingAs($admin)
            ->getJson('/api/admin/volunteers/99999')
            ->assertNotFound();
    });
});

describe('Volunteer Change History', function (): void {
    it('returns paginated change log for a volunteer', function (): void {
        $admin = User::factory()->create();
        $user = User::factory()->create();
        $volunteer = Volunteer::factory()->create(['user_id' => $user->id]);

        // Create some log entries
        ProfileChangeLog::create([
            'volunteer_id' => $volunteer->volunteer_id,
            'changed_by_user_id' => $user->id,
            'field_name' => 'first_name',
            'old_value' => 'Old',
            'new_value' => 'New',
            'ip_address' => '127.0.0.1',
        ]);

        $this->actingAs($admin)
            ->getJson("/api/admin/volunteers/{$volunteer->volunteer_id}/change-history")
            ->assertSuccessful()
            ->assertJsonCount(1, 'data')
            ->assertJsonStructure(['data', 'meta']);
    });

    it('returns empty list for volunteer with no changes', function (): void {
        $admin = User::factory()->create();
        $volunteer = Volunteer::factory()->create();

        $this->actingAs($admin)
            ->getJson("/api/admin/volunteers/{$volunteer->volunteer_id}/change-history")
            ->assertSuccessful()
            ->assertJsonCount(0, 'data');
    });
});
```

---

## Implementation Order

| Phase | Duration | Key Deliverables |
|-------|----------|-----------------|
| **0** | Day 1 | `VolunteerFactory`, test helpers |
| **1** | Days 2–4 | Auth fix, rate limiting, observer audit log, validation improvements |
| **2** | Days 5–7 | Password change, photo upload, API Resource |
| **3** | Days 8–10 | Admin search/filter, detail view, change history |

---

## Notes

- All new code must pass `vendor/bin/pint --dirty` before commit
- All tests use `RefreshDatabase` (configured in `tests/Pest.php`)
- Password change uses `Password::defaults()` from `AppServiceProvider` (min 12, mixed case, numbers, symbols, uncompromised)
- Profile photo upload uses `POST` (not `PUT`) — PHP cannot parse multipart form data on PUT requests
- Sort parameter in admin search uses an allowlist to prevent SQL injection
- Run `php artisan storage:link` for profile photo URLs to work
