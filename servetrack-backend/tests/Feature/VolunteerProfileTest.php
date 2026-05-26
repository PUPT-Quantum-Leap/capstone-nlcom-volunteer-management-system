<?php

use App\Models\User;
use App\Models\Volunteer;

// ─── Authorization ───────────────────────────────────────────────

describe('Profile Authorization', function (): void {
    it('denies unauthenticated access to profile', function (): void {
        $this->getJson('/api/volunteer/profile')
            ->assertUnauthorized();
    });

    it('denies unauthenticated access to update profile', function (): void {
        $this->putJson('/api/volunteer/profile', [])
            ->assertUnauthorized();
    });

    it('denies profile update for authenticated user without volunteer record', function (): void {
        $user = User::factory()->create();

        $this->actingAs($user)
            ->putJson('/api/volunteer/profile', [
                'firstName' => 'Test',
                'lastName' => 'User',
                'facebookName' => 'testuser',
                'email' => 'test@example.com',
                'mobileNumber' => '09123456789',
                'birthdate' => '1990-01-01',
                'completeAddress' => '123 Test Street, City',
                'lastMedicalExam' => '2025-06-15',
                'educationalAttainment' => 'College',
                'volunteerPreference' => 'wherever-needed',
                'availability' => 'weekends',
                'partOfLifegroup' => 'no',
                'leadingLifegroup' => 'no',
                'emergencyContactName' => 'Jane Doe',
                'emergencyContactNumber' => '09123456789',
                'emergencyContactRelationship' => 'friend',
            ])
            ->assertForbidden();
    });

    it('allows profile update for authenticated volunteer', function (): void {
        $user = User::factory()->create();
        $volunteer = Volunteer::factory()->create(['user_id' => $user->id]);

        $this->actingAs($user)
            ->putJson('/api/volunteer/profile', baseProfileData($volunteer))
            ->assertSuccessful();
    });

    it('returns 403 when user does not have volunteer role', function (): void {
        $user = User::factory()->create();

        $this->actingAs($user)
            ->getJson('/api/volunteer/profile')
            ->assertForbidden();
    });
});

// ─── Validation ──────────────────────────────────────────────────

describe('Profile Update Validation', function (): void {
    beforeEach(function (): void {
        $this->user = User::factory()->create();
        $this->volunteer = Volunteer::factory()->create(['user_id' => $this->user->id]);
        $this->actingAs($this->user);
    });

    it('requires all mandatory fields', function (string $field): void {
        $data = baseProfileData($this->volunteer);
        unset($data[$field]);

        $this->putJson('/api/volunteer/profile', $data)
            ->assertUnprocessable()
            ->assertJsonValidationErrors([$field]);
    })->with([
        'firstName',
        'lastName',
        'facebookName',
        'email',
        'mobileNumber',
        'birthdate',
        'completeAddress',
        'lastMedicalExam',
        'educationalAttainment',
        'volunteerPreference',
        'availability',
        'partOfLifegroup',
        'leadingLifegroup',
        'emergencyContactName',
        'emergencyContactNumber',
        'emergencyContactRelationship',
    ]);

    it('rejects invalid email format', function (): void {
        $data = baseProfileData($this->volunteer);
        $data['email'] = 'not-an-email';

        $this->putJson('/api/volunteer/profile', $data)
            ->assertUnprocessable()
            ->assertJsonValidationErrors(['email']);
    });

    it('rejects duplicate email from another volunteer', function (): void {
        $otherVolunteer = Volunteer::factory()->create(['email' => 'taken@example.com']);
        $data = baseProfileData($this->volunteer);
        $data['email'] = 'taken@example.com';

        $this->putJson('/api/volunteer/profile', $data)
            ->assertUnprocessable()
            ->assertJsonValidationErrors(['email']);
    });

    it('allows keeping own email on update', function (): void {
        $this->putJson('/api/volunteer/profile', baseProfileData($this->volunteer))
            ->assertSuccessful();
    });

    it('rejects future birthdate', function (): void {
        $data = baseProfileData($this->volunteer);
        $data['birthdate'] = '2030-01-01';

        $this->putJson('/api/volunteer/profile', $data)
            ->assertUnprocessable()
            ->assertJsonValidationErrors(['birthdate']);
    });

    it('rejects future medical exam date', function (): void {
        $data = baseProfileData($this->volunteer);
        $data['lastMedicalExam'] = '2030-01-01';

        $this->putJson('/api/volunteer/profile', $data)
            ->assertUnprocessable()
            ->assertJsonValidationErrors(['lastMedicalExam']);
    });

    it('rejects invalid volunteer preference', function (): void {
        $data = baseProfileData($this->volunteer);
        $data['volunteerPreference'] = 'invalid-preference';

        $this->putJson('/api/volunteer/profile', $data)
            ->assertUnprocessable()
            ->assertJsonValidationErrors(['volunteerPreference']);
    });

    it('requires otherPreference when volunteerPreference is other', function (): void {
        $data = baseProfileData($this->volunteer);
        $data['volunteerPreference'] = 'other';
        $data['otherPreference'] = null;

        $this->putJson('/api/volunteer/profile', $data)
            ->assertUnprocessable()
            ->assertJsonValidationErrors(['otherPreference']);
    });

    it('rejects otherPreference when volunteerPreference is not other', function (): void {
        $data = baseProfileData($this->volunteer);
        $data['otherPreference'] = 'Custom position';

        $this->putJson('/api/volunteer/profile', $data)
            ->assertUnprocessable()
            ->assertJsonValidationErrors(['otherPreference']);
    });
});

// ─── Successful Update ───────────────────────────────────────────

describe('Profile Update Success', function (): void {
    it('updates volunteer fields in the database', function (): void {
        $user = User::factory()->create();
        $volunteer = Volunteer::factory()->create(['user_id' => $user->id]);

        $data = baseProfileData($volunteer);
        $data['firstName'] = 'NewFirst';
        $data['lastName'] = 'NewLast';
        $data['email'] = 'newemail@example.com';
        $data['mobileNumber'] = '09999999999';
        $data['birthdate'] = '1995-05-15';
        $data['completeAddress'] = '456 New Address, New City';
        $data['lastMedicalExam'] = '2025-12-01';
        $data['educationalAttainment'] = "Master's Degree";
        $data['volunteerPreference'] = 'medical-operations';

        $this->actingAs($user)
            ->putJson('/api/volunteer/profile', $data)
            ->assertSuccessful()
            ->assertJsonPath('success', true);

        $volunteer->refresh();
        expect($volunteer->first_name)->toBe('NewFirst')
            ->and($volunteer->last_name)->toBe('NewLast')
            ->and($volunteer->email)->toBe('newemail@example.com');
    });

    it('also updates the linked user name and email', function (): void {
        $user = User::factory()->create();
        $volunteer = Volunteer::factory()->create(['user_id' => $user->id]);

        $data = baseProfileData($volunteer);
        $data['firstName'] = 'Synced';
        $data['lastName'] = 'User';
        $data['email'] = 'synced@example.com';

        $this->actingAs($user)
            ->putJson('/api/volunteer/profile', $data)
            ->assertSuccessful();

        $user->refresh();
        expect($user->name)->toBe('Synced User')
            ->and($user->email)->toBe('synced@example.com');
    });

    it('updates volunteer gender to boy, girl, or empty', function (): void {
        $user = User::factory()->create();
        $volunteer = Volunteer::factory()->create(['user_id' => $user->id, 'gender' => 'boy']);

        // 1. Update to girl
        $data = baseProfileData($volunteer);
        $data['gender'] = 'girl';

        $this->actingAs($user)
            ->putJson('/api/volunteer/profile', $data)
            ->assertSuccessful()
            ->assertJsonPath('data.gender', 'girl');

        $volunteer->refresh();
        expect($volunteer->gender)->toBe('girl');

        // 2. Update to empty string (default apple)
        $data['gender'] = '';
        $this->actingAs($user)
            ->putJson('/api/volunteer/profile', $data)
            ->assertSuccessful()
            ->assertJsonPath('data.gender', null);

        $volunteer->refresh();
        expect($volunteer->gender)->toBeNull();
    });
});
