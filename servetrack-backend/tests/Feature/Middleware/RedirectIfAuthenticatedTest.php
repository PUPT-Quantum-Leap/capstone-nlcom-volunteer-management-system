<?php

use App\Models\User;

describe('RedirectIfAuthenticated Middleware', function (): void {
    it('allows guest users to access guest routes', function (): void {
        $response = $this->postJson('/api/login', [
            'email' => 'test@example.com',
            'password' => 'password',
        ]);

        // Should not redirect, should attempt authentication (and fail with 422)
        $response->assertStatus(422);
    });

    it('returns json response for authenticated users on api routes', function (): void {
        $user = User::factory()->create();

        $response = $this->actingAs($user)->postJson('/api/login');

        $response->assertStatus(200)
            ->assertJson([
                'message' => 'Already authenticated.',
                'redirect' => '/',
            ]);
    });

    it('allows authenticated users to access protected routes', function (): void {
        $user = User::factory()->create();

        $response = $this->actingAs($user)->getJson('/api/user');

        $response->assertStatus(200)
            ->assertJson([
                'id' => $user->id,
                'email' => $user->email,
            ]);
    });

    it('blocks unauthenticated users from protected routes', function (): void {
        $response = $this->getJson('/api/user');

        $response->assertStatus(401);
    });

    it('allows logout for authenticated users', function (): void {
        $user = User::factory()->create();

        $response = $this->actingAs($user)->postJson('/api/logout');

        $response->assertStatus(204);
    });
});
