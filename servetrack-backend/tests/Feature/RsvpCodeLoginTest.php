<?php

use App\Models\User;
use App\Models\Volunteer;
use Illuminate\Support\Facades\Auth;

describe('RSVP Access Code Login', function (): void {
    it('authenticates a volunteer with a valid unique access code', function (): void {
        $user = User::factory()->create(['role' => 'volunteer']);
        $volunteer = Volunteer::factory()->create([
            'user_id' => $user->id,
            'last_name' => 'Smith',
            'birthdate' => '1990-05-12',
        ]);

        $response = $this->postJson(route('auth.login-by-code'), [
            'code' => 'SM1990',
        ]);

        $response->assertOk();
        $response->assertJsonStructure([
            'user' => [
                'id',
                'email',
                'role',
                'volunteer_profile',
            ],
        ]);

        expect(Auth::check())->toBeTrue();
        expect(Auth::user()->id)->toBe($user->id);
    });

    it('rejects access code with invalid format', function (): void {
        $response = $this->postJson(route('auth.login-by-code'), [
            'code' => 'S1990', // too short
        ]);
        $response->assertStatus(422);

        $response2 = $this->postJson(route('auth.login-by-code'), [
            'code' => 'SM199', // birth year too short
        ]);
        $response2->assertStatus(422);

        $response3 = $this->postJson(route('auth.login-by-code'), [
            'code' => '121990', // digits instead of letters
        ]);
        $response3->assertStatus(422);
    });

    it('rejects when no volunteer matches the access code', function (): void {
        $response = $this->postJson(route('auth.login-by-code'), [
            'code' => 'XX2000',
        ]);

        $response->assertStatus(429);
        $response->assertJson([
            'message' => 'Invalid credentials',
        ]);
    });

    it('rejects and asks for email/password when multiple volunteers match the code', function (): void {
        $user1 = User::factory()->create(['role' => 'volunteer']);
        $volunteer1 = Volunteer::factory()->create([
            'user_id' => $user1->id,
            'last_name' => 'Smith',
            'birthdate' => '1990-01-01',
        ]);

        $user2 = User::factory()->create(['role' => 'volunteer']);
        $volunteer2 = Volunteer::factory()->create([
            'user_id' => $user2->id,
            'last_name' => 'Smart',
            'birthdate' => '1990-12-31',
        ]);

        $response = $this->postJson(route('auth.login-by-code'), [
            'code' => 'SM1990',
        ]);

        $response->assertStatus(422);
        $response->assertJson([
            'message' => 'Multiple accounts found matching this code. Please sign in with your email and password instead.',
        ]);
    });
});
