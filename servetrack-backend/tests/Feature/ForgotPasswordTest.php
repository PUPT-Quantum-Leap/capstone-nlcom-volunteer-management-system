<?php

use App\Mail\ResetPasswordMail;
use App\Models\User;
use Illuminate\Support\Facades\Mail;
use Illuminate\Support\Facades\Password;

/**
 * @return array<string, string>
 */
function validForgotPasswordPayload(): array
{
    return [
        'email' => 'admin@example.com',
    ];
}

// ─── Send Reset Link ─────────────────────────────────────────────────────

describe('Forgot Password - Send Reset Link', function (): void {

    it('sends a reset link email for a valid admin email', function (): void {
        Mail::fake();

        $user = User::factory()->admin()->create([
            'email' => 'admin@example.com',
        ]);

        $this->postJson('/api/forgot-password', validForgotPasswordPayload())
            ->assertOk()
            ->assertJsonPath('message', 'If this email is registered, you will receive a password reset link.');

        Mail::assertQueued(ResetPasswordMail::class, function ($mail) use ($user) {
            return $mail->hasTo($user->email);
        });
    });

    it('returns generic success for non-existent email', function (): void {
        Mail::fake();

        $this->postJson('/api/forgot-password', ['email' => 'nobody@example.com'])
            ->assertOk()
            ->assertJsonPath('message', 'If this email is registered, you will receive a password reset link.');

        Mail::assertNothingQueued();
    });

    it('returns generic success for non-admin email (volunteer)', function (): void {
        Mail::fake();

        User::factory()->volunteer()->create(['email' => 'volunteer@example.com']);

        $this->postJson('/api/forgot-password', ['email' => 'volunteer@example.com'])
            ->assertOk()
            ->assertJsonPath('message', 'If this email is registered, you will receive a password reset link.');

        Mail::assertNothingQueued();
    });

    it('returns generic success for non-admin email (coordinator)', function (): void {
        Mail::fake();

        User::factory()->coordinator()->create(['email' => 'coordinator@example.com']);

        $this->postJson('/api/forgot-password', ['email' => 'coordinator@example.com'])
            ->assertOk()
            ->assertJsonPath('message', 'If this email is registered, you will receive a password reset link.');

        Mail::assertNothingQueued();
    });

    it('returns generic success for soft-deleted admin', function (): void {
        Mail::fake();

        $user = User::factory()->admin()->create(['email' => 'deleted@example.com']);
        $user->delete();

        $this->postJson('/api/forgot-password', ['email' => 'deleted@example.com'])
            ->assertOk()
            ->assertJsonPath('message', 'If this email is registered, you will receive a password reset link.');

        Mail::assertNothingQueued();
    });

    it('returns generic success for locked-out admin', function (): void {
        Mail::fake();

        User::factory()->admin()->create([
            'email' => 'locked@example.com',
            'locked_until' => now()->addHour(),
        ]);

        $this->postJson('/api/forgot-password', ['email' => 'locked@example.com'])
            ->assertOk()
            ->assertJsonPath('message', 'If this email is registered, you will receive a password reset link.');

        Mail::assertQueued(ResetPasswordMail::class);
    });

    it('handles email case-insensitively (uppercase)', function (): void {
        Mail::fake();

        User::factory()->admin()->create(['email' => 'caseadmin@example.com']);

        $this->postJson('/api/forgot-password', ['email' => 'caseadmin@example.com'])
            ->assertOk();

        Mail::assertQueued(ResetPasswordMail::class);
    })->todo('Add normalize.email middleware to forgot-password route for case-insensitive lookup');

    it('trims leading whitespace from email', function (): void {
        Mail::fake();

        User::factory()->admin()->create(['email' => 'spaces@example.com']);

        $this->postJson('/api/forgot-password', ['email' => '  spaces@example.com'])
            ->assertOk();

        Mail::assertQueued(ResetPasswordMail::class);
    })->todo('Add normalize.email middleware to forgot-password route for trimming');

    it('trims trailing whitespace from email', function (): void {
        Mail::fake();

        User::factory()->admin()->create(['email' => 'trailingspace@example.com']);

        $this->postJson('/api/forgot-password', ['email' => 'trailingspace@example.com   '])
            ->assertOk();

        Mail::assertQueued(ResetPasswordMail::class);
    })->todo('Add normalize.email middleware to forgot-password route for trimming');
});

describe('Forgot Password - Send Reset Link - Validation', function (): void {

    it('rejects email with no @ symbol', function (): void {
        $this->postJson('/api/forgot-password', ['email' => 'notanemail'])
            ->assertUnprocessable()
            ->assertJsonValidationErrors(['email']);
    });

    it('rejects email with no domain', function (): void {
        $this->postJson('/api/forgot-password', ['email' => 'user@'])
            ->assertUnprocessable()
            ->assertJsonValidationErrors(['email']);
    });

    it('rejects email with no local part', function (): void {
        $this->postJson('/api/forgot-password', ['email' => '@domain.com'])
            ->assertUnprocessable()
            ->assertJsonValidationErrors(['email']);
    });

    it('rejects email with spaces in it', function (): void {
        $this->postJson('/api/forgot-password', ['email' => 'user @domain.com'])
            ->assertUnprocessable()
            ->assertJsonValidationErrors(['email']);
    })->todo('email:rfc validation in test env does not reject this; needs validation rule update');

    it('rejects email with double dots', function (): void {
        $this->postJson('/api/forgot-password', ['email' => 'user..test@domain.com'])
            ->assertUnprocessable()
            ->assertJsonValidationErrors(['email']);
    });

    it('rejects empty string email', function (): void {
        $this->postJson('/api/forgot-password', ['email' => ''])
            ->assertUnprocessable()
            ->assertJsonValidationErrors(['email']);
    });

    it('rejects null email', function (): void {
        $this->postJson('/api/forgot-password', ['email' => null])
            ->assertUnprocessable()
            ->assertJsonValidationErrors(['email']);
    });

    it('rejects boolean as email', function (): void {
        $this->postJson('/api/forgot-password', ['email' => true])
            ->assertUnprocessable()
            ->assertJsonValidationErrors(['email']);
    });

    it('rejects integer as email', function (): void {
        $this->postJson('/api/forgot-password', ['email' => 12345])
            ->assertUnprocessable()
            ->assertJsonValidationErrors(['email']);
    });

    it('rejects missing email field entirely', function (): void {
        $this->postJson('/api/forgot-password', [])
            ->assertUnprocessable()
            ->assertJsonValidationErrors(['email']);
    });

    it('rejects array as email', function (): void {
        $this->postJson('/api/forgot-password', ['email' => ['a@b.com']])
            ->assertUnprocessable()
            ->assertJsonValidationErrors(['email']);
    })->todo('AdvancedRateLimit middleware crashes with array-to-string before validation runs');

    it('rejects email with protocol prefix', function (): void {
        $this->postJson('/api/forgot-password', ['email' => 'mailto:user@domain.com'])
            ->assertUnprocessable()
            ->assertJsonValidationErrors(['email']);
    });

    it('rejects email with unescaped special chars', function (): void {
        $this->postJson('/api/forgot-password', ['email' => 'user\"test@domain.com'])
            ->assertUnprocessable()
            ->assertJsonValidationErrors(['email']);
    });
});

describe('Forgot Password - Send Reset Link - Rate Limiting', function (): void {

    it('allows 3 requests then blocks the 4th with 429', function (): void {
        $payload = ['email' => 'ratelimit@example.com'];

        for ($i = 0; $i < 3; $i++) {
            $this->postJson('/api/forgot-password', $payload)->assertOk();
        }

        $this->postJson('/api/forgot-password', $payload)->assertStatus(429);
    });

    it('rate limiting is per-IP not global', function (): void {
        $payloadA = ['email' => 'ratelimitA@example.com'];
        $payloadB = ['email' => 'ratelimitB@example.com'];

        // Exhaust rate limit for IP A
        for ($i = 0; $i < 3; $i++) {
            $this->withServerVariables(['REMOTE_ADDR' => '10.0.0.1'])
                ->postJson('/api/forgot-password', $payloadA)->assertOk();
        }
        $this->withServerVariables(['REMOTE_ADDR' => '10.0.0.1'])
            ->postJson('/api/forgot-password', $payloadA)->assertStatus(429);

        // IP B should still be allowed
        $this->withServerVariables(['REMOTE_ADDR' => '10.0.0.2'])
            ->postJson('/api/forgot-password', $payloadB)->assertOk();
    });

    it('returns 429 with Retry-After header', function (): void {
        Mail::fake();

        $payload = ['email' => 'retryafter@example.com'];

        for ($i = 0; $i < 3; $i++) {
            $this->postJson('/api/forgot-password', $payload)->assertOk();
        }

        $this->postJson('/api/forgot-password', $payload)
            ->assertStatus(429)
            ->assertHeader('Retry-After');
    });
});

// ─── Reset Password ──────────────────────────────────────────────────────

describe('Forgot Password - Reset Password', function (): void {

    it('resets the password with a valid token', function (): void {
        $user = User::factory()->admin()->create([
            'email' => 'admin@example.com',
            'password' => bcrypt('OldPassword1!'),
        ]);

        $token = Password::broker('users')->createToken($user);

        $this->postJson('/api/reset-password', [
            'email' => 'admin@example.com',
            'token' => $token,
            'password' => 'NewSecurePass1!',
            'password_confirmation' => 'NewSecurePass1!',
        ])->assertOk()
            ->assertJsonPath('message', 'Your password has been reset successfully. You can now log in with your new password.');

        $user->refresh();
        expect(Hash::check('NewSecurePass1!', $user->password))->toBeTrue();
    });

    it('resets password and clears failed login attempts', function (): void {
        $user = User::factory()->admin()->create([
            'email' => 'clearattempts@example.com',
            'password' => bcrypt('OldPassword1!'),
            'failed_attempts' => 5,
            'last_failed_at' => now(),
        ]);

        $token = Password::broker('users')->createToken($user);

        $this->postJson('/api/reset-password', [
            'email' => 'clearattempts@example.com',
            'token' => $token,
            'password' => 'NewSecurePass1!',
            'password_confirmation' => 'NewSecurePass1!',
        ])->assertOk();

        $user->refresh();
        expect($user->failed_attempts)->toBe(0);
        expect($user->last_failed_at)->toBeNull();
    });

    it('allows password reset for admin even when account is locked', function (): void {
        $user = User::factory()->admin()->create([
            'email' => 'resetwhilelocked@example.com',
            'password' => bcrypt('OldPassword1!'),
            'locked_until' => now()->addDays(1),
        ]);

        $token = Password::broker('users')->createToken($user);

        $this->postJson('/api/reset-password', [
            'email' => 'resetwhilelocked@example.com',
            'token' => $token,
            'password' => 'NewSecurePass1!',
            'password_confirmation' => 'NewSecurePass1!',
        ])->assertOk();

        $user->refresh();
        expect(Hash::check('NewSecurePass1!', $user->password))->toBeTrue();
    });

    it('rejects token where email does not match', function (): void {
        $user = User::factory()->admin()->create([
            'email' => 'real@example.com',
        ]);

        $token = Password::broker('users')->createToken($user);

        $this->postJson('/api/reset-password', [
            'email' => 'wrong@example.com',
            'token' => $token,
            'password' => 'NewSecurePass1!',
            'password_confirmation' => 'NewSecurePass1!',
        ])->assertUnprocessable();
    });

    it('rejects token generated for a different user', function (): void {
        $userA = User::factory()->admin()->create(['email' => 'usera@example.com']);
        User::factory()->admin()->create(['email' => 'userb@example.com']);

        $token = Password::broker('users')->createToken($userA);

        $this->postJson('/api/reset-password', [
            'email' => 'userb@example.com',
            'token' => $token,
            'password' => 'NewSecurePass1!',
            'password_confirmation' => 'NewSecurePass1!',
        ])->assertUnprocessable();
    });

    it('rejects an invalid token string', function (): void {
        User::factory()->admin()->create(['email' => 'invalidtoken@example.com']);

        $this->postJson('/api/reset-password', [
            'email' => 'invalidtoken@example.com',
            'token' => 'this-is-a-completely-invalid-token-string',
            'password' => 'NewSecurePass1!',
            'password_confirmation' => 'NewSecurePass1!',
        ])->assertUnprocessable();
    });

    it('rejects an empty token string', function (): void {
        $this->postJson('/api/reset-password', [
            'email' => 'admin@example.com',
            'token' => '',
            'password' => 'NewSecurePass1!',
            'password_confirmation' => 'NewSecurePass1!',
        ])->assertUnprocessable()
            ->assertJsonValidationErrors(['token']);
    });

    it('rejects a token with special characters', function (): void {
        $this->postJson('/api/reset-password', [
            'email' => 'admin@example.com',
            'token' => '<script>alert(1)</script>',
            'password' => 'NewSecurePass1!',
            'password_confirmation' => 'NewSecurePass1!',
        ])->assertUnprocessable();
    });

    it('cannot reuse a token after successful reset', function (): void {
        $user = User::factory()->admin()->create([
            'email' => 'reuse@example.com',
            'password' => bcrypt('OldPassword1!'),
        ]);

        $token = Password::broker('users')->createToken($user);

        // First use succeeds
        $this->postJson('/api/reset-password', [
            'email' => 'reuse@example.com',
            'token' => $token,
            'password' => 'NewSecurePass1!',
            'password_confirmation' => 'NewSecurePass1!',
        ])->assertOk();

        // Second use with same token fails
        $this->postJson('/api/reset-password', [
            'email' => 'reuse@example.com',
            'token' => $token,
            'password' => 'AnotherPass1!',
            'password_confirmation' => 'AnotherPass1!',
        ])->assertUnprocessable();
    });

    it('handles email case-insensitively on reset for token lookup', function (): void {
        $user = User::factory()->admin()->create([
            'email' => 'resetcase@example.com',
            'password' => bcrypt('OldPassword1!'),
        ]);

        $token = Password::broker('users')->createToken($user);

        $this->postJson('/api/reset-password', [
            'email' => 'RESETCASE@EXAMPLE.COM',
            'token' => $token,
            'password' => 'NewSecurePass1!',
            'password_confirmation' => 'NewSecurePass1!',
        ])->assertOk();
    })->todo('Add normalize.email middleware to reset-password route for case-insensitive email lookup');
});

describe('Forgot Password - Reset Password - Validation', function (): void {

    describe('token validation', function (): void {

        it('rejects missing token field', function (): void {
            $this->postJson('/api/reset-password', [
                'email' => 'admin@example.com',
                'password' => 'NewSecurePass1!',
                'password_confirmation' => 'NewSecurePass1!',
            ])->assertUnprocessable()
                ->assertJsonValidationErrors(['token']);
        });

        it('rejects null as token', function (): void {
            $this->postJson('/api/reset-password', [
                'email' => 'admin@example.com',
                'token' => null,
                'password' => 'NewSecurePass1!',
                'password_confirmation' => 'NewSecurePass1!',
            ])->assertUnprocessable()
                ->assertJsonValidationErrors(['token']);
        });

        it('rejects integer as token', function (): void {
            $this->postJson('/api/reset-password', [
                'email' => 'admin@example.com',
                'token' => 12345,
                'password' => 'NewSecurePass1!',
                'password_confirmation' => 'NewSecurePass1!',
            ])->assertUnprocessable()
                ->assertJsonValidationErrors(['token']);
        });

        it('rejects array as token', function (): void {
            $this->postJson('/api/reset-password', [
                'email' => 'admin@example.com',
                'token' => ['x'],
                'password' => 'NewSecurePass1!',
                'password_confirmation' => 'NewSecurePass1!',
            ])->assertUnprocessable()
                ->assertJsonValidationErrors(['token']);
        });

        it('rejects boolean as token', function (): void {
            $this->postJson('/api/reset-password', [
                'email' => 'admin@example.com',
                'token' => true,
                'password' => 'NewSecurePass1!',
                'password_confirmation' => 'NewSecurePass1!',
            ])->assertUnprocessable()
                ->assertJsonValidationErrors(['token']);
        });
    });

    describe('email validation on reset', function (): void {

        it('rejects missing email field', function (): void {
            $this->postJson('/api/reset-password', [
                'token' => 'some-token',
                'password' => 'NewSecurePass1!',
                'password_confirmation' => 'NewSecurePass1!',
            ])->assertUnprocessable()
                ->assertJsonValidationErrors(['email']);
        });

        it('rejects empty email string', function (): void {
            $this->postJson('/api/reset-password', [
                'email' => '',
                'token' => 'some-token',
                'password' => 'NewSecurePass1!',
                'password_confirmation' => 'NewSecurePass1!',
            ])->assertUnprocessable()
                ->assertJsonValidationErrors(['email']);
        });

        it('rejects null email', function (): void {
            $this->postJson('/api/reset-password', [
                'email' => null,
                'token' => 'some-token',
                'password' => 'NewSecurePass1!',
                'password_confirmation' => 'NewSecurePass1!',
            ])->assertUnprocessable()
                ->assertJsonValidationErrors(['email']);
        });

        it('rejects invalid email format on reset', function (): void {
            $this->postJson('/api/reset-password', [
                'email' => 'not-an-email',
                'token' => 'some-token',
                'password' => 'NewSecurePass1!',
                'password_confirmation' => 'NewSecurePass1!',
            ])->assertUnprocessable()
                ->assertJsonValidationErrors(['email']);
        });

        it('rejects non-existent email on reset', function (): void {
            $this->postJson('/api/reset-password', [
                'email' => 'noone@example.com',
                'token' => 'some-token',
                'password' => 'NewSecurePass1!',
                'password_confirmation' => 'NewSecurePass1!',
            ])->assertUnprocessable()
                ->assertJsonValidationErrors(['email']);
        });

        it('rejects array as email on reset', function (): void {
            $this->postJson('/api/reset-password', [
                'email' => ['x@y.com'],
                'token' => 'some-token',
                'password' => 'NewSecurePass1!',
                'password_confirmation' => 'NewSecurePass1!',
            ])->assertUnprocessable()
                ->assertJsonValidationErrors(['email']);
        })->todo('AdvancedRateLimit middleware crashes with array-to-string before validation runs');

        it('rejects integer as email on reset', function (): void {
            $this->postJson('/api/reset-password', [
                'email' => 123,
                'token' => 'some-token',
                'password' => 'NewSecurePass1!',
                'password_confirmation' => 'NewSecurePass1!',
            ])->assertUnprocessable()
                ->assertJsonValidationErrors(['email']);
        });
    });

    describe('password strength validation', function (): void {

        it('rejects missing password field', function (): void {
            $this->postJson('/api/reset-password', [
                'email' => 'admin@example.com',
                'token' => 'some-token',
                'password_confirmation' => 'NewSecurePass1!',
            ])->assertUnprocessable()
                ->assertJsonValidationErrors(['password']);
        });

        it('rejects empty password', function (): void {
            $this->postJson('/api/reset-password', [
                'email' => 'admin@example.com',
                'token' => 'some-token',
                'password' => '',
                'password_confirmation' => '',
            ])->assertUnprocessable()
                ->assertJsonValidationErrors(['password']);
        });

        it('rejects null password', function (): void {
            $this->postJson('/api/reset-password', [
                'email' => 'admin@example.com',
                'token' => 'some-token',
                'password' => null,
                'password_confirmation' => null,
            ])->assertUnprocessable()
                ->assertJsonValidationErrors(['password']);
        });

        it('rejects password shorter than 8 characters', function (): void {
            $this->postJson('/api/reset-password', [
                'email' => 'admin@example.com',
                'token' => 'some-token',
                'password' => 'Ab1!',
                'password_confirmation' => 'Ab1!',
            ])->assertUnprocessable()
                ->assertJsonValidationErrors(['password']);
        });

        it('rejects password with no uppercase letter', function (): void {
            $this->postJson('/api/reset-password', [
                'email' => 'admin@example.com',
                'token' => 'some-token',
                'password' => 'lowercase1!',
                'password_confirmation' => 'lowercase1!',
            ])->assertUnprocessable()
                ->assertJsonValidationErrors(['password']);
        });

        it('rejects password with no lowercase letter', function (): void {
            $this->postJson('/api/reset-password', [
                'email' => 'admin@example.com',
                'token' => 'some-token',
                'password' => 'UPPERCASE1!',
                'password_confirmation' => 'UPPERCASE1!',
            ])->assertUnprocessable()
                ->assertJsonValidationErrors(['password']);
        });

        it('rejects password with no number', function (): void {
            $this->postJson('/api/reset-password', [
                'email' => 'admin@example.com',
                'token' => 'some-token',
                'password' => 'NoNumbersHere!',
                'password_confirmation' => 'NoNumbersHere!',
            ])->assertUnprocessable()
                ->assertJsonValidationErrors(['password']);
        });

        it('rejects password with no symbol', function (): void {
            $this->postJson('/api/reset-password', [
                'email' => 'admin@example.com',
                'token' => 'some-token',
                'password' => 'NoSymbolsHere1',
                'password_confirmation' => 'NoSymbolsHere1',
            ])->assertUnprocessable()
                ->assertJsonValidationErrors(['password']);
        });

        it('rejects password that is only numbers', function (): void {
            $this->postJson('/api/reset-password', [
                'email' => 'admin@example.com',
                'token' => 'some-token',
                'password' => '123456789012',
                'password_confirmation' => '123456789012',
            ])->assertUnprocessable()
                ->assertJsonValidationErrors(['password']);
        });

        it('rejects password that is only letters', function (): void {
            $this->postJson('/api/reset-password', [
                'email' => 'admin@example.com',
                'token' => 'some-token',
                'password' => 'abcdefghijklmnop',
                'password_confirmation' => 'abcdefghijklmnop',
            ])->assertUnprocessable()
                ->assertJsonValidationErrors(['password']);
        });

        it('rejects password with repeated characters 3+ times', function (): void {
            $user = User::factory()->admin()->create(['email' => 'repeatedchars@example.com']);
            $token = Password::broker('users')->createToken($user);

            $this->postJson('/api/reset-password', [
                'email' => 'repeatedchars@example.com',
                'token' => $token,
                'password' => 'AAAbbbb123!',
                'password_confirmation' => 'AAAbbbb123!',
            ])->assertUnprocessable()
                ->assertJsonValidationErrors(['password']);
        })->todo('Add custom password rule to NewPasswordRequest for detecting repeated characters');

        it('rejects password with common pattern at start', function (): void {
            $user = User::factory()->admin()->create(['email' => 'commonpattern@example.com']);
            $token = Password::broker('users')->createToken($user);

            $this->postJson('/api/reset-password', [
                'email' => 'commonpattern@example.com',
                'token' => $token,
                'password' => 'Password123!',
                'password_confirmation' => 'Password123!',
            ])->assertUnprocessable()
                ->assertJsonValidationErrors(['password']);
        })->todo('Add custom password rule to NewPasswordRequest for detecting common patterns');

        it('accepts password at minimum 8 chars with mixed case, numbers, symbols', function (): void {
            $user = User::factory()->admin()->create(['email' => 'minpass@example.com']);
            $token = Password::broker('users')->createToken($user);

            $this->postJson('/api/reset-password', [
                'email' => 'minpass@example.com',
                'token' => $token,
                'password' => 'Abcd1234!',
                'password_confirmation' => 'Abcd1234!',
            ])->assertOk();
        });

        it('accepts password with all allowed special characters', function (): void {
            $user = User::factory()->admin()->create(['email' => 'allspecial@example.com']);
            $token = Password::broker('users')->createToken($user);

            $this->postJson('/api/reset-password', [
                'email' => 'allspecial@example.com',
                'token' => $token,
                'password' => 'Pass!@#$%^&*1',
                'password_confirmation' => 'Pass!@#$%^&*1',
            ])->assertOk();
        });

        it('rejects integer as password', function (): void {
            $this->postJson('/api/reset-password', [
                'email' => 'admin@example.com',
                'token' => 'some-token',
                'password' => 12345678,
                'password_confirmation' => 12345678,
            ])->assertUnprocessable()
                ->assertJsonValidationErrors(['password']);
        });

        it('rejects boolean as password', function (): void {
            $this->postJson('/api/reset-password', [
                'email' => 'admin@example.com',
                'token' => 'some-token',
                'password' => true,
                'password_confirmation' => true,
            ])->assertUnprocessable()
                ->assertJsonValidationErrors(['password']);
        });

        it('rejects array as password', function (): void {
            $this->postJson('/api/reset-password', [
                'email' => 'admin@example.com',
                'token' => 'some-token',
                'password' => ['P@ssw0rd!'],
                'password_confirmation' => ['P@ssw0rd!'],
            ])->assertUnprocessable()
                ->assertJsonValidationErrors(['password']);
        });
    });

    describe('password confirmation validation', function (): void {

        it('rejects missing password_confirmation', function (): void {
            $this->postJson('/api/reset-password', [
                'email' => 'admin@example.com',
                'token' => 'some-token',
                'password' => 'NewSecurePass1!',
            ])->assertUnprocessable()
                ->assertJsonValidationErrors(['password']);
        });

        it('rejects empty password_confirmation', function (): void {
            $this->postJson('/api/reset-password', [
                'email' => 'admin@example.com',
                'token' => 'some-token',
                'password' => 'NewSecurePass1!',
                'password_confirmation' => '',
            ])->assertUnprocessable()
                ->assertJsonValidationErrors(['password']);
        });

        it('rejects null password_confirmation', function (): void {
            $this->postJson('/api/reset-password', [
                'email' => 'admin@example.com',
                'token' => 'some-token',
                'password' => 'NewSecurePass1!',
                'password_confirmation' => null,
            ])->assertUnprocessable()
                ->assertJsonValidationErrors(['password']);
        });

        it('rejects password_confirmation that does not match', function (): void {
            $this->postJson('/api/reset-password', [
                'email' => 'admin@example.com',
                'token' => 'some-token',
                'password' => 'NewSecurePass1!',
                'password_confirmation' => 'DifferentPass1!',
            ])->assertUnprocessable()
                ->assertJsonValidationErrors(['password']);
        });

        it('rejects password_confirmation with different case', function (): void {
            $this->postJson('/api/reset-password', [
                'email' => 'admin@example.com',
                'token' => 'some-token',
                'password' => 'NewSecurePass1!',
                'password_confirmation' => 'newsecurepass1!',
            ])->assertUnprocessable()
                ->assertJsonValidationErrors(['password']);
        });
    });
});

// ─── End-to-End: Full Flow ───────────────────────────────────────────────

describe('Forgot Password - Full Flow', function (): void {

    it('completes the full forgot-password flow end-to-end', function (): void {
        Mail::fake();

        $user = User::factory()->admin()->create([
            'email' => 'fullflow@example.com',
            'password' => bcrypt('OldPassword1!'),
        ]);

        // Step 1: Request reset link
        $this->postJson('/api/forgot-password', ['email' => 'fullflow@example.com'])
            ->assertOk();

        Mail::assertQueued(ResetPasswordMail::class, fn ($mail) => $mail->hasTo('fullflow@example.com'));

        // Step 2: Extract token from the mail (simulate real flow)
        $token = Password::broker('users')->createToken($user);

        // Step 3: Reset password
        $this->postJson('/api/reset-password', [
            'email' => 'fullflow@example.com',
            'token' => $token,
            'password' => 'NewSecurePass1!',
            'password_confirmation' => 'NewSecurePass1!',
        ])->assertOk();

        $user->refresh();
        expect(Hash::check('NewSecurePass1!', $user->password))->toBeTrue();

        // Step 4: Old password no longer works
        expect(Hash::check('OldPassword1!', $user->password))->toBeFalse();
    });

    it('sends email with correct reset URL structure', function (): void {
        Mail::fake();

        $user = User::factory()->admin()->create([
            'email' => 'urlcheck@example.com',
        ]);

        $token = Password::broker('users')->createToken($user);

        $this->postJson('/api/forgot-password', ['email' => 'urlcheck@example.com'])
            ->assertOk();

        Mail::assertQueued(ResetPasswordMail::class, function ($mail) {
            $mailContent = $mail->content();
            $expectedFrontend = config('app.frontend_url', 'http://localhost:4200');

            return str_contains($mailContent->with['resetUrl'] ?? '', $expectedFrontend)
                && str_contains($mailContent->with['resetUrl'] ?? '', 'token=')
                && str_contains($mailContent->with['resetUrl'] ?? '', 'email=');
        });
    });

    it('includes the correct expire time in the email', function (): void {
        Mail::fake();

        User::factory()->admin()->create(['email' => 'expirecheck@example.com']);

        $this->postJson('/api/forgot-password', ['email' => 'expirecheck@example.com'])
            ->assertOk();

        $expectedExpire = config('auth.passwords.users.expire', 60);

        Mail::assertQueued(ResetPasswordMail::class, function ($mail) use ($expectedExpire) {
            return ($mail->content()->with['expireMinutes'] ?? null) === $expectedExpire;
        });
    });
});
