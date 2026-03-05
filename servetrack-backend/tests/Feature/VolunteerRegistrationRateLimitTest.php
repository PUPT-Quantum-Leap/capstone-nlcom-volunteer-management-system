<?php

namespace Tests\Feature;

use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class VolunteerRegistrationRateLimitTest extends TestCase
{
    use RefreshDatabase;

    public function test_volunteer_registration_is_rate_limited()
    {
        $payload = [
            'firstName' => 'Test',
            'lastName' => 'User',
            'email' => 'test@example.com',
            'mobileNumber' => '09123456789',
            'birthdate' => '2000-01-01',
            'completeAddress' => '123 Test St',
            'lastMedicalExam' => '2023-01-01',
            'educationalAttainment' => 'High School',
            'volunteerPreference' => 'Events',
            'password' => 'Password123!',
            'confirmPassword' => 'Password123!',
        ];

        // Make 10 requests (throttle:10,1)
        for ($i = 0; $i < 10; $i++) {
            $payload['email'] = "test{$i}@example.com";
            $response = $this->postJson('/api/volunteer/register', $payload);
            // It might fail validation, but it still consumes a rate limit attempt
            // because rate limit runs before validation.
        }

        // The 11th request should be rate limited (429 Too Many Requests)
        $payload['email'] = 'test11@example.com';
        $response = $this->postJson('/api/volunteer/register', $payload);

        $response->assertStatus(429);
    }
}
