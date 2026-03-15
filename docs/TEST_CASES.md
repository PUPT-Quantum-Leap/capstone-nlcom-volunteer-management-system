# ServeTrack Test Cases

Comprehensive test suite for ServeTrack Volunteer Management System

**Last Updated:** 2026-03-15
**Branch:** feat/poll/api
**Focus:** Admin Authentication Refactoring, Poll System Enhancements

---

## 📋 Table of Contents

1. [Admin Authentication Tests](#admin-authentication-tests)
2. [Poll System Tests](#poll-system-tests)
3. [Frontend Component Tests](#frontend-component-tests)
4. [Integration Tests](#integration-tests)
5. [Manual Testing Checklist](#manual-testing-checklist)
6. [API Testing Collection](#api-testing-collection)
7. [Quick Start Commands](#quick-start-commands)

---

## 🔐 Admin Authentication Tests

### Backend: Pest Tests

**File:** `servetrack-backend/tests/Feature/AdminRegistrationTest.php`

**Security Gate Tests (11 tests):**
- ✅ Registers successfully with correct invite code and allowed domain
- ❌ Rejects when invite code is wrong (generic error)
- ❌ Rejects when invite code is missing (generic error)
- ❌ Rejects when email domain is not in allowed list (generic error)
- ❌ Rejects when ADMIN_INVITE_CODE config is empty (generic error)
- ❌ Rejects when ADMIN_ALLOWED_DOMAINS config is empty (generic error)
- ✅ Accepts email domain case-insensitively
- ✅ Accepts when multiple domains configured and email matches second domain
- ✅ Does NOT reveal which check failed in error message (security)
- ❌ Still validates required fields after passing security checks
- ❌ Prevents duplicate email registration

```php
<?php

use App\Models\User;

function validAdminPayload(): array
{
    return [
        'firstName' => 'Test',
        'lastName' => 'Admin',
        'email' => 'testadmin@example.com',
        'contactNumber' => '+639123456789',
        'password' => 'SecurePass1!XY',
        'confirmPassword' => 'SecurePass1!XY',
        'inviteCode' => 'ChangeMe123!',
    ];
}

describe('Admin Registration Security', function (): void {
    beforeEach(function (): void {
        config(['services.admin.invite_code' => 'ChangeMe123!']);
        config(['services.admin.allowed_domains' => 'example.com']);
    });

    it('registers successfully with correct invite code and allowed domain', function (): void {
        $this->postJson('/api/admin/register', validAdminPayload())
            ->assertCreated()
            ->assertJsonPath('success', true);
    });

    it('rejects registration when invite code is wrong', function (): void {
        $payload = validAdminPayload();
        $payload['inviteCode'] = 'WrongCode!';

        $this->postJson('/api/admin/register', $payload)
            ->assertUnprocessable()
            ->assertJsonPath('message', 'Registration failed. Please contact your administrator.');
    });

    it('rejects registration when invite code is missing', function (): void {
        $payload = validAdminPayload();
        unset($payload['inviteCode']);

        $this->postJson('/api/admin/register', $payload)
            ->assertUnprocessable()
            ->assertJsonPath('message', 'Registration failed. Please contact your administrator.');
    });

    it('rejects registration when email domain is not in allowed list', function (): void {
        $payload = validAdminPayload();
        $payload['email'] = 'hacker@notallowed.com';

        $this->postJson('/api/admin/register', $payload)
            ->assertUnprocessable()
            ->assertJsonPath('message', 'Registration failed. Please contact your administrator.');
    });

    it('rejects registration when ADMIN_INVITE_CODE config is empty', function (): void {
        config(['services.admin.invite_code' => null]);

        $this->postJson('/api/admin/register', validAdminPayload())
            ->assertUnprocessable()
            ->assertJsonPath('message', 'Registration failed. Please contact your administrator.');
    });

    it('rejects registration when ADMIN_ALLOWED_DOMAINS config is empty', function (): void {
        config(['services.admin.allowed_domains' => null]);

        $this->postJson('/api/admin/register', validAdminPayload())
            ->assertUnprocessable()
            ->assertJsonPath('message', 'Registration failed. Please contact your administrator.');
    });

    it('accepts email domain case-insensitively', function (): void {
        $payload = validAdminPayload();
        $payload['email'] = 'testadmin@EXAMPLE.COM';

        $this->postJson('/api/admin/register', $payload)
            ->assertCreated()
            ->assertJsonPath('success', true);
    });

    it('accepts when multiple domains configured and email matches second domain', function (): void {
        config(['services.admin.allowed_domains' => 'other.org,example.com']);

        $this->postJson('/api/admin/register', validAdminPayload())
            ->assertCreated()
            ->assertJsonPath('success', true);
    });

    it('does not reveal which check failed in the error message', function (): void {
        $payload = validAdminPayload();
        $payload['inviteCode'] = 'wrong';
        $payload['email'] = 'hacker@notallowed.com';

        $response = $this->postJson('/api/admin/register', $payload)
            ->assertUnprocessable();

        $message = $response->json('message');
        expect($message)->not->toContain('invite');
        expect($message)->not->toContain('domain');
        expect($message)->toBe('Registration failed. Please contact your administrator.');
    });

    it('still validates required fields after passing security checks', function (): void {
        $this->postJson('/api/admin/register', [
            'inviteCode' => 'ChangeMe123!',
            'email' => 'testadmin@example.com',
            // missing firstName, lastName, password, confirmPassword
        ])
            ->assertUnprocessable()
            ->assertJsonPath('success', false);
    });

    it('prevents duplicate email registration', function (): void {
        User::factory()->create(['email' => 'testadmin@example.com']);

        $this->postJson('/api/admin/register', validAdminPayload())
            ->assertUnprocessable();
    });
});
```

---

## 🗳️ Poll System Tests

### Backend: Poll Validation Tests

**File:** `servetrack-backend/tests/Feature/PollValidationTest.php`

```php
<?php

namespace Tests\Feature;

use Tests\TestCase;
use App\Models\Poll;
use Carbon\Carbon;
use Illuminate\Foundation\Testing\RefreshDatabase;

class PollValidationTest extends TestCase
{
    use RefreshDatabase;

    /** @test */
    public function poll_cutoff_day_cannot_be_after_event_date(): void
    {
        $admin = \App\Models\Admin::factory()->create();

        $response = $this->actingAs($admin)->postJson('/api/polls', [
            'title' => 'Test Poll',
            'description' => 'Description here',
            'date' => '2026-03-20', // Future date
            'cutoff_day' => '2026-03-25', // AFTER event date - invalid
            'cutoff_time' => '14:00',
            'status' => 'draft',
            'options' => [
                ['text' => 'Option 1', 'time_slot' => '9:00 AM', 'capacity' => 10],
            ],
        ]);

        $response->assertStatus(422)
            ->assertJsonFragment([
            'message' => 'Cut-off day must not be after the event date.'
        ]);
    }

    /** @test */
    public function poll_cutoff_day_can_be_equal_to_event_date(): void
    {
        $admin = \App\Models\Admin::factory()->create();

        $response = $this->actingAs($admin)->postJson('/api/polls', [
            'title' => 'Test Poll',
            'description' => 'Description here',
            'date' => '2026-03-20',
            'cutoff_day' => '2026-03-20', // Same day - valid
            'cutoff_time' => '14:00',
            'status' => 'draft',
            'options' => [
                ['text' => 'Option 1', 'time_slot' => '9:00 AM', 'capacity' => 10],
            ],
        ]);

        $response->assertStatus(201);
        $this->assertDatabaseHas('poll', ['title' => 'Test Poll']);
    }

    /** @test */
    public function poll_cutoff_time_accepts_hour_minute_format(): void
    {
        $admin = \App\Models\Admin::factory()->create();

        // Test HH:mm format (without seconds)
        $response = $this->actingAs($admin)->postJson('/api/polls', [
            'title' => 'Test Poll',
            'description' => 'Description here',
            'date' => '2026-03-20',
            'cutoff_day' => '2026-03-19',
            'cutoff_time' => '14:30', // HH:mm format - should pass
            'status' => 'draft',
            'options' => [
                ['text' => 'Option 1', 'time_slot' => '9:00 AM', 'capacity' => 10],
            ],
        ]);

        $response->assertStatus(201);
    }

    /** @test */
    public function poll_cutoff_time_also_accepts_seconds_format(): void
    {
        $admin = \App\Models\Admin::factory()->create();

        // Test HH:mm:ss format (with seconds) - should also pass
        $response = $this->actingAs($admin)->postJson('/api/polls', [
            'title' => 'Test Poll',
            'description' => 'Description here',
            'date' => '2026-03-20',
            'cutoff_day' => '2026-03-19',
            'cutoff_time' => '14:30:00', // HH:mm:ss - should pass
            'status' => 'draft',
            'options' => [
                ['text' => 'Option 1', 'time_slot' => '9:00 AM', 'capacity' => 10],
            ],
        ]);

        $response->assertStatus(201);
    }

    /** @test */
    public function poll_cutoff_time_rejects_invalid_format(): void
    {
        $admin = \App\Models\Admin::factory()->create();

        $response = $this->actingAs($admin)->postJson('/api/polls', [
            'title' => 'Test Poll',
            'description' => 'Description here',
            'date' => '2026-03-20',
            'cutoff_day' => '2026-03-19',
            'cutoff_time' => '25:00', // Invalid hour
            'status' => 'draft',
            'options' => [
                ['text' => 'Option 1', 'time_slot' => '9:00 AM', 'capacity' => 10],
            ],
        ]);

        $response->assertStatus(422)
            ->assertJsonValidationErrors(['cutoff_time']);
    }

    /** @test */
    public function poll_requires_at_least_one_option(): void
    {
        $admin = \App\Models\Admin::factory()->create();

        $response = $this->actingAs($admin)->postJson('/api/polls', [
            'title' => 'Test Poll',
            'description' => 'Description here',
            'date' => '2026-03-20',
            'cutoff_day' => '2026-03-19',
            'cutoff_time' => '14:00',
            'status' => 'draft',
            'options' => [], // Empty array
        ]);

        $response->assertStatus(422)
            ->assertJsonFragment([
            'message' => 'At least one option is required.'
        ]);
    }

    /** @test */
    public function poll_options_require_text_time_slot_and_capacity(): void
    {
        $admin = \App\Models\Admin::factory()->create();

        $response = $this->actingAs($admin)->postJson('/api/polls', [
            'title' => 'Test Poll',
            'description' => 'Description here',
            'date' => '2026-03-20',
            'cutoff_day' => '2026-03-19',
            'cutoff_time' => '14:00',
            'status' => 'draft',
            'options' => [
                ['text' => 'Option 1'], // Missing time_slot and capacity
            ],
        ]);

        $response->assertStatus(422)
            ->assertJsonValidationErrors(['options.0.time_slot', 'options.0.capacity']);
    }

    /** @test */
    public function poll_status_defaults_to_draft(): void
    {
        $admin = \App\Models\Admin::factory()->create();

        $response = $this->actingAs($admin)->postJson('/api/polls', [
            'title' => 'Test Poll',
            'description' => 'Description here',
            'date' => '2026-03-20',
            'cutoff_day' => '2026-03-19',
            'cutoff_time' => '14:00',
            // No status specified
            'options' => [
                ['text' => 'Option 1', 'time_slot' => '9:00 AM', 'capacity' => 10],
            ],
        ]);

        $response->assertStatus(201);
        $response->assertJson(['data' => ['status' => 'draft']]);
    }

    /** @test */
    public function option_reuse_if_text_matches(): void
    {
        $admin = \App\Models\Admin::factory()->create();
        $existingOption = \App\Models\Option::create(['text' => '9:00 AM']);

        // Create poll using same text as existing option
        $response = $this->actingAs($admin)->postJson('/api/polls', [
            'title' => 'Test Poll 1',
            'description' => 'Description here',
            'date' => '2026-03-20',
            'cutoff_day' => '2026-03-19',
            'cutoff_time' => '14:00',
            'status' => 'draft',
            'options' => [
                ['text' => '9:00 AM', 'time_slot' => '9:00-10:00 AM', 'capacity' => 10],
            ],
        ]);

        $response->assertStatus(201);

        // Verify that the existing option was reused, not duplicated
        $poll = Poll::latest()->first();
        $attachedOptionId = $poll->options->first()->option_id;
        $this->assertEquals($existingOption->option_id, $attachedOptionId);
    }

    /** @test */
    public function volunteer_cannot_vote_on_closed_poll(): void
    {
        $volunteer = \App\Models\User::factory()->create();
        $volunteer->volunteer()->create(\App\Models\Volunteer::factory()->make()->toArray());

        $poll = Poll::factory()->create(['status' => 'closed']);
        $option = \App\Models\Option::create(['text' => 'Test Option']);
        $poll->options()->attach($option->option_id, [
            'time_slot' => '9:00 AM',
            'capacity' => 10,
        ]);

        $response = $this->actingAs($volunteer)->postJson("/api/polls/{$poll->poll_id}/vote", [
            'option_id' => $option->option_id,
        ]);

        $response->assertStatus(422)
            ->assertJson(['message' => 'This poll is not accepting votes.']);
    }

    /** @test */
    public function volunteer_can_only_vote_once_per_poll(): void
    {
        $volunteer = \App\Models\User::factory()->create();
        $volunteer->volunteer()->create(\App\Models\Volunteer::factory()->make()->toArray());

        $poll = Poll::factory()->create(['status' => 'active']);
        $option = \App\Models\Option::create(['text' => 'Test Option']);
        $poll->options()->attach($option->option_id, [
            'time_slot' => '9:00 AM',
            'capacity' => 10,
        ]);

        // First vote
        $this->actingAs($volunteer)->postJson("/api/polls/{$poll->poll_id}/vote", [
            'option_id' => $option->option_id,
        ])->assertStatus(200);

        // Second vote - should fail
        $response = $this->actingAs($volunteer)->postJson("/api/polls/{$poll->poll_id}/vote", [
            'option_id' => $option->option_id,
        ]);

        $response->assertStatus(422)
            ->assertJson(['message' => 'You have already voted on this poll.']);
    }

    /** @test */
    public function vote_respects_option_capacity(): void
    {
        $volunteer1 = \App\Models\User::factory()->create();
        $volunteer1->volunteer()->create(\App\Models\Volunteer::factory()->make()->toArray());

        $volunteer2 = \App\Models\User::factory()->create();
        $volunteer2->volunteer()->create(\App\Models\Volunteer::factory()->make()->toArray());

        $poll = Poll::factory()->create(['status' => 'active']);
        $option = \App\Models\Option::create(['text' => 'Test Option']);
        $poll->options()->attach($option->option_id, [
            'time_slot' => '9:00 AM',
            'capacity' => 1, // Only 1 vote allowed
        ]);

        // First vote succeeds
        $this->actingAs($volunteer1)->postJson("/api/polls/{$poll->poll_id}/vote", [
            'option_id' => $option->option_id,
        ])->assertStatus(200);

        // Second vote should fail - capacity full
        $response = $this->actingAs($volunteer2)->postJson("/api/polls/{$poll->poll_id}/vote", [
            'option_id' => $option->option_id,
        ]);

        $response->assertStatus(422)
            ->assertJson(['message' => 'This time slot is already at full capacity.']);
    }
}
```

---

## 🎨 Frontend Component Tests

### AdminAuthPage Component Tests (Vitest)

**File:** `servetrack-frontend/src/app/auth/admin-auth-page/admin-auth-page.spec.ts`

```typescript
import { render, screen, fireEvent, waitFor } from '@testing-library/angular';
import { of, throwError } from 'rxjs';
import { AdminAuthPage } from './admin-auth-page';
import { AuthService } from '../../services/auth.service';
import { InputSanitizerService } from '../../services/input-sanitizer.service';
import { ReactiveFormsModule } from '@angular/forms';
import { Router } from '@angular/router';

describe('AdminAuthPage', () => {
  let authServiceSpy: jasmine.SpyObj<AuthService>;
  let sanitizerSpy: jasmine.SpyObj<InputSanitizerService>;
  let routerSpy: jasmine.SpyObj<Router>;

  beforeEach(async () => {
    authServiceSpy = jasmine.createSpyObj('AuthService', [
      'adminLogin$',
      'adminRegister$',
      'ensureCsrf$'
    ]);
    sanitizerSpy = jasmine.createSpyObj('InputSanitizerService', ['sanitizeInput']);
    routerSpy = jasmine.createSpyObj('Router', ['navigate', 'navigateByUrl']);

    authServiceSpy.adminLogin$.and.returnValue(of({ success: true, user: {} }));
    authServiceSpy.adminRegister$.and.returnValue(of({ success: true }));
    authServiceSpy.ensureCsrf$.and.returnValue(of(undefined));
    sanitizerSpy.sanitizeInput.and.callFake((input) => input);
  });

  it('should render login tab by default', async () => {
    await render(AdminAuthPage, {
      imports: [ReactiveFormsModule],
      providers: [
        { provide: AuthService, useValue: authServiceSpy },
        { provide: InputSanitizerService, useValue: sanitizerSpy },
        { provide: Router, useValue: routerSpy },
      ],
      componentProperties: {
        activeTab: 'login',
      },
    });

    expect(screen.getByLabelText(/email/i)).toBeTruthy();
    expect(screen.getByLabelText(/password/i)).toBeTruthy();
  });

  it('should switch to signup tab when URL has ?tab=signup', async () => {
    const mockActivatedRoute = {
      snapshot: { queryParamMap: { get: () => 'signup' } },
      queryParams: of({ tab: 'signup' })
    };

    await render(AdminAuthPage, {
      imports: [ReactiveFormsModule],
      providers: [
        { provide: AuthService, useValue: authServiceSpy },
        { provide: InputSanitizerService, useValue: sanitizerSpy },
        { provide: Router, useValue: routerSpy },
        { provide: ActivatedRoute, useValue: mockActivatedRoute },
      ],
    });

    await waitFor(() => {
      expect(screen.getByLabelText(/first name/i)).toBeTruthy();
    });
  });

  it('should call adminLogin$ on valid login submission', async () => {
    await render(AdminAuthPage, {
      imports: [ReactiveFormsModule],
      providers: [
        { provide: AuthService, useValue: authServiceSpy },
        { provide: InputSanitizerService, useValue: sanitizerSpy },
        { provide: Router, useValue: routerSpy },
      ],
    });

    fireEvent.input(screen.getByLabelText(/email/i), 'admin@nlcom.org');
    fireEvent.input(screen.getByLabelText(/password/i), 'Password123!');
    fireEvent.click(screen.getByRole('button', { name: /login/i }));

    expect(authServiceSpy.adminLogin$).toHaveBeenCalledWith({
      email: 'admin@nlcom.org',
      password: 'Password123!'
    });
  });

  it('should show error message on failed login', async () => {
    authServiceSpy.adminLogin$.and.returnValue(of({
      success: false,
      message: 'Invalid credentials'
    }));

    await render(AdminAuthPage, {
      imports: [ReactiveFormsModule],
      providers: [
        { provide: AuthService, useValue: authServiceSpy },
        { provide: InputSanitizerService, useValue: sanitizerSpy },
        { provide: Router, useValue: routerSpy },
      ],
    });

    fireEvent.input(screen.getByLabelText(/email/i), 'wrong@email.com');
    fireEvent.input(screen.getByLabelText(/password/i), 'WrongPass123!');
    fireEvent.click(screen.getByRole('button', { name: /login/i }));

    await waitFor(() => {
      expect(screen.getByText('Invalid credentials')).toBeTruthy();
    });
  });

  it('should navigate to admin-dashboard on successful login', async () => {
    await render(AdminAuthPage, {
      imports: [ReactiveFormsModule],
      providers: [
        { provide: AuthService, useValue: authServiceSpy },
        { provide: InputSanitizerService, useValue: sanitizerSpy },
        { provide: Router, useValue: routerSpy },
      ],
    });

    fireEvent.input(screen.getByLabelText(/email/i), 'admin@nlcom.org');
    fireEvent.input(screen.getByLabelText(/password/i), 'Password123!');
    fireEvent.click(screen.getByRole('button', { name: /login/i }));

    await waitFor(() => {
      expect(routerSpy.navigateByUrl).toHaveBeenCalledWith('/admin-dashboard');
    });
  });

  it('should show success modal with 5-second countdown on successful signup', async () => {
    await render(AdminAuthPage, {
      imports: [ReactiveFormsModule],
      providers: [
        { provide: AuthService, useValue: authServiceSpy },
        { provide: InputSanitizerService, useValue: sanitizerSpy },
        { provide: Router, useValue: routerSpy },
      ],
    });

    // Switch to signup tab
    const signupTab = screen.getByRole('button', { name: /signup/i });
    fireEvent.click(signupTab);

    // Fill form
    fireEvent.input(screen.getByLabelText(/first name/i), 'John');
    fireEvent.input(screen.getByLabelText(/last name/i), 'Doe');
    fireEvent.input(screen.getByLabelText(/email/i), 'admin@nlcom.org');
    fireEvent.input(screen.getByLabelText(/invite code/i), 'INVITE123456'); // 12 chars
    fireEvent.input(screen.getByLabelText(/password/i), 'Password123!');
    fireEvent.input(screen.getByLabelText(/confirm password/i), 'Password123!');
    fireEvent.click(screen.getByLabelText(/i agree to the terms of service/i));
    fireEvent.click(screen.getByRole('button', { name: /create admin account/i }));

    await waitFor(() => {
      expect(screen.getByText('Registration Successful!')).toBeTruthy();
      expect(screen.getByText('5')).toBeTruthy(); // Countdown starts at 5
    });
  });

  it('should support keyboard navigation with arrow keys', async () => {
    await render(AdminAuthPage, {
      imports: [ReactiveFormsModule],
      providers: [
        { provide: AuthService, useValue: authServiceSpy },
        { provide: InputSanitizerService, useValue: sanitizerSpy },
        { provide: Router, useValue: routerSpy },
      ],
    });

    // Simulate tab container with proper ARIA attributes
    const tablist = screen.getByRole('tablist');
    const loginTab = screen.getByRole('tab', { name: /login/i });

    // Press ArrowRight
    fireEvent.keyDown(loginTab, { key: 'ArrowRight' });

    await waitFor(() => {
      expect(screen.getByRole('tab', { name: /signup/i })).toHaveAttribute('aria-selected', 'true');
    });
  });

  it('should validate password strength requirements in real-time', async () => {
    await render(AdminAuthPage, {
      imports: [ReactiveFormsModule],
      providers: [
        { provide: AuthService, useValue: authServiceSpy },
        { provide: InputSanitizerService, useValue: sanitizerSpy },
        { provide: Router, useValue: routerSpy },
      ],
    });

    // Switch to signup
    fireEvent.click(screen.getByRole('button', { name: /signup/i }));

    const passwordInput = screen.getByLabelText(/password/i);
    fireEvent.input(passwordInput, 'weak');

    await waitFor(() => {
      expect(screen.getByText(/at least 12 characters/i)).toBeTruthy();
      expect(screen.getByText(/uppercase letter/i)).toBeTruthy();
    });
  });

  it('should make API call with sanitized inputs', async () => {
    await render(AdminAuthPage, {
      imports: [ReactiveFormsModule],
      providers: [
        { provide: AuthService, useValue: authServiceSpy },
        { provide: InputSanitizerService, useValue: sanitizerSpy },
        { provide: Router, useValue: routerSpy },
      ],
    });

    fireEvent.input(screen.getByLabelText(/email/i), '<script>alert("xss")</script>@test.com');
    fireEvent.input(screen.getByLabelText(/password/i), 'Password123!');
    fireEvent.click(screen.getByRole('button', { name: /login/i }));

    await waitFor(() => {
      expect(sanitizerSpy.sanitizeInput).toHaveBeenCalledWith(
        '<script>alert("xss")</script>@test.com',
        'text'
      );
    });
  });

  // --- Invite Code Tests ---

  it('should toggle invite code visibility', async () => {
    await render(AdminAuthPage, {
      imports: [ReactiveFormsModule],
      providers: [
        { provide: AuthService, useValue: authServiceSpy },
        { provide: InputSanitizerService, useValue: sanitizerSpy },
        { provide: Router, useValue: routerSpy },
      ],
    });

    // Switch to signup tab first
    fireEvent.click(screen.getByRole('button', { name: /signup/i }));

    const inviteCodeInput = screen.getByLabelText(/invite code/i);

    // Default is password type
    expect(inviteCodeInput.getAttribute('type')).toBe('password');

    // Click toggle button (eye icon)
    const toggleButton = screen.getByRole('button', { name: /show invite code/i });
    fireEvent.click(toggleButton);

    // Should now be text type
    expect(inviteCodeInput.getAttribute('type')).toBe('text');
  });

  it('should return "Invite code is required" when empty and touched', async () => {
    await render(AdminAuthPage, {
      imports: [ReactiveFormsModule],
      providers: [
        { provide: AuthService, useValue: authServiceSpy },
        { provide: InputSanitizerService, useValue: sanitizerSpy },
        { provide: Router, useValue: routerSpy },
      ],
    });

    // Switch to signup tab
    fireEvent.click(screen.getByRole('button', { name: /signup/i }));

    // Trigger validation by touching the field
    const inviteCodeInput = screen.getByLabelText(/invite code/i);
    fireEvent.blur(inviteCodeInput);

    await waitFor(() => {
      expect(screen.getByText('Invite code is required')).toBeTruthy();
    });
  });

  it('should return "Invite code is too short" when under 8 chars', async () => {
    await render(AdminAuthPage, {
      imports: [ReactiveFormsModule],
      providers: [
        { provide: AuthService, useValue: authServiceSpy },
        { provide: InputSanitizerService, useValue: sanitizerSpy },
        { provide: Router, useValue: routerSpy },
      ],
    });

    // Switch to signup tab
    fireEvent.click(screen.getByRole('button', { name: /signup/i }));

    // Enter short value
    const inviteCodeInput = screen.getByLabelText(/invite code/i);
    fireEvent.input(inviteCodeInput, 'short');
    fireEvent.blur(inviteCodeInput);

    await waitFor(() => {
      expect(screen.getByText('Invite code is too short')).toBeTruthy();
    });
  });

  it('should include inviteCode in API payload on signup', async () => {
    await render(AdminAuthPage, {
      imports: [ReactiveFormsModule],
      providers: [
        { provide: AuthService, useValue: authServiceSpy },
        { provide: InputSanitizerService, useValue: sanitizerSpy },
        { provide: Router, useValue: routerSpy },
      ],
    });

    // Switch to signup tab
    fireEvent.click(screen.getByRole('button', { name: /signup/i }));

    // Fill all required fields including invite code
    fireEvent.input(screen.getByLabelText(/first name/i), 'John');
    fireEvent.input(screen.getByLabelText(/last name/i), 'Doe');
    fireEvent.input(screen.getByLabelText(/email/i), 'admin@nlcom.org');
    fireEvent.input(screen.getByLabelText(/invite code/i), 'MyValidCode123!');
    fireEvent.input(screen.getByLabelText(/password/i), 'Password123!');
    fireEvent.input(screen.getByLabelText(/confirm password/i), 'Password123!');
    fireEvent.click(screen.getByLabelText(/i agree to the terms of service/i));

    // Submit
    fireEvent.click(screen.getByRole('button', { name: /create admin account/i }));

    // Verify inviteCode was in the API call
    await waitFor(() => {
      expect(authServiceSpy.adminRegister$).toHaveBeenCalledWith(
        expect.objectContaining({
          inviteCode: 'MyValidCode123!',
        })
      );
    });
  });
});
```

---

## 🔄 Integration Tests

### Full Poll Lifecycle Test

```php
<?php

namespace Tests\Feature;

use Tests\TestCase;
use Illuminate\Foundation\Testing\RefreshDatabase;

class PollIntegrationTest extends TestCase
{
    use RefreshDatabase;

    /** @test */
    public function full_poll_lifecycle(): void
    {
        // 1. ADMIN: Login
        $admin = \App\Models\Admin::factory()->create();
        $this->actingAs($admin);

        // 2. ADMIN: Create poll with options
        $pollData = [
            'title' => 'Volunteer Shift Preference',
            'description' => 'Please select your preferred shift time',
            'date' => '2026-03-25',
            'cutoff_day' => '2026-03-24', // Day before event
            'cutoff_time' => '23:59', // 11:59 PM
            'status' => 'active',
            'options' => [
                ['text' => 'Morning Shift', 'time_slot' => '8:00 AM - 12:00 PM', 'capacity' => 10],
                ['text' => 'Afternoon Shift', 'time_slot' => '1:00 PM - 5:00 PM', 'capacity' => 10],
                ['text' => 'Evening Shift', 'time_slot' => '6:00 PM - 10:00 PM', 'capacity' => 5],
            ],
        ];

        $createResponse = $this->postJson('/api/polls', $pollData);
        $createResponse->assertStatus(201);
        $pollId = $createResponse->json('data.poll_id');

        // 3. Verify poll is created with correct data
        $this->assertDatabaseHas('poll', [
            'title' => 'Volunteer Shift Preference',
            'date' => '2026-03-25',
            'status' => 'active',
        ]);

        $poll = \App\Models\Poll::with('options')->find($pollId);
        $this->assertCount(3, $poll->options);

        // 4. VOLUNTEER: Register and login
        $volunteerUser = \App\Models\User::factory()->create();
        $volunteer = $volunteerUser->volunteer()->create(\App\Models\Volunteer::factory()->make()->toArray());
        $this->actingAs($volunteerUser);

        // 5. VOLUNTEER: Vote on poll
        $voteOptionId = $poll->options->first()->option_id;
        $voteResponse = $this->postJson("/api/polls/{$pollId}/vote", [
            'option_id' => $voteOptionId,
        ]);
        $voteResponse->assertStatus(200)
            ->assertJson(['message' => 'Vote recorded successfully.']);

        // 6. Verify vote is recorded
        $this->assertDatabaseHas('poll_vote', [
            'volunteer_id' => $volunteer->volunteer_id,
            'poll_id' => $pollId,
            'option_id' => $voteOptionId,
        ]);

        // 7. VOLUNTEER: Cannot vote again
        $secondVote = $this->actingAs($volunteerUser)->postJson("/api/polls/{$pollId}/vote", [
            'option_id' => $voteOptionId,
        ]);
        $secondVote->assertStatus(422)
            ->assertJson(['message' => 'You have already voted on this poll.']);

        // 8. ADMIN: Check poll results
        $this->actingAs($admin);
        $pollResponse = $this->getJson("/api/polls/{$pollId}");
        $pollResponse->assertStatus(200);

        $pollData = $pollResponse->json('data');
        $this->assertArrayHasKey('options', $pollData);
        $this->assertEquals(1, $pollData['options'][0]['votes']);
    }

    /** @test */
    public function cutoff_date_validation_scenarios(): void
    {
        $admin = \App\Models\Admin::factory()->create();
        $this->actingAs($admin);

        $today = now()->format('Y-m-d');
        $tomorrow = now()->addDay()->format('Y-m-d');
        $yesterday = now()->subDay()->format('Y-m-d');

        // SCENARIO 1: Valid - cutoff day = event date
        $response1 = $this->postJson('/api/polls', [
            'title' => 'Today\'s Poll',
            'description' => 'Test',
            'date' => $today,
            'cutoff_day' => $today,
            'cutoff_time' => '14:00',
            'status' => 'draft',
            'options' => [
                ['text' => 'A', 'time_slot' => '9:00', 'capacity' => 10],
            ],
        ]);
        $response1->assertStatus(201);

        // SCENARIO 2: Valid - cutoff day < event date
        $response2 = $this->postJson('/api/polls', [
            'title' => 'Future Poll',
            'description' => 'Test',
            'date' => $tomorrow,
            'cutoff_day' => $today, // Today, before tomorrow's event
            'cutoff_time' => '14:00',
            'status' => 'draft',
            'options' => [
                ['text' => 'A', 'time_slot' => '9:00', 'capacity' => 10],
            ],
        ]);
        $response2->assertStatus(201);

        // SCENARIO 3: INVALID - cutoff day > event date
        $response3 = $this->postJson('/api/polls', [
            'title' => 'Invalid Poll',
            'description' => 'Test',
            'date' => $today,
            'cutoff_day' => $tomorrow, // After today's event
            'cutoff_time' => '14:00',
            'status' => 'draft',
            'options' => [
                ['text' => 'A', 'time_slot' => '9:00', 'capacity' => 10],
            ],
        ]);
        $response3->assertStatus(422)
            ->assertJsonFragment([
            'message' => 'Cut-off day must not be after the event date.'
        ]);
    }
}
```

---

## 📝 Manual Testing Checklist

### Admin Authentication Flow

- [ ] Navigate to `/admin-auth` - shows login tab by default
- [ ] Login with valid admin credentials - redirects to admin-dashboard
- [ ] Switch tabs with Arrow Left/Right keys (WCAG keyboard navigation)
- [ ] URL updates query param: `?tab=signup` when on signup tab
- [ ] Direct access to `/admin-auth?tab=signup` shows signup form automatically

**Invite Code Field:**
- [ ] Invite code field is present in signup form (masked by default)
- [ ] Eye toggle shows/hides invite code
- [ ] Empty invite code → Frontend shows: "Invite code is required"
- [ ] Short invite code (<8 chars) → Frontend shows: "Invite code is too short"
- [ ] Valid invite code → Frontend validation passes

**Backend Security Gate (all return generic "Registration failed..."):**
- [ ] Missing invite code → 422 with generic error
- [ ] Wrong invite code → 422 with generic error
- [ ] Short invite code → 422 with generic error
- [ ] Disallowed email domain → 422 with generic error
- [ ] Valid code + domain → 201 success

**Post-Signup:**
- [ ] Fill signup form with valid data + invite code - shows success modal
- [ ] Success modal displays 5-second countdown
- [ ] After countdown completes, automatically switches to login tab
- [ ] Closing modal cancels countdown
- [ ] Password strength meter updates in real-time
- [ ] Form validation prevents submission with empty required fields

### Poll System - Admin Dashboard

**Create Poll:**
- [ ] Event date accepts today or future dates only
- [ ] Event date rejects past dates (yesterday)
- [ ] Cutoff day ≤ event date enforced (yesterday's event with tomorrow cutoff ❌)
- [ ] Cutoff day = event date allowed ✓
- [ ] Cutoff time accepts format `HH:mm` (e.g., `14:30`) ✓
- [ ] Cutoff time also accepts `HH:mm:ss` (e.g., `14:30:00`) ✓
- [ ] Cutoff time rejects invalid hour (e.g., `25:00`) ❌
- [ ] At least one option required
- [ ] Each option requires text, time_slot, and capacity
- [ ] Capacity must be integer ≥ 1
- [ ] Status defaults to 'draft' if not specified
- [ ] Submit shows loading spinner
- [ ] Success shows snackbar notification

**Edit Poll:**
- [ ] Can update title, description, date, cutoff, status
- [ ] Validation still applies on update
- [ ] Options can be added/removed
- [ ] Options without votes are deleted when removed
- [ ] Options with existing votes are preserved (detached but not deleted)
- [ ] Existing option text reuse works (same text = same Option ID)

**View Results:**
- [ ] Poll list shows all polls (admin sees draft/active/closed)
- [ ] Poll detail shows vote counts per option
- [ ] Percentages calculated correctly
- [ ] Remaining capacity displayed correctly

### Poll System - Volunteer

**Voting:**
- [ ] Access poll via `/voting-poll?id={poll_id}`
- [ ] If poll not found, shows error message
- [ ] If poll is closed, shows "not accepting votes" error
- [ ] Options with capacity = 0 show as "full"
- [ ] Can select one option
- [ ] Submit shows loading state
- [ ] Success: vote recorded, percentages updated
- [ ] After voting, shows "already voted" on subsequent attempts
- [ ] Cannot vote for full capacity option

---

## 🌐 API Testing Collection

### Postman/Insomnia Environment

**Base URL:** `http://localhost:8000/api`

### 1. Admin Registration (POST)

```
POST /admin/register
Content-Type: application/json

{
  "firstName": "John",
  "lastName": "Doe",
  "email": "admin@nlcom.org",
  "contactNumber": "+639123456789",
  "inviteCode": "INVITE123456",
  "password": "Password123!",
  "confirmPassword": "Password123!"
}
```

**Expected Responses:**
- `201 Created` (or `200 OK` with success: true)
- `422 Unprocessable Entity` - validation errors (missing inviteCode, weak password, etc.)

### 2. Admin Login (POST)

```
POST /admin/login
Content-Type: application/json

{
  "email": "admin@nlcom.org",
  "password": "Password123!"
}
```

**Expected Responses:**
- `200 OK` - returns user object with token
- `401 Unauthorized` - invalid credentials
- `429 Too Many Requests` - rate limit exceeded

### 3. Create Poll (POST) - Admin Only

```
POST /polls
Authorization: Bearer {admin_token}
Content-Type: application/json

{
  "title": "Team Building Activity",
  "description": "Choose your preferred team building activity",
  "date": "2026-03-25",
  "cutoff_day": "2026-03-24",
  "cutoff_time": "14:30",
  "status": "active",
  "options": [
    {
      "text": "Hiking Trip",
      "time_slot": "Morning (6:00 AM - 12:00 PM)",
      "capacity": 15
    },
    {
      "text": "Beach Cleanup",
      "time_slot": "Afternoon (1:00 PM - 5:00 PM)",
      "capacity": 20
    },
    {
      "text": "Community Service",
      "time_slot": "Evening (6:00 PM - 9:00 PM)",
      "capacity": 10
    }
  ]
}
```

**Expected Responses:**
- `201 Created` - poll created with options
- `422 Unprocessable Entity` - validation errors (cutoff after date, missing options, etc.)
- `403 Forbidden` - non-admin user

### 4. Get Poll by ID (GET)

```
GET /polls/{id}
Authorization: Bearer {token}  # Optional for volunteers
```

**Expected Responses:**
- `200 OK` - poll with options and vote counts
- `404 Not Found` - poll doesn't exist
- `403 Forbidden` - volunteer trying to access inactive poll (if status=closed)

### 5. List Polls (GET)

```
GET /polls
Authorization: Bearer {token}  # Optional
```

**Expected Responses:**
- `200 OK` - array of polls
  - Admin: sees all polls (draft, active, closed)
  - Volunteer: only sees active polls

### 6. Vote on Poll (POST)

```
POST /polls/{id}/vote
Authorization: Bearer {volunteer_token}
Content-Type: application/json

{
  "option_id": 1
}
```

**Expected Responses:**
- `200 OK` - vote recorded successfully
- `422 Unprocessable Entity` -
  - "This poll is not accepting votes." (closed poll)
  - "Volunteer profile not found." (user has no volunteer record)
  - "You have already voted on this poll."
  - "This time slot is already at full capacity."
  - "Invalid option for this poll."

### 7. Update Poll (PUT)

```
PUT /polls/{id}
Authorization: Bearer {admin_token}
Content-Type: application/json

{
  "title": "Updated Title",
  "status": "active",
  "options": [
    {
      "text": "New Option",
      "time_slot": "10:00 AM",
      "capacity": 25
    }
  ]
}
```

### 8. Delete Poll (DELETE)

```
DELETE /polls/{id}
Authorization: Bearer {admin_token}
```

**Expected Responses:**
- `200 OK` - poll deleted
- `404 Not Found` - poll doesn't exist

### 9. Update Poll Status (PATCH)

```
PATCH /polls/{id}/status
Authorization: Bearer {admin_token}
Content-Type: application/json

{
  "status": "active"  // or "draft", "closed"
}
```

---

## 🚀 Quick Start Commands

### Backend

```bash
# Navigate to backend
cd servetrack-backend

# Install dependencies (first time)
composer install

# Start Laravel server
php artisan serve

# Or use concurrent dev mode (server + queue + Vite)
composer run dev

# Run all tests
php artisan test

# Run specific test file
php artisan test --filter=AdminAuthTest

# Run single test
php artisan test --filter=test_admin_can_login_with_valid_credentials

# Run with verbose output
php artisan test --verbose --filter=PollValidationTest

# Run with coverage report
php artisan test --coverage

# Format code
./vendor/bin/pint

# Format only dirty files
./vendor/bin/pint --dirty

# Database
php artisan migrate
php artisan migrate:fresh --seed
```

### Frontend

```bash
# Navigate to frontend
cd servetrack-frontend

# Install dependencies (first time)
npm install

# Start development server
npm start

# Run all tests
npm test

# Run specific test file
npm test -- admin-auth-page.spec.ts

# Run tests matching pattern
npm test -- -t "should render login tab"

# Run tests once (no watch mode)
npm test -- --run

# Run with coverage
npm test -- --coverage

# Run with verbose reporter
npm test -- --reporter=verbose

# Build for production
npm run build

# Watch mode (rebuild on changes)
npm run watch
```

### From Root

```bash
# Install all dependencies
npm install

# Run backend linting
npm run lint:backend

# Test pre-commit hooks
npm run test-hook
```

---

## 📊 Test Coverage Areas

### What's Covered

✅ **Authentication**
- Admin login/logout
- Admin registration with invite code
- Email domain validation
- Role-based access control
- Token-based authentication

✅ **Poll Management**
- Create/Read/Update/Delete operations
- Date/time validation (cutoff ≤ event date)
- Status transitions (draft → active → closed)
- Option reuse optimization
- Soft delete handling

✅ **Voting System**
- One vote per volunteer per poll
- Capacity enforcement per option
- Closed poll rejection
- Vote counting and percentage calculation

✅ **Frontend Components**
- Tab switching (login ↔ signup)
- Form validation with real-time feedback
- Loading states and error handling
- Keyboard navigation (WCAG)
- Modal behavior (countdown timer)
- API integration with error recovery

✅ **Security**
- Authentication middleware
- Role-based authorization
- Rate limiting
- CSRF protection
- Input sanitization
- SQL injection prevention (Eloquent ORM)

---

## 🔍 Edge Cases to Test

### Poll Cutoff Date Edge Cases

```php
// Test 1: Same day cutoff (today's event, cutoff today)
date: '2026-03-15', cutoff: '2026-03-15' ✓ Valid

// Test 2: Early cutoff (future event, cutoff today)
date: '2026-03-20', cutoff: '2026-03-15' ✓ Valid

// Test 3: Invalid - past cutoff
date: '2026-03-15', cutoff: '2026-03-14' ✗ Invalid

// Test 4: Invalid - cutoff after event
date: '2026-03-15', cutoff: '2026-03-16' ✗ Invalid
```

### Time Format Edge Cases

```php
// All valid formats
'00:00'     ✓
'23:59'     ✓
'14:30'     ✓ (preferred format)
'14:30:00'  ✓ (with seconds)
'9:00 AM'   ✗ (12h format not supported - backend expects 24h)

// Invalid formats
'24:00'     ✗ (hour out of range)
'00:60'     ✗ (minute out of range)
'14:30:60'  ✗ (seconds out of range)
'abc'       ✗ (not a time)
```

### Vote Edge Cases

```php
// Test: Volunteer without profile
$user = User::factory()->create(); // No volunteer record
-> vote() -> 403 "Volunteer profile not found"

// Test: Capacity = 0
capacity: 0 -> vote() -> 422 "full capacity"

// Test: Simultaneous votes (concurrency)
// Use two requests at same time for same option with capacity=1
// One should succeed, one should fail with capacity error
```

---

## 🐛 Common Issues & Solutions

### Issue 1: "Token not provided" error

**Solution:** Ensure CSRF cookie is fetched first
```typescript
// In AuthService
this.ensureCsrf$()  // Must be called before login
  .pipe(
    switchMap(() => this.http.post('/login', credentials))
  )
```

### Issue 2: Poll not showing after creation

**Check:**
- Poll status is `active` (not `draft`)
- Poll date is in the future or today
- You're logged in as admin (admin sees all statuses)
- `PollResource` is correctly transforming data

### Issue 3: Admin auth redirect loop

**Cause:** Old routes still in browser history
**Fix:** Clear browser cache and test `/admin-auth` directly

### Issue 4: Cutoff date validation not working

**Check backend validation rules:**
```php
// StorePollRequest.php line 28
'cutoff_day' => ['required', 'date', 'before_or_equal:date'],
```

**Check frontend validators:**
```typescript
// In admin-dashboard form
Validators.compose([
  Validators.required,
  (control) => {
    const cutoff = new Date(control.value);
    const eventDate = new Date(this.pollForm.get('date')?.value);
    return cutoff <= eventDate ? null : { afterEvent: true };
  }
])
```

### Issue 5: Invite code registration fails with generic error

**Cause:** Either:
1. Invite code doesn't match `ADMIN_INVITE_CODE` in `.env`
2. Email domain not in `ADMIN_ALLOWED_DOMAINS` in `.env`

**Check backend config:**
```bash
# In .env file
ADMIN_INVITE_CODE=ChangeMe123!
ADMIN_ALLOWED_DOMAINS=example.com, nlcom.org
```

**Note:** Backend returns generic "Registration failed. Please contact your administrator." for ALL security gate failures. Frontend shows specific validation errors.

---

## 📈 Test Execution Priority

**For Current Branch (`feat/poll/api`):**

### Invite Code Feature Tests

1. **Run frontend admin-auth-page tests:**
```bash
cd servetrack-frontend
npm test -- admin-auth-page.spec.ts
```
- 137 tests total (includes 5 new invite code tests)

2. **Run backend AdminRegistrationTest:**
```bash
cd servetrack-backend
php artisan test --filter=AdminRegistrationTest
```
- 11 tests for security gate (requires MySQL)

### Other Feature Tests

3. **Run backend poll tests:**
```bash
cd servetrack-backend
php artisan test --filter=PollValidationTest
```

4. **Run frontend voting poll tests:**
```bash
cd servetrack-frontend
npm test -- voting-poll.spec.ts
```

5. **Run integration test:**
```bash
cd servetrack-backend
php artisan test --filter=PollIntegrationTest
```

### Full Test Suite

6. **Run all tests:**
```bash
# Frontend
cd servetrack-frontend
npm test

# Backend (requires MySQL)
cd servetrack-backend
php artisan test
```

7. **Manual smoke test:**
   - Start backend: `composer run dev`
   - Start frontend: `npm start`
   - Test admin registration with invite code
   - Test admin login → create poll → logout → volunteer login → vote

---

## ✅ Pre-Merge Checklist

Before merging `feat/poll/api` to `main`:

- [ ] All Pest tests pass (`php artisan test`)
- [ ] All Vitest tests pass (`npm test`)
- [ ] Code formatted with Laravel Pint (`./vendor/bin/pint`)
- [ ] Frontend lint passes (`npm run lint`)
- [ ] Manual smoke test completed
- [ ] No failing GitHub Actions checks
- [ ] Database migrations are idempotent
- [ ] API responses documented (especially new poll fields)
- [ ] Front-end and back-end validation rules match exactly
- [ ] Soft deletes tested (restore functionality)
- [ ] Audit logging verified for poll create/update/delete

---

## 📚 Related Documentation

- [Product Requirements Document (PRD.md)](PRD.md)
- [Security Remediation Plan](SECURITY_REMEDIATION_PLAN.md)
- [Development Guidelines](AGENTS.md)
- [Backend API Routes](servetrack-backend/routes/api.php)
- [PollController Implementation](servetrack-backend/app/Http/Controllers/PollController.php)
- [AdminAuthPage Component](servetrack-frontend/src/app/auth/admin-auth-page/admin-auth-page.ts)

---

**Generated:** 2026-03-15
**Branch:** feat/poll/api
**Status:** Ready for testing
**Maintainer:** PUPT Quantum Leap Team
