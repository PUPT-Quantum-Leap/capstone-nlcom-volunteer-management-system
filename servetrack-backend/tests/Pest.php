<?php

/*
|--------------------------------------------------------------------------
| Test Case
|--------------------------------------------------------------------------
|
| The closure you provide to your test functions is always bound to a specific PHPUnit test
| case class. By default, that class is "PHPUnit\Framework\TestCase". Of course, you may
| need to change it using the "pest()" function to bind a different classes or traits.
|
*/

pest()->extend(Tests\TestCase::class)
    ->use(Illuminate\Foundation\Testing\RefreshDatabase::class)
    ->in('Feature');

/*
|--------------------------------------------------------------------------
| Expectations
|--------------------------------------------------------------------------
|
| When you're writing tests, you often need to check that values meet certain conditions. The
| "expect()" function gives you access to a set of "expectations" methods that you can use
| to assert different things. Of course, you may extend the Expectation API at any time.
|
*/

expect()->extend('toBeOne', function () {
    return $this->toBe(1);
});

/*
|--------------------------------------------------------------------------
| Functions
|--------------------------------------------------------------------------
|
| While Pest is very powerful out-of-the-box, you may have some testing code specific to your
| project that you don't want to repeat in every file. Here you can also expose helpers as
| global functions to help you to reduce the number of lines of code in your test files.
|
*/

use App\Models\User;
use App\Models\Volunteer;

function createVolunteerUser(array $userOverrides = [], array $volunteerOverrides = []): array
{
    $user = User::factory()->create($userOverrides);
    $volunteer = Volunteer::factory()->create(
        array_merge(['user_id' => $user->id], $volunteerOverrides)
    );

    return ['user' => $user, 'volunteer' => $volunteer];
}

function baseProfileData(Volunteer $volunteer): array
{
    return [
        'firstName' => $volunteer->first_name,
        'lastName' => $volunteer->last_name,
        'facebookName' => $volunteer->facebook_name,
        'email' => $volunteer->email,
        'mobileNumber' => $volunteer->mobile_number,
        'birthdate' => $volunteer->birthdate->format('Y-m-d'),
        'completeAddress' => $volunteer->address,
        'lastMedicalExam' => $volunteer->last_medical_examination->format('Y-m-d'),
        'educationalAttainment' => $volunteer->educational_attainment,
        'volunteerPreference' => 'wherever-needed',
        'availability' => 'weekends',
        'partOfLifegroup' => 'no',
        'leadingLifegroup' => 'no',
        'emergencyContactName' => 'Jane Doe',
        'emergencyContactNumber' => '09123456789',
        'emergencyContactRelationship' => 'friend',
    ];
}
