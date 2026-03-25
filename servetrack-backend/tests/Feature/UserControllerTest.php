<?php

use App\Models\User;

beforeEach(function () {
    $this->adminUser = User::factory()->create([
        'role' => 'admin',
    ]);
});

test('it soft deletes a user', function () {
    $user = User::factory()->create();

    $response = $this->actingAs($this->adminUser)->patchJson("/api/users/{$user->id}/soft-delete");

    $response->assertStatus(200)
        ->assertJson([
            'success' => true,
            'message' => 'User archived successfully',
        ]);

    $this->assertSoftDeleted('users', ['id' => $user->id]);
});

test('it restores a soft-deleted user', function () {
    $user = User::factory()->create();
    $user->delete(); // Soft delete it initially

    $this->assertSoftDeleted('users', ['id' => $user->id]);

    $response = $this->actingAs($this->adminUser)->patchJson("/api/users/{$user->id}/restore");

    $response->assertStatus(200)
        ->assertJson([
            'success' => true,
            'message' => 'User restored successfully',
        ]);

    $this->assertNotSoftDeleted('users', ['id' => $user->id]);
});

test('it returns 404 when soft deleting a non-existent user', function () {
    $response = $this->actingAs($this->adminUser)->patchJson('/api/users/99999/soft-delete');

    $response->assertStatus(404)
        ->assertJson([
            'success' => false,
            'message' => 'User not found',
        ]);
});

test('it returns 404 when restoring a non-existent archived user', function () {
    $response = $this->actingAs($this->adminUser)->patchJson('/api/users/99999/restore');

    $response->assertStatus(404)
        ->assertJson([
            'success' => false,
            'message' => 'Archived user not found',
        ]);
});

test('it correctly filters archived users in index endpoint', function () {
    $activeUser = User::factory()->create(['name' => 'Active User']);
    $archivedUser = User::factory()->create(['name' => 'Archived User']);
    $archivedUser->delete();

    // Fetch active users
    $responseActive = $this->actingAs($this->adminUser)->getJson('/api/users');
    $responseActive->assertStatus(200);
    $responseActiveData = collect($responseActive->json('data'));
    $this->assertTrue($responseActiveData->contains('id', $activeUser->id));
    $this->assertFalse($responseActiveData->contains('id', $archivedUser->id));

    // Fetch archived users
    $responseArchived = $this->actingAs($this->adminUser)->getJson('/api/users?archived=true');
    $responseArchived->assertStatus(200);
    $responseArchivedData = collect($responseArchived->json('data'));
    $this->assertFalse($responseArchivedData->contains('id', $activeUser->id));
    $this->assertTrue($responseArchivedData->contains('id', $archivedUser->id));
});
