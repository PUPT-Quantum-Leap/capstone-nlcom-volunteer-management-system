<?php

use App\Models\Admin;
use App\Models\User;

use function Pest\Laravel\actingAs;

beforeEach(function () {
    $this->user = User::factory()->create([
        'role' => 'admin',
        'email' => 'admin@example.com',
        'name' => 'Admin User',
    ]);

    $adminData = [
        'user_id' => $this->user->id,
        'email' => 'admin@example.com',
        'first_name' => 'Admin',
        'last_name' => 'User',
    ];

    $this->admin = Admin::create($adminData);
});

test('admin can fetch their profile', function () {
    actingAs($this->user)
        ->getJson('/api/admin/profile')
        ->assertStatus(200)
        ->assertJson([
            'success' => true,
            'data' => [
                'email' => 'admin@example.com',
                'name' => 'Admin User',
            ],
        ]);
});

test('admin can update their profile', function () {
    actingAs($this->user)
        ->putJson('/api/admin/profile', [
            'first_name' => 'Updated',
            'last_name' => 'Admin',
            'email' => 'updated@example.com',
            'contact_number' => '09123456789',
        ])
        ->assertStatus(200)
        ->assertJson([
            'success' => true,
            'message' => 'Profile updated successfully',
        ]);

    $this->user->refresh();
    $this->admin->refresh();

    expect($this->user->name)->toBe('Updated Admin');
    expect($this->user->email)->toBe('updated@example.com');
    expect($this->admin->email)->toBe('updated@example.com');
    expect($this->admin->contact_number)->toBe('09123456789');
});

test('admin profile update validates email uniqueness', function () {
    User::factory()->create(['email' => 'other@example.com']);

    actingAs($this->user)
        ->putJson('/api/admin/profile', [
            'first_name' => 'Updated',
            'last_name' => 'Admin',
            'email' => 'other@example.com',
        ])
        ->assertStatus(422)
        ->assertJsonValidationErrors(['email']);
});
