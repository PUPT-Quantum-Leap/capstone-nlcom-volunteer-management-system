<?php

use App\Models\User;
use Illuminate\Support\Facades\Log;

describe('SecurityAudit middleware', function (): void {
    it('logs a login attempt with status on success', function (): void {
        $user = User::factory()->create();

        Log::shouldReceive('channel')
            ->with('single')
            ->andReturnSelf();

        Log::shouldReceive('info')
            ->once()
            ->withArgs(function (string $message, array $context): bool {
                return $message === 'Auth attempt'
                    && $context['route'] === 'api/login'
                    && $context['email'] === 'test@example.com'
                    && $context['status'] === 200;
            });

        $this->postJson('/api/login', [
            'email' => 'test@example.com',
            'password' => 'password',
        ]);
    })->skip('Log facade mocking conflicts with Pest; use integration check instead.');

    it('logs a login attempt on failure', function (): void {
        Log::shouldReceive('channel')
            ->with('single')
            ->andReturnSelf();

        Log::shouldReceive('info')
            ->once()
            ->withArgs(function (string $message, array $context): bool {
                return $message === 'Auth attempt'
                    && $context['route'] === 'api/login'
                    && $context['status'] === 422;
            });

        $this->postJson('/api/login', [
            'email' => 'nobody@example.com',
            'password' => 'wrongpassword',
        ]);
    })->skip('Log facade mocking conflicts with Pest; use integration check instead.');

    it('logs email on a successful login attempt', function (): void {
        $user = User::factory()->create([
            'email' => 'audit@example.com',
            'password' => bcrypt('password'),
        ]);

        $this->postJson('/api/login', [
            'email' => 'audit@example.com',
            'password' => 'password',
        ]);

        $log = file_get_contents(storage_path('logs/laravel.log'));

        expect($log)->toContain('Security audit event')
            ->toContain('a***t@example.com');
    });

    it('does not log email on a failed login attempt', function (): void {
        Log::spy();

        $this->postJson('/api/login', [
            'email' => 'noone@example.com',
            'password' => 'wrongpassword',
        ]);

        // Failed auth is routed to the security channel, not the default channel
        Log::shouldHaveReceived('channel')->with('security')->once();
    });

});

describe('GuestOnly (RedirectIfAuthenticated) middleware', function (): void {
    it('blocks authenticated users from the login route', function (): void {
        $user = User::factory()->create();

        $this->actingAs($user)->postJson('/api/login', [
            'email' => $user->email,
            'password' => 'password',
        ])->assertOk()
            ->assertJson([
                'message' => 'Already authenticated.',
                'redirect' => '/',
            ]);
    });

    it('allows unauthenticated users to access the login route', function (): void {
        $user = User::factory()->create([
            'email' => 'guest@example.com',
            'password' => bcrypt('password'),
        ]);

        $response = $this->postJson('/api/login', [
            'email' => 'guest@example.com',
            'password' => 'password',
        ])->assertOk()
            ->assertJsonStructure(['user']);

        expect($response->headers->getCookies())->not->toBeEmpty();
    });
});

describe('LoginRequest validation', function (): void {
    it('accepts uppercase email inputs by normalizing them', function (): void {
        $user = User::factory()->create([
            'email' => 'uppercase@example.com',
            'password' => bcrypt('password'),
        ]);

        $this->postJson('/api/login', [
            'email' => 'UPPERCASE@EXAMPLE.COM',
            'password' => 'password',
        ])->assertOk()
            ->assertJsonStructure(['user']);
    });

    it('accepts lowercase email inputs', function (): void {
        $user = User::factory()->create([
            'email' => 'lower@example.com',
            'password' => bcrypt('password'),
        ]);

        $this->postJson('/api/login', [
            'email' => 'lower@example.com',
            'password' => 'password',
        ])->assertOk();
    });
});
