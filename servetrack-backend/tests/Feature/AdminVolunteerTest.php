<?php

use App\Models\ProfileChangeLog;
use App\Models\User;
use App\Models\Volunteer;

describe('Admin Volunteer Search & Filter', function (): void {
    beforeEach(function (): void {
        $this->admin = User::factory()->admin()->create();
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

    it('returns 403 for volunteer accessing admin list', function (): void {
        $volunteer = User::factory()->volunteer()->create();

        $this->actingAs($volunteer)
            ->getJson('/api/volunteers')
            ->assertForbidden();
    });

    it('returns 401 for unauthenticated access to admin list', function (): void {
        $this->app['auth']->guard('web')->logout();

        $this->getJson('/api/volunteers')
            ->assertUnauthorized();
    });
});

describe('Admin Volunteer Detail View', function (): void {
    it('returns volunteer with stats for valid ID', function (): void {
        $admin = User::factory()->admin()->create();
        $volunteer = Volunteer::factory()->create();

        $this->actingAs($admin)
            ->getJson("/api/volunteers/{$volunteer->volunteer_id}")
            ->assertSuccessful()
            ->assertJsonStructure([
                'data' => [
                    'volunteer',
                    'stats' => ['total_attendances', 'approved_attendances', 'pending_attendances'],
                ],
            ]);
    });

    it('returns 404 for non-existent volunteer', function (): void {
        $admin = User::factory()->admin()->create();

        $this->actingAs($admin)
            ->getJson('/api/volunteers/99999')
            ->assertNotFound();
    });

    it('returns 403 for volunteer accessing another volunteer detail', function (): void {
        $volunteerUser = User::factory()->volunteer()->create();
        $volunteer = Volunteer::factory()->create();

        $this->actingAs($volunteerUser)
            ->getJson("/api/volunteers/{$volunteer->volunteer_id}")
            ->assertForbidden();
    });
});

describe('Volunteer Change History', function (): void {
    it('returns paginated change log for a volunteer', function (): void {
        $admin = User::factory()->admin()->create();
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
        $admin = User::factory()->admin()->create();
        $volunteer = Volunteer::factory()->create();

        $this->actingAs($admin)
            ->getJson("/api/admin/volunteers/{$volunteer->volunteer_id}/change-history")
            ->assertSuccessful()
            ->assertJsonCount(0, 'data');
    });

    it('returns 403 for non-admin accessing change history', function (): void {
        $volunteerUser = User::factory()->volunteer()->create();
        $volunteer = Volunteer::factory()->create();

        $this->actingAs($volunteerUser)
            ->getJson("/api/admin/volunteers/{$volunteer->volunteer_id}/change-history")
            ->assertForbidden();
    });
});

describe('Admin Dashboard Access Control', function (): void {
    it('allows admin to access the dashboard', function (): void {
        $admin = User::factory()->admin()->create();

        $this->actingAs($admin)
            ->getJson('/api/admin/dashboard')
            ->assertSuccessful();
    });

    it('returns 403 for volunteer accessing admin dashboard', function (): void {
        $volunteer = User::factory()->volunteer()->create();

        $this->actingAs($volunteer)
            ->getJson('/api/admin/dashboard')
            ->assertForbidden();
    });

    it('returns 401 for unauthenticated access to admin dashboard', function (): void {
        $this->getJson('/api/admin/dashboard')
            ->assertUnauthorized();
    });
});
