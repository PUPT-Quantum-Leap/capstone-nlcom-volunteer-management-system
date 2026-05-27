<?php

use App\Models\User;
use App\Models\Volunteer;

function validPassword(): string
{
    return Illuminate\Support\Str::random(10).'A1!';
}

beforeEach(function () {
    $this->adminUser = User::factory()->admin()->create();
});

describe('index', function (): void {
    it('lists active users excluding the current admin', function () {
        $otherUser = User::factory()->create();

        $response = $this->actingAs($this->adminUser)->getJson('/api/users');

        $response->assertOk()
            ->assertJson(['success' => true]);
        $data = collect($response->json('data'));
        expect($data->pluck('id'))->not->toContain($this->adminUser->id);
        expect($data->pluck('id'))->toContain($otherUser->id);
    });

    it('includes pagination meta', function () {
        User::factory()->count(10)->create();

        $response = $this->actingAs($this->adminUser)->getJson('/api/users?per_page=5');

        $response->assertOk();
        $meta = $response->json('meta');
        expect($meta)->toHaveKeys(['current_page', 'last_page', 'per_page', 'total']);
    });

    it('filters users by role', function () {
        User::factory()->volunteer()->create(['name' => 'Vol Only']);
        User::factory()->coordinator()->create(['name' => 'Coord Only']);

        $response = $this->actingAs($this->adminUser)->getJson('/api/users?role=volunteer');

        $response->assertOk();
        $data = collect($response->json('data'));
        expect($data->pluck('role'))->each->toBe('volunteer');
    });

    it('searches users by name or email', function () {
        User::factory()->create(['name' => 'UniqueSearchName', 'email' => 'unique@example.com']);
        User::factory()->create(['name' => 'Other', 'email' => 'other@example.com']);

        $response = $this->actingAs($this->adminUser)->getJson('/api/users?search=Unique');

        $response->assertOk();
        $data = collect($response->json('data'));
        expect($data->pluck('name'))->toContain('UniqueSearchName');
        expect($data->pluck('name'))->not->toContain('Other');
    });

    it('lists archived users when requested', function () {
        $active = User::factory()->create(['name' => 'Active']);
        $archived = User::factory()->create(['name' => 'Archived']);
        $archived->delete();

        $response = $this->actingAs($this->adminUser)->getJson('/api/users?archived=true');

        $response->assertOk();
        $data = collect($response->json('data'));
        expect($data->pluck('id'))->toContain($archived->id);
        expect($data->pluck('id'))->not->toContain($active->id);
    });

    it('includes the admin user in archived list', function () {
        $this->adminUser->delete();

        $response = $this->actingAs($this->adminUser)->getJson('/api/users?archived=true');

        $response->assertOk();
        $data = collect($response->json('data'));
        expect($data->pluck('id'))->toContain($this->adminUser->id);
    });

    it('returns 401 for unauthenticated requests', function () {
        $this->getJson('/api/users')->assertUnauthorized();
    });
});

describe('store', function (): void {
    it('creates a new user successfully', function () {
        $payload = [
            'name' => 'New User',
            'email' => 'newuser@example.com',
            'password' => validPassword(),
            'role' => 'volunteer',
        ];

        $response = $this->actingAs($this->adminUser)->postJson('/api/users', $payload);

        $response->assertCreated()
            ->assertJson(['success' => true]);
        expect($response->json('data.email'))->toBe('newuser@example.com');
        $this->assertDatabaseHas('users', ['email' => 'newuser@example.com', 'role' => 'volunteer']);
    });

    it('creates volunteer profile for volunteer role', function () {
        $payload = [
            'name' => 'Volunteer Joe',
            'email' => 'joe@example.com',
            'password' => validPassword(),
            'role' => 'volunteer',
        ];

        $response = $this->actingAs($this->adminUser)->postJson('/api/users', $payload);

        $response->assertCreated();
        $userId = $response->json('data.id');
        $this->assertDatabaseHas('volunteer', ['user_id' => $userId, 'email' => 'joe@example.com']);
    });

    it('does not create volunteer profile for admin role', function () {
        $payload = [
            'name' => 'Admin Joe',
            'email' => 'adminjoe@example.com',
            'password' => validPassword(),
            'role' => 'admin',
        ];

        $response = $this->actingAs($this->adminUser)->postJson('/api/users', $payload);

        $response->assertCreated();
        $userId = $response->json('data.id');
        $this->assertDatabaseMissing('volunteer', ['user_id' => $userId]);
    });

    it('does not create volunteer profile for coordinator role', function () {
        $payload = [
            'name' => 'Coord Joe',
            'email' => 'coordjoe@example.com',
            'password' => validPassword(),
            'role' => 'coordinator',
        ];

        $response = $this->actingAs($this->adminUser)->postJson('/api/users', $payload);

        $response->assertCreated();
        $userId = $response->json('data.id');
        $this->assertDatabaseMissing('volunteer', ['user_id' => $userId]);
    });

    it('rejects duplicate email', function () {
        User::factory()->create(['email' => 'taken@example.com']);
        $payload = [
            'name' => 'Duplicate',
            'email' => 'taken@example.com',
            'password' => validPassword(),
            'role' => 'volunteer',
        ];

        $response = $this->actingAs($this->adminUser)->postJson('/api/users', $payload);

        $response->assertStatus(422);
        $errors = $response->json('errors');
        expect($errors)->toHaveKey('email');
    });

    it('rejects invalid role', function () {
        $payload = [
            'name' => 'Bad Role',
            'email' => 'bad@example.com',
            'password' => validPassword(),
            'role' => 'superadmin',
        ];

        $response = $this->actingAs($this->adminUser)->postJson('/api/users', $payload);

        $response->assertStatus(422);
    });

    it('rejects missing required fields', function () {
        $response = $this->actingAs($this->adminUser)->postJson('/api/users', []);

        $response->assertStatus(422);
    });
});

describe('show', function (): void {
    it('returns a single user', function () {
        $user = User::factory()->create();

        $response = $this->actingAs($this->adminUser)->getJson("/api/users/{$user->id}");

        $response->assertOk()
            ->assertJson([
                'success' => true,
                'data' => ['id' => $user->id, 'email' => $user->email],
            ]);
    });

    it('returns 404 for non-existent user', function () {
        $response = $this->actingAs($this->adminUser)->getJson('/api/users/99999');

        $response->assertNotFound()
            ->assertJson(['success' => false]);
    });
});

describe('update', function (): void {
    it('updates a user successfully', function () {
        $user = User::factory()->create(['name' => 'Old Name']);

        $response = $this->actingAs($this->adminUser)->putJson("/api/users/{$user->id}", [
            'name' => 'Updated Name',
            'email' => $user->email,
            'role' => 'volunteer',
        ]);

        $response->assertOk()
            ->assertJson(['success' => true]);
        $this->assertDatabaseHas('users', ['id' => $user->id, 'name' => 'Updated Name']);
    });

    it('updates volunteer name cascade when changing name', function () {
        $volunteerUser = User::factory()->volunteer()->create(['name' => 'Jane Doe']);
        Volunteer::factory()->create(['user_id' => $volunteerUser->id,
            'first_name' => 'Jane', 'last_name' => 'Doe',
        ]);

        $response = $this->actingAs($this->adminUser)->putJson("/api/users/{$volunteerUser->id}", [
            'name' => 'Jane Smith',
            'email' => $volunteerUser->email,
            'role' => 'volunteer',
        ]);

        $response->assertOk();
        $this->assertDatabaseHas('volunteer', ['user_id' => $volunteerUser->id,
            'first_name' => 'Jane', 'last_name' => 'Smith',
        ]);
    });

    it('changes role and creates appropriate profile', function () {
        $user = User::factory()->create(['role' => 'volunteer']);

        $response = $this->actingAs($this->adminUser)->putJson("/api/users/{$user->id}", [
            'name' => $user->name,
            'email' => $user->email,
            'role' => 'admin',
        ]);

        $response->assertOk()
            ->assertJson(['message' => 'User updated successfully with role change']);
        $this->assertDatabaseHas('admin', ['email' => $user->email]);
    });

    it('forbids modifying own account', function () {
        $response = $this->actingAs($this->adminUser)->putJson("/api/users/{$this->adminUser->id}", [
            'name' => $this->adminUser->name,
            'email' => $this->adminUser->email,
            'role' => 'admin',
        ]);

        $response->assertForbidden()
            ->assertJson(['message' => 'You cannot modify your own account.']);
    });

    it('returns 404 for non-existent user', function () {
        $response = $this->actingAs($this->adminUser)->putJson('/api/users/99999', [
            'name' => 'Nope',
            'email' => 'nope@example.com',
            'role' => 'volunteer',
        ]);

        $response->assertNotFound();
    });
});

describe('softDelete', function (): void {
    it('soft deletes a user', function () {
        $user = User::factory()->create();

        $response = $this->actingAs($this->adminUser)->patchJson("/api/users/{$user->id}/soft-delete");

        $response->assertOk()
            ->assertJson(['success' => true, 'message' => 'User archived successfully']);
        $this->assertSoftDeleted('users', ['id' => $user->id]);
    });

    it('cascades soft delete to volunteer', function () {
        $volunteerUser = User::factory()->volunteer()->create();
        $volunteer = Volunteer::factory()->create(['user_id' => $volunteerUser->id]);

        $this->actingAs($this->adminUser)->patchJson("/api/users/{$volunteerUser->id}/soft-delete");

        $this->assertSoftDeleted('volunteer', ['volunteer_id' => $volunteer->volunteer_id]);
    });

    it('forbids archiving own account', function () {
        $response = $this->actingAs($this->adminUser)->patchJson("/api/users/{$this->adminUser->id}/soft-delete");

        $response->assertForbidden()
            ->assertJson(['message' => 'You cannot archive your own account.']);
    });

    it('returns 200 when archiving already archived user', function () {
        $user = User::factory()->create();
        $user->delete();

        $response = $this->actingAs($this->adminUser)->patchJson("/api/users/{$user->id}/soft-delete");

        $response->assertOk();
    });

    it('returns 404 for non-existent user', function () {
        $response = $this->actingAs($this->adminUser)->patchJson('/api/users/99999/soft-delete');

        $response->assertNotFound();
    });
});

describe('restore', function (): void {
    it('restores a soft-deleted user', function () {
        $user = User::factory()->create();
        $user->delete();

        $response = $this->actingAs($this->adminUser)->patchJson("/api/users/{$user->id}/restore");

        $response->assertOk()
            ->assertJson(['success' => true, 'message' => 'User restored successfully']);
        $this->assertNotSoftDeleted('users', ['id' => $user->id]);
    });

    it('cascades restore to volunteer', function () {
        $volunteerUser = User::factory()->volunteer()->create();
        $volunteer = Volunteer::factory()->create(['user_id' => $volunteerUser->id]);
        $volunteerUser->delete();

        $this->actingAs($this->adminUser)->patchJson("/api/users/{$volunteerUser->id}/restore");

        $this->assertNotSoftDeleted('volunteer', ['volunteer_id' => $volunteer->volunteer_id]);
    });

    it('returns 404 for non-existent archived user', function () {
        $response = $this->actingAs($this->adminUser)->patchJson('/api/users/99999/restore');

        $response->assertNotFound()
            ->assertJson(['success' => false]);
    });

    it('returns 404 when restoring an active user', function () {
        $user = User::factory()->create();

        $response = $this->actingAs($this->adminUser)->patchJson("/api/users/{$user->id}/restore");

        $response->assertNotFound();
    });
});

describe('destroy', function (): void {
    it('force deletes a user', function () {
        $user = User::factory()->create();

        $response = $this->actingAs($this->adminUser)->deleteJson("/api/users/{$user->id}");

        $response->assertOk()
            ->assertJson(['success' => true]);
        $this->assertDatabaseMissing('users', ['id' => $user->id]);
    });

    it('force deletes an archived user', function () {
        $user = User::factory()->create();
        $user->delete();

        $response = $this->actingAs($this->adminUser)->deleteJson("/api/users/{$user->id}");

        $response->assertOk();
        $this->assertDatabaseMissing('users', ['id' => $user->id]);
    });

    it('cascades force delete to volunteer', function () {
        $volunteerUser = User::factory()->volunteer()->create();
        Volunteer::factory()->create(['user_id' => $volunteerUser->id]);

        $this->actingAs($this->adminUser)->deleteJson("/api/users/{$volunteerUser->id}");

        $this->assertDatabaseMissing('volunteer', ['user_id' => $volunteerUser->id]);
    });

    it('forbids deleting own account', function () {
        $response = $this->actingAs($this->adminUser)->deleteJson("/api/users/{$this->adminUser->id}");

        $response->assertForbidden()
            ->assertJson(['message' => 'You cannot delete your own account.']);
    });

    it('returns 404 for non-existent user', function () {
        $response = $this->actingAs($this->adminUser)->deleteJson('/api/users/99999');

        $response->assertNotFound();
    });
});

describe('resetPassword', function (): void {
    it('resets user password successfully', function () {
        $user = User::factory()->create(['password' => bcrypt('oldpassword')]);

        $response = $this->actingAs($this->adminUser)->postJson("/api/users/{$user->id}/reset-password", [
            'password' => validPassword(),
        ]);

        $response->assertOk()
            ->assertJson(['success' => true, 'message' => 'Password reset successfully']);
    });

    it('forbids resetting own password', function () {
        $response = $this->actingAs($this->adminUser)->postJson("/api/users/{$this->adminUser->id}/reset-password", [
            'password' => validPassword(),
        ]);

        $response->assertForbidden()
            ->assertJson(['message' => 'You cannot reset your own password here. Use the profile settings.']);
    });

    it('rejects weak passwords', function () {
        $user = User::factory()->create();

        $response = $this->actingAs($this->adminUser)->postJson("/api/users/{$user->id}/reset-password", [
            'password' => 'short',
        ]);

        $response->assertStatus(422);
    });

    it('returns 404 for non-existent user', function () {
        $response = $this->actingAs($this->adminUser)->postJson('/api/users/99999/reset-password', [
            'password' => validPassword(),
        ]);

        $response->assertNotFound();
    });
});

describe('authorization', function (): void {
    it('blocks non-admin users from all user management endpoints', function (string $method, string $url) {
        $nonAdmin = User::factory()->volunteer()->create();

        $response = match (strtoupper($method)) {
            'GET' => $this->actingAs($nonAdmin)->getJson($url),
            'POST' => $this->actingAs($nonAdmin)->postJson($url, []),
            'PUT' => $this->actingAs($nonAdmin)->putJson($url, []),
            'PATCH' => $this->actingAs($nonAdmin)->patchJson($url, []),
            'DELETE' => $this->actingAs($nonAdmin)->deleteJson($url),
        };

        $response->assertForbidden();
    })->with([
        'index' => ['GET', '/api/users'],
        'store' => ['POST', '/api/users'],
        'show' => ['GET', '/api/users/1'],
        'update' => ['PUT', '/api/users/1'],
        'destroy' => ['DELETE', '/api/users/1'],
        'softDelete' => ['PATCH', '/api/users/1/soft-delete'],
        'restore' => ['PATCH', '/api/users/1/restore'],
        'resetPassword' => ['POST', '/api/users/1/reset-password'],
    ]);
});
