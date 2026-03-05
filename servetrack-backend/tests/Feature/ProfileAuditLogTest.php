<?php

use App\Models\User;
use App\Models\Volunteer;

describe('Profile Audit Logging', function (): void {
    beforeEach(function (): void {
        $this->user = User::factory()->create();
        $this->volunteer = Volunteer::factory()->create([
            'user_id' => $this->user->id,
            'first_name' => 'Original',
            'last_name' => 'Name',
            'email' => 'original@example.com',
        ]);
        $this->actingAs($this->user);
    });

    it('logs each changed field on profile update', function (): void {
        $data = baseProfileData($this->volunteer);
        $data['firstName'] = 'Changed';

        $this->putJson('/api/volunteer/profile', $data)
            ->assertSuccessful();

        $log = \App\Models\ProfileChangeLog::where('volunteer_id', $this->volunteer->volunteer_id)
            ->where('field_name', 'first_name')
            ->first();

        expect($log)->not->toBeNull()
            ->and($log->old_value)->toBe('Original')
            ->and($log->new_value)->toBe('Changed')
            ->and($log->changed_by_user_id)->toBe($this->user->id);
    });

    it('does not log when no meaningful changes are made', function (): void {
        // First update to establish a baseline
        $this->putJson('/api/volunteer/profile', baseProfileData($this->volunteer))
            ->assertSuccessful();

        // Clear any logs from first update
        \App\Models\ProfileChangeLog::where('volunteer_id', $this->volunteer->volunteer_id)->delete();

        // Second update with SAME data should not create new logs
        $this->putJson('/api/volunteer/profile', baseProfileData($this->volunteer))
            ->assertSuccessful();

        $logCount = \App\Models\ProfileChangeLog::where('volunteer_id', $this->volunteer->volunteer_id)->count();

        expect($logCount)->toBe(0);
    });

    it('logs multiple changed fields as separate records', function (): void {
        $data = baseProfileData($this->volunteer);
        $data['firstName'] = 'NewFirst';
        $data['lastName'] = 'NewLast';
        $data['email'] = 'newemail@example.com';

        $this->putJson('/api/volunteer/profile', $data)
            ->assertSuccessful();

        $logCount = \App\Models\ProfileChangeLog::where('volunteer_id', $this->volunteer->volunteer_id)->count();

        expect($logCount)->toBeGreaterThanOrEqual(3); // first_name, last_name, email
    });

    it('captures IP address in audit log', function (): void {
        $data = baseProfileData($this->volunteer);
        $data['firstName'] = 'IPTest';

        $this->putJson('/api/volunteer/profile', $data)
            ->assertSuccessful();

        $log = \App\Models\ProfileChangeLog::where('volunteer_id', $this->volunteer->volunteer_id)->first();

        expect($log->ip_address)->not->toBeNull();
    });
});
