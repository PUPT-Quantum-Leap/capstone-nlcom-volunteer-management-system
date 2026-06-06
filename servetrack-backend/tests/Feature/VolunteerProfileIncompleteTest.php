<?php

use App\Models\Availability;
use App\Models\EmergencyContact;
use App\Models\Position;
use App\Models\Volunteer;

describe('Volunteer::isProfileIncomplete', function (): void {
    it('returns true when core profile fields are missing', function (): void {
        $volunteer = Volunteer::factory()->create([
            'birthdate' => null,
            'address' => 'Some address',
            'educational_attainment' => 'College',
            'last_medical_examination' => '2024-01-01',
        ]);

        expect($volunteer->fresh()->isProfileIncomplete())->toBeTrue();
    });

    it('returns true when related records are missing', function (): void {
        $volunteer = Volunteer::factory()->create();

        // No positions, availabilities, or emergency contact attached
        expect($volunteer->isProfileIncomplete())->toBeTrue();
    });

    it('returns false when all required fields and relations are present', function (): void {
        $volunteer = Volunteer::factory()->create();

        $position = Position::firstOrCreate(['name' => 'Test Position']);
        $availability = Availability::firstOrCreate(['name' => 'Weekends']);
        $emergencyContact = EmergencyContact::firstOrCreate([
            'name' => 'Test Contact',
            'phone_number' => '09123456789',
            'relationship' => 'Friend',
        ]);

        $volunteer->positions()->attach($position->position_id);
        $volunteer->availabilities()->attach($availability->availability_id);
        $volunteer->emergency_contact_id = $emergencyContact->emergency_contact_id;
        $volunteer->save();

        expect($volunteer->fresh()->isProfileIncomplete())->toBeFalse();
    });
});
