<?php

use App\Models\User;
use App\Models\Volunteer;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;

describe('Profile Photo Upload', function (): void {
    beforeEach(function (): void {
        if (! function_exists('imagecreatetruecolor')) {
            $this->markTestSkipped('GD extension is required for image tests.');
        }
        Storage::fake('public');
        $this->user = User::factory()->create();
        $this->volunteer = Volunteer::factory()->create(['user_id' => $this->user->id]);
        $this->actingAs($this->user);
    });

    it('uploads a valid profile photo', function (): void {
        $photo = UploadedFile::fake()->image('avatar.jpg', 400, 400);

        $this->postJson('/api/volunteer/profile/photo', ['photo' => $photo])
            ->assertSuccessful()
            ->assertJsonPath('success', true)
            ->assertJsonStructure(['data' => ['profile_photo_url']]);

        $this->volunteer->refresh();
        expect($this->volunteer->profile_photo)->not->toBeNull();
        Storage::disk('public')->assertExists($this->volunteer->profile_photo);
    });

    it('deletes old photo when uploading new one', function (): void {
        $oldPhoto = UploadedFile::fake()->image('old.jpg');
        $this->postJson('/api/volunteer/profile/photo', ['photo' => $oldPhoto])
            ->assertSuccessful();

        $oldPath = $this->volunteer->fresh()->profile_photo;

        $newPhoto = UploadedFile::fake()->image('new.jpg');
        $this->postJson('/api/volunteer/profile/photo', ['photo' => $newPhoto])
            ->assertSuccessful();

        Storage::disk('public')->assertMissing($oldPath);
    });

    it('deletes old photo when profile is updated with gender/persona or clearPhoto true', function (): void {
        $oldPhoto = UploadedFile::fake()->image('old.jpg');
        $this->postJson('/api/volunteer/profile/photo', ['photo' => $oldPhoto])
            ->assertSuccessful();

        $oldPath = $this->volunteer->fresh()->profile_photo;
        Storage::disk('public')->assertExists($oldPath);

        // Put request to update profile with a gender (persona)
        $this->putJson('/api/volunteer/profile', [
            'firstName' => 'John',
            'lastName' => 'Doe',
            'facebookName' => 'johndoe',
            'email' => $this->user->email,
            'mobileNumber' => '09123456789',
            'birthdate' => '1990-01-01',
            'completeAddress' => '123 Test Street City Philippines',
            'lastMedicalExam' => '2025-01-01',
            'gender' => 'boy',
            'educationalAttainment' => 'College Graduate',
            'volunteerPreference' => 'relief-operations',
            'availability' => 'Anytime / On Call',
            'partOfLifegroup' => 'no',
            'leadingLifegroup' => 'no',
            'emergencyContactName' => 'Jane Doe',
            'emergencyContactNumber' => '09987654321',
            'emergencyContactRelationship' => 'Mother',
            'clearPhoto' => true,
        ])->assertSuccessful();

        $this->volunteer->refresh();
        expect($this->volunteer->profile_photo)->toBeNull();
        Storage::disk('public')->assertMissing($oldPath);
    });

    it('rejects non-image files', function (): void {
        $file = UploadedFile::fake()->create('document.pdf', 100, 'application/pdf');

        $this->postJson('/api/volunteer/profile/photo', ['photo' => $file])
            ->assertUnprocessable()
            ->assertJsonValidationErrors(['photo']);
    });

    it('rejects files exceeding 2MB', function (): void {
        $photo = UploadedFile::fake()->image('large.jpg')->size(3000);

        $this->postJson('/api/volunteer/profile/photo', ['photo' => $photo])
            ->assertUnprocessable()
            ->assertJsonValidationErrors(['photo']);
    });

    it('rejects request without photo', function (): void {
        $this->postJson('/api/volunteer/profile/photo', [])
            ->assertUnprocessable()
            ->assertJsonValidationErrors(['photo']);
    });

    it('accepts jpg, png, and webp formats', function (string $extension): void {
        $photo = UploadedFile::fake()->image("avatar.{$extension}", 200, 200);

        $this->postJson('/api/volunteer/profile/photo', ['photo' => $photo])
            ->assertSuccessful();
    })->with(['jpg', 'png', 'webp']);

    it('denies unauthenticated access', function (): void {
        $this->app->make('auth')->forgetGuards();

        $photo = UploadedFile::fake()->image('avatar.jpg');

        $this->postJson('/api/volunteer/profile/photo', ['photo' => $photo])
            ->assertUnauthorized();
    });
});
