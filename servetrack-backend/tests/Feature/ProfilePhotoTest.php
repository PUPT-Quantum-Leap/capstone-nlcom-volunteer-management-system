<?php

use App\Models\User;
use App\Models\Volunteer;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;

describe('Profile Photo Upload', function (): void {
    beforeEach(function (): void {
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
        // Upload first photo
        $oldPhoto = UploadedFile::fake()->image('old.jpg');
        $this->postJson('/api/volunteer/profile/photo', ['photo' => $oldPhoto])
            ->assertSuccessful();

        $oldPath = $this->volunteer->fresh()->profile_photo;

        // Upload replacement photo
        $newPhoto = UploadedFile::fake()->image('new.jpg');
        $this->postJson('/api/volunteer/profile/photo', ['photo' => $newPhoto])
            ->assertSuccessful();

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
