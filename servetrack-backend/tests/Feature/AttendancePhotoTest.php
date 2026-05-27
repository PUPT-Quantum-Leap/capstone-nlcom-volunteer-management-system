<?php

use App\Models\AttendancePhoto;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Artisan;
use Illuminate\Support\Facades\Storage;

uses(RefreshDatabase::class);

describe('Attendance Photo & Exports Management', function (): void {
    beforeEach(function (): void {
        $this->admin = User::factory()->admin()->create();
        $this->actingAs($this->admin);
        Storage::fake('public');

        // Create attendance records to test exports
        $this->volunteer = App\Models\Volunteer::factory()->create();
        $this->location = App\Models\Location::factory()->create();
        $this->rsvp = App\Models\Rsvp::factory()->create([
            'status' => 'active',
            'date' => now()->toDateString(),
            'location_id' => $this->location->location_id,
            'event_location' => $this->location->full_address,
        ]);
        $this->shift = App\Models\TimeSlot::factory()->create([
            'text' => '08:00 AM - 12:00 PM',
        ]);
        $this->rsvp->shifts()->attach($this->shift->time_slot_id, [
            'time_slot' => $this->shift->text,
            'capacity' => 10,
        ]);
        $this->rsvpResponse = App\Models\RsvpResponse::factory()->create([
            'rsvp_id' => $this->rsvp->rsvp_id,
            'volunteer_id' => $this->volunteer->volunteer_id,
            'time_slot_id' => $this->shift->time_slot_id,
            'attendance_status' => 'checked_in',
        ]);
    });

    it('uploads and compresses attendance photo', function (): void {
        if (extension_loaded('gd')) {
            $file = UploadedFile::fake()->image('test_attendance.jpg');
        } else {
            // Create a valid 1x1 dummy JPEG without GD
            $jpegHex = 'FFD8FFE000104A46494600010101006000600000FFDB004300080606070605080707070909080A0C140D0C0B0B0C1912130F141D1A1F1E1D1A1C1C20242E2720222C231C1C2837292C30313434341F27393D38323C2E333432FFC0000B080001000101011100FFC4001F0000010501110101010100000000000000000102030405060708090A0BFFC400B5100002010303020403050504040000017D01020304051100122131410613516107227114328191A1082342B1C11552D1F02433627282090A161718191A25262728292A3435363738393A434445464748494A535455565758595A636465666768696A737475767778797A838485868788898A92939495969798999A9B9C9D9E9FA2A3A4A5A6A7A8A9B2B3B4B5B6B7B8B9CACBCCCDCECFD2D3D4D5D6D7D8D9E2E3E4E5E6E7E8E9F2F3F4F5F6F7F8F9FAFFDA000C03010002110311003F00B2C0077FFF00D9';
            $tempFile = tempnam(sys_get_temp_dir(), 'test_img_');
            file_put_contents($tempFile, hex2bin($jpegHex));
            $file = new UploadedFile($tempFile, 'test_attendance.jpg', 'image/jpeg', null, true);
        }

        $response = $this->postJson('/api/attendance-photos', [
            'photo' => $file,
        ]);

        $response->assertStatus(201)
            ->assertJsonPath('success', true)
            ->assertJsonPath('message', 'Photo uploaded successfully. It will be archived after 30 days.');

        $photoData = $response->json('data.photo');
        expect($photoData['file_path'])->not->toBeNull();

        // Verify the file was stored on disk
        Storage::disk('public')->assertExists($photoData['file_path']);

        // Check image compression if GD is loaded
        if (extension_loaded('gd')) {
            $fullPath = Storage::disk('public')->path($photoData['file_path']);
            $size = getimagesize($fullPath);
            expect($size[0])->toBeLessThanOrEqual(1200);
            expect($size[1])->toBeLessThanOrEqual(1200);
        }
    });

    it('archives photos older than 30 days', function (): void {
        // Photo uploaded 35 days ago (should archive)
        $oldPhoto = AttendancePhoto::create([
            'file_path' => 'attendance-photos/old.jpg',
            'original_filename' => 'old.jpg',
            'uploaded_at' => now()->subDays(35),
            'uploaded_by' => $this->admin->id,
        ]);

        // Photo uploaded 10 days ago (should NOT archive)
        $recentPhoto = AttendancePhoto::create([
            'file_path' => 'attendance-photos/recent.jpg',
            'original_filename' => 'recent.jpg',
            'uploaded_at' => now()->subDays(10),
            'uploaded_by' => $this->admin->id,
        ]);

        // Run the archiving command
        Artisan::call('attendance:archive-photos');

        $oldPhoto->refresh();
        $recentPhoto->refresh();

        expect($oldPhoto->isArchived())->toBeTrue();
        expect($recentPhoto->isArchived())->toBeFalse();
    });

    it('exports attendance PDF', function (): void {
        $response = $this->get('/api/admin/attendance/export/pdf');

        $response->assertSuccessful();
        $response->assertHeader('Content-Type', 'application/pdf');
        expect($response->headers->get('Content-Disposition'))->toContain('attachment; filename="attendance-report-');
    });

    it('exports attendance Excel', function (): void {
        $response = $this->get('/api/admin/attendance/export/excel');

        $response->assertSuccessful();
        $response->assertHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        expect($response->headers->get('Content-Disposition'))->toContain('attachment; filename="attendance-report-');
    });

    it('prevents editing attendance for events older than 1 week', function (): void {
        // Create an event that is 8 days old
        $oldRsvp = App\Models\Rsvp::factory()->create([
            'status' => 'active',
            'date' => now()->subDays(8)->toDateString(),
            'location_id' => $this->location->location_id,
            'event_location' => $this->location->full_address,
        ]);

        $oldRsvpResponse = App\Models\RsvpResponse::factory()->create([
            'rsvp_id' => $oldRsvp->rsvp_id,
            'volunteer_id' => $this->volunteer->volunteer_id,
            'time_slot_id' => $this->shift->time_slot_id,
            'attendance_status' => 'checked_in',
        ]);

        $response = $this->postJson('/api/admin/attendance-status', [
            'rsvp_response_id' => $oldRsvpResponse->rsvp_response_id,
            'status' => 'absent',
        ]);

        $response->assertStatus(422)
            ->assertJsonPath('success', false)
            ->assertJsonPath('message', 'Attendance for events older than 1 week cannot be modified.');
    });
});
