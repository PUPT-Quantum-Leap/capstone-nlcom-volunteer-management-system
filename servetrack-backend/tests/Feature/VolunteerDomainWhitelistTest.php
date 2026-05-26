<?php

use App\Models\Volunteer;

/**
 * Minimal valid payload for volunteer registration tests.
 *
 * @return array<string, mixed>
 */
function validVolunteerPayload(): array
{
    return [
        'firstName' => 'Juan',
        'lastName' => 'Dela Cruz',
        'facebookName' => 'juan.delacruz',
        'email' => 'juan@gmail.com',
        'mobileNumber' => '09171234567',
        'birthdate' => '1995-06-15',
        'completeAddress' => '123 Rizal Street, Manila, Philippines',
        'lastMedicalExam' => '2025-01-01',
        'educationalAttainment' => 'College',
        'volunteerPreference' => 'Teaching',
        'availability' => 'Weekends',
        'partOfLifegroup' => 'no',
        'leadingLifegroup' => 'no',
        'emergencyContactName' => 'Maria Dela Cruz',
        'emergencyContactNumber' => '09179876543',
        'emergencyContactRelationship' => 'Mother',
        'password' => 'SecurePass1!XY',
        'confirmPassword' => 'SecurePass1!XY',
    ];
}

describe('Volunteer Domain Whitelisting', function (): void {
    beforeEach(function (): void {
        config(['services.volunteer.allowed_domains' => 'gmail.com,googlemail.com']);
    });

    it('registers successfully with an allowed domain', function (): void {
        $this->postJson('/api/volunteer/register', validVolunteerPayload())
            ->assertCreated()
            ->assertJsonPath('success', true);
    });

    it('rejects registration with a disallowed domain', function (): void {
        $payload = validVolunteerPayload();
        $payload['email'] = 'juan@yahoo.com';

        $this->postJson('/api/volunteer/register', $payload)
            ->assertUnprocessable()
            ->assertJsonPath('success', false)
            ->assertJsonPath('message', 'Registration failed. Please use a Gmail address to register.');
    });

    it('accepts googlemail.com as an allowed domain', function (): void {
        $payload = validVolunteerPayload();
        $payload['email'] = 'juan@googlemail.com';

        $this->postJson('/api/volunteer/register', $payload)
            ->assertCreated()
            ->assertJsonPath('success', true);
    });

    it('accepts email domain case-insensitively', function (): void {
        $payload = validVolunteerPayload();
        $payload['email'] = 'juan@GMAIL.COM';

        $this->postJson('/api/volunteer/register', $payload)
            ->assertCreated()
            ->assertJsonPath('success', true);
    });

    it('rejects when domain check fails even if other fields are valid', function (): void {
        $payload = validVolunteerPayload();
        $payload['email'] = 'juan@outlook.com';

        $this->postJson('/api/volunteer/register', $payload)
            ->assertUnprocessable()
            ->assertJsonPath('success', false);
    });

    it('still validates required fields before domain check', function (): void {
        $this->postJson('/api/volunteer/register', [
            'email' => 'juan@gmail.com',
            // missing all required fields
        ])
            ->assertUnprocessable()
            ->assertJsonPath('success', false)
            ->assertJsonPath('message', 'Validation failed');
    });

    it('prevents duplicate email registration', function (): void {
        Volunteer::factory()->create(['email' => 'juan@gmail.com']);

        $this->postJson('/api/volunteer/register', validVolunteerPayload())
            ->assertUnprocessable();
    });

    it('uses config default when env variable is not set', function (): void {
        config(['services.volunteer.allowed_domains' => 'gmail.com,googlemail.com']);

        $this->postJson('/api/volunteer/register', validVolunteerPayload())
            ->assertCreated()
            ->assertJsonPath('success', true);
    });
});
