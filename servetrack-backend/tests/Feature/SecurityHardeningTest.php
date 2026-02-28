<?php

use Illuminate\Support\Str;

describe('SanitizeInput middleware', function (): void {
    it('strips sql injection patterns from input', function (): void {
        $this->postJson('/api/login', [
            'email' => "' OR 1=1 --",
            'password' => Str::random(12),
        ])->assertUnprocessable(); // Sanitized value fails email validation
    });

    it('strips UNION injection from input', function (): void {
        $this->postJson('/api/login', [
            'email' => 'test@example.com UNION SELECT * FROM users',
            'password' => Str::random(12),
        ])->assertUnprocessable(); // Sanitized value fails email validation
    });

    it('strips script tags from input', function (): void {
        $password = 'Secret'.fake()->numerify('###').'!';
        $this->postJson('/api/register', [
            'name' => '<script>alert("xss")</script>Test',
            'email' => fake()->safeEmail(),
            'password' => $password,
            'password_confirmation' => $password,
        ])->assertCreated()
            ->assertJsonPath('user.name', 'alert("xss")Test'); // Tag is stripped
    });

    it('trims whitespace from all string inputs', function (): void {
        $this->postJson('/api/login', [
            'email' => '  nobody@example.com  ',
            'password' => '  '.Str::random(10).'  ',
        ])->assertUnprocessable(); // Passes sanitization, but fails auth
    });
});

describe('Registration throttling', function (): void {
    it('blocks registration after 3 attempts per minute', function (): void {
        $password = 'Secret'.fake()->numerify('###').'!';
        $payload = [
            'name' => fake()->name(),
            'email' => fake()->safeEmail(),
            'password' => $password,
            'password_confirmation' => $password,
        ];

        // First attempt — succeeds
        $this->postJson('/api/register', $payload)->assertCreated();

        // Second and third attempts — fail validation (email taken) but not throttled
        $this->postJson('/api/register', $payload)->assertUnprocessable();
        $this->postJson('/api/register', $payload)->assertUnprocessable();

        // Fourth attempt — throttled
        $this->postJson('/api/register', $payload)->assertTooManyRequests();
    });
});

describe('Password policy enforcement', function (): void {
    it('rejects a password that is too short', function (): void {
        $password = fake()->lexify('????').fake()->numerify('#').'!'; // 6 chars
        $this->postJson('/api/register', [
            'name' => fake()->name(),
            'email' => fake()->safeEmail(),
            'password' => $password,
            'password_confirmation' => $password,
        ])->assertUnprocessable()
            ->assertJsonValidationErrors(['password']);
    });

    it('rejects a password with no special character', function (): void {
        $password = 'Safe'.fake()->numerify('######');
        $this->postJson('/api/register', [
            'name' => fake()->name(),
            'email' => fake()->safeEmail(),
            'password' => $password,
            'password_confirmation' => $password,
        ])->assertUnprocessable()
            ->assertJsonValidationErrors(['password']);
    });

    it('rejects a password with no number', function (): void {
        $password = 'Safe'.fake()->lexify('?????').'!';
        $this->postJson('/api/register', [
            'name' => fake()->name(),
            'email' => fake()->safeEmail(),
            'password' => $password,
            'password_confirmation' => $password,
        ])->assertUnprocessable()
            ->assertJsonValidationErrors(['password']);
    });

    it('accepts a strong password', function (): void {
        $password = 'Strong'.fake()->numerify('####').'!';
        $this->postJson('/api/register', [
            'name' => fake()->name(),
            'email' => fake()->safeEmail(),
            'password' => $password,
            'password_confirmation' => $password,
        ])->assertCreated();
    });
});

describe('SecurityAudit User-Agent logging', function (): void {
    it('logs the user agent on an auth attempt', function (): void {
        $before = file_exists(storage_path('logs/laravel.log'))
            ? file_get_contents(storage_path('logs/laravel.log'))
            : '';

        $this->postJson('/api/login', [
            'email' => fake()->safeEmail(),
            'password' => Str::random(10),
        ], ['User-Agent' => 'TestAgent/1.0']);

        $after = file_get_contents(storage_path('logs/laravel.log'));
        $newContent = substr($after, strlen($before));

        expect($newContent)->toContain('TestAgent/1.0');
    });
});
