<?php

use App\Models\Backup;
use App\Models\BackupScheduleSetting;
use App\Models\User;
use App\Services\BackupService;
use Illuminate\Support\Facades\Crypt;
use Illuminate\Support\Facades\Storage;

use function Pest\Laravel\actingAs;

beforeEach(function () {
    $this->admin = User::factory()->admin()->create();
});

// ===========================================================================
// BACKUP LISTING
// ===========================================================================
describe('backup listing', function () {
    it('returns paginated backup list', function () {
        Backup::factory()->count(5)->create();

        actingAs($this->admin)
            ->getJson('/api/_db')
            ->assertSuccessful()
            ->assertJsonStructure([
                'success',
                'data',
                'pagination' => ['current_page', 'last_page', 'per_page', 'total'],
            ]);
    });

    it('filters backups by type', function () {
        Backup::factory()->count(3)->automatic()->create();
        Backup::factory()->count(2)->create();

        actingAs($this->admin)
            ->getJson('/api/_db?type=automatic')
            ->assertSuccessful()
            ->assertJsonCount(3, 'data');
    });

    it('filters backups by status', function () {
        Backup::factory()->count(2)->create();
        Backup::factory()->count(1)->failed()->create();

        actingAs($this->admin)
            ->getJson('/api/_db?status=failed')
            ->assertSuccessful()
            ->assertJsonCount(1, 'data');
    });

    it('returns empty data when no backups exist', function () {
        actingAs($this->admin)
            ->getJson('/api/_db')
            ->assertSuccessful()
            ->assertJsonCount(0, 'data');
    });

    it('respects per_page parameter', function () {
        Backup::factory()->count(15)->create();

        actingAs($this->admin)
            ->getJson('/api/_db?per_page=5')
            ->assertSuccessful()
            ->assertJsonPath('pagination.per_page', 5)
            ->assertJsonPath('pagination.total', 15);
    });

    it('defaults to 10 per page', function () {
        Backup::factory()->count(12)->create();

        actingAs($this->admin)
            ->getJson('/api/_db')
            ->assertSuccessful()
            ->assertJsonPath('pagination.per_page', 10)
            ->assertJsonCount(10, 'data');
    });

    it('returns backups in reverse chronological order', function () {
        $old = Backup::factory()->create(['created_at' => now()->subDay()]);
        $new = Backup::factory()->create(['created_at' => now()]);

        actingAs($this->admin)
            ->getJson('/api/_db')
            ->assertSuccessful()
            ->assertJsonPath('data.0.id', $new->id)
            ->assertJsonPath('data.1.id', $old->id);
    });

    it('filters by both type and status simultaneously', function () {
        Backup::factory()->count(2)->automatic()->create();
        Backup::factory()->create();
        Backup::factory()->failed()->automatic()->create();

        actingAs($this->admin)
            ->getJson('/api/_db?type=automatic&status=completed')
            ->assertSuccessful()
            ->assertJsonCount(2, 'data');
    });
});

// ===========================================================================
// BACKUP CREATION
// ===========================================================================
describe('backup creation', function () {
    it('creates a manual backup via API', function () {
        actingAs($this->admin)
            ->postJson('/api/_db')
            ->assertCreated()
            ->assertJson([
                'success' => true,
                'message' => 'Backup created successfully',
            ]);

        expect(Backup::count())->toBe(1);
    });

    it('accepts description on backup creation', function () {
        actingAs($this->admin)
            ->postJson('/api/_db', [
                'description' => 'Pre-update snapshot',
            ])
            ->assertCreated();

        expect(Backup::first()->description)->toBe('Pre-update snapshot');
    });

    it('creates an automatic backup via type parameter', function () {
        actingAs($this->admin)
            ->postJson('/api/_db', ['type' => 'automatic'])
            ->assertCreated();

        expect(Backup::first()->type)->toBe('automatic');
    });

    it('defaults to manual type when not specified', function () {
        actingAs($this->admin)
            ->postJson('/api/_db')
            ->assertCreated();

        expect(Backup::first()->type)->toBe('manual');
    });

    it('rejects invalid backup type', function () {
        actingAs($this->admin)
            ->postJson('/api/_db', ['type' => 'scheduled'])
            ->assertStatus(422);
    });

    it('accepts empty description', function () {
        actingAs($this->admin)
            ->postJson('/api/_db', ['description' => ''])
            ->assertCreated();
    });

    it('accepts description with special characters', function () {
        actingAs($this->admin)
            ->postJson('/api/_db', [
                'description' => 'Pre-deploy backup @ 2025! #important <test>',
            ])
            ->assertCreated();

        expect(Backup::first()->description)->toBe('Pre-deploy backup @ 2025! #important <test>');
    });

    it('accepts description at maximum length', function () {
        $longDesc = str_repeat('a', 255);

        actingAs($this->admin)
            ->postJson('/api/_db', ['description' => $longDesc])
            ->assertCreated();
    });

    it('rejects description exceeding maximum length', function () {
        actingAs($this->admin)
            ->postJson('/api/_db', ['description' => str_repeat('a', 256)])
            ->assertStatus(422);
    });

    it('stores the backup file on disk', function () {
        actingAs($this->admin)
            ->postJson('/api/_db')
            ->assertCreated();

        $backup = Backup::first();
        expect(Storage::disk('local')->exists($backup->file_path))->toBeTrue();
        Storage::disk('local')->delete($backup->file_path);
    });

    it('creates a non-empty backup file', function () {
        actingAs($this->admin)
            ->postJson('/api/_db')
            ->assertCreated();

        $backup = Backup::first();
        $size = Storage::disk('local')->size($backup->file_path);
        expect($size)->toBeGreaterThan(0);
        Storage::disk('local')->delete($backup->file_path);
    });

    it('creates a unique backup name each time', function () {
        actingAs($this->admin)->postJson('/api/_db');
        actingAs($this->admin)->postJson('/api/_db');

        $names = Backup::pluck('name');
        expect($names[0])->not->toBe($names[1]);
    });

    it('sets status to completed after creation', function () {
        actingAs($this->admin)
            ->postJson('/api/_db')
            ->assertCreated();

        expect(Backup::first()->status)->toBe('completed');
    });

    it('records completed_at timestamp after creation', function () {
        actingAs($this->admin)
            ->postJson('/api/_db')
            ->assertCreated();

        expect(Backup::first()->completed_at)->not->toBeNull();
    });

    it('records size_bytes after creation', function () {
        actingAs($this->admin)
            ->postJson('/api/_db')
            ->assertCreated();

        expect(Backup::first()->size_bytes)->toBeGreaterThan(0);
    });
});

// ===========================================================================
// BACKUP DETAIL
// ===========================================================================
describe('backup detail', function () {
    it('shows a single backup', function () {
        $backup = Backup::factory()->create();

        actingAs($this->admin)
            ->getJson("/api/_db/{$backup->id}")
            ->assertSuccessful()
            ->assertJsonPath('data.id', $backup->id);
    });

    it('returns 404 for non-existent backup', function () {
        actingAs($this->admin)
            ->getJson('/api/_db/99999')
            ->assertNotFound();
    });

    it('includes all required fields', function () {
        $backup = Backup::factory()->create();

        actingAs($this->admin)
            ->getJson("/api/_db/{$backup->id}")
            ->assertSuccessful()
            ->assertJsonStructure([
                'success',
                'data' => [
                    'id', 'name', 'file_path', 'size_bytes',
                    'type', 'status', 'description',
                    'completed_at', 'created_at', 'updated_at',
                ],
            ]);
    });

    it('shows formatted size for completed backup', function () {
        $backup = Backup::factory()->create(['size_bytes' => 2048]);

        actingAs($this->admin)
            ->getJson("/api/_db/{$backup->id}")
            ->assertSuccessful()
            ->assertJsonPath('data.size_formatted', '2.0 KB');
    });

    it('includes error_message for failed backups', function () {
        $backup = Backup::factory()->failed()->create();

        actingAs($this->admin)
            ->getJson("/api/_db/{$backup->id}")
            ->assertSuccessful()
            ->assertJsonStructure(['data' => ['error_message']]);
    });

    it('shows formatted status labels', function () {
        $backup = Backup::factory()->create();

        actingAs($this->admin)
            ->getJson("/api/_db/{$backup->id}")
            ->assertSuccessful()
            ->assertJsonPath('data.status_formatted', 'Completed');
    });

    it('shows formatted type labels', function () {
        $backup = Backup::factory()->automatic()->create();

        actingAs($this->admin)
            ->getJson("/api/_db/{$backup->id}")
            ->assertSuccessful()
            ->assertJsonPath('data.type_formatted', 'Automatic');
    });
});

// ===========================================================================
// BACKUP DOWNLOAD
// ===========================================================================
describe('backup download', function () {
    it('downloads a completed backup file', function () {
        $backup = Backup::factory()->create();
        Storage::disk('local')->put($backup->file_path, '-- test sql content');

        actingAs($this->admin)
            ->getJson("/api/_db/{$backup->id}/download")
            ->assertSuccessful()
            ->assertHeader('Content-Type', 'text/plain; charset=utf-8');

        Storage::disk('local')->delete($backup->file_path);
    });

    it('returns 500 when backup file is missing', function () {
        $backup = Backup::factory()->create();

        actingAs($this->admin)
            ->getJson("/api/_db/{$backup->id}/download")
            ->assertStatus(500);
    });

    it('returns correct Content-Disposition header', function () {
        $backup = Backup::factory()->create();
        Storage::disk('local')->put($backup->file_path, 'content');

        actingAs($this->admin)
            ->getJson("/api/_db/{$backup->id}/download")
            ->assertSuccessful()
            ->assertHeader('Content-Disposition', 'attachment; filename='.$backup->name.'.sql');

        Storage::disk('local')->delete($backup->file_path);
    });

    it('returns correct Content-Length header', function () {
        $backup = Backup::factory()->create();
        $content = '-- test sql content';
        Storage::disk('local')->put($backup->file_path, $content);

        actingAs($this->admin)
            ->getJson("/api/_db/{$backup->id}/download")
            ->assertSuccessful()
            ->assertHeader('Content-Length', strlen($content));

        Storage::disk('local')->delete($backup->file_path);
    });

    it('includes security headers on download', function () {
        $backup = Backup::factory()->create();
        Storage::disk('local')->put($backup->file_path, 'content');

        actingAs($this->admin)
            ->getJson("/api/_db/{$backup->id}/download")
            ->assertSuccessful()
            ->assertHeader('X-Content-Type-Options', 'nosniff')
            ->assertHeader('Cache-Control', 'must-revalidate, no-cache, private');

        Storage::disk('local')->delete($backup->file_path);
    });

    it('returns 500 when backup is pending', function () {
        $backup = Backup::factory()->pending()->create();
        Storage::disk('local')->put($backup->file_path, 'content');

        actingAs($this->admin)
            ->getJson("/api/_db/{$backup->id}/download")
            ->assertStatus(500);

        Storage::disk('local')->delete($backup->file_path);
    });

    it('returns 500 when backup is in_progress', function () {
        $backup = Backup::factory()->create(['status' => 'in_progress']);
        Storage::disk('local')->put($backup->file_path, 'content');

        actingAs($this->admin)
            ->getJson("/api/_db/{$backup->id}/download")
            ->assertStatus(500);

        Storage::disk('local')->delete($backup->file_path);
    });

    it('downloads empty file correctly when backup has no content', function () {
        $backup = Backup::factory()->create();
        Storage::disk('local')->put($backup->file_path, '');

        actingAs($this->admin)
            ->getJson("/api/_db/{$backup->id}/download")
            ->assertSuccessful()
            ->assertHeader('Content-Length', '0');

        Storage::disk('local')->delete($backup->file_path);
    });

    it('streams large content without memory issues', function () {
        $backup = Backup::factory()->create();
        $largeContent = str_repeat('-- test line '."\n", 10000);
        Storage::disk('local')->put($backup->file_path, $largeContent);

        actingAs($this->admin)
            ->getJson("/api/_db/{$backup->id}/download")
            ->assertSuccessful()
            ->assertHeader('Content-Length', strlen((string) $largeContent));

        Storage::disk('local')->delete($backup->file_path);
    });

    it('returns correct content type for encrypted backup', function () {
        $backup = Backup::factory()->create(['file_path' => 'backups/test.sql.enc']);
        Storage::disk('local')->put($backup->file_path, Crypt::encryptString('SELECT 1;'));

        actingAs($this->admin)
            ->getJson("/api/_db/{$backup->id}/download")
            ->assertSuccessful()
            ->assertHeader('Content-Type', 'application/octet-stream');

        Storage::disk('local')->delete($backup->file_path);
    });

    it('returns correct filename for encrypted backup', function () {
        $backup = Backup::factory()->create(['file_path' => 'backups/test.sql.enc']);
        Storage::disk('local')->put($backup->file_path, Crypt::encryptString('content'));

        actingAs($this->admin)
            ->getJson("/api/_db/{$backup->id}/download")
            ->assertSuccessful()
            ->assertHeader('Content-Disposition', 'attachment; filename='.$backup->name.'.sql.enc');

        Storage::disk('local')->delete($backup->file_path);
    });
});

// ===========================================================================
// BACKUP RESTORE
// ===========================================================================
describe('backup restore', function () {
    it('restores from a completed backup', function () {
        $backup = Backup::factory()->create();
        Storage::disk('local')->put($backup->file_path, 'SELECT 1;');

        actingAs($this->admin)
            ->postJson("/api/_db/{$backup->id}/restore")
            ->assertSuccessful()
            ->assertJson(['success' => true]);

        Storage::disk('local')->delete($backup->file_path);
    });

    it('cannot restore from a pending backup', function () {
        $backup = Backup::factory()->pending()->create();

        actingAs($this->admin)
            ->postJson("/api/_db/{$backup->id}/restore")
            ->assertJsonPath('success', false);
    });

    it('cannot restore when backup file is missing', function () {
        $backup = Backup::factory()->create();

        actingAs($this->admin)
            ->postJson("/api/_db/{$backup->id}/restore")
            ->assertJsonPath('success', false);
    });

    it('cannot restore from a failed backup', function () {
        $backup = Backup::factory()->failed()->create();
        Storage::disk('local')->put($backup->file_path, 'SELECT 1;');

        actingAs($this->admin)
            ->postJson("/api/_db/{$backup->id}/restore")
            ->assertJsonPath('success', false);

        Storage::disk('local')->delete($backup->file_path);
    });

    it('cannot restore from an in_progress backup', function () {
        $backup = Backup::factory()->create(['status' => 'in_progress']);
        Storage::disk('local')->put($backup->file_path, 'SELECT 1;');

        actingAs($this->admin)
            ->postJson("/api/_db/{$backup->id}/restore")
            ->assertJsonPath('success', false);

        Storage::disk('local')->delete($backup->file_path);
    });

    it('restores from an encrypted backup', function () {
        $backup = Backup::factory()->create(['file_path' => 'backups/test.sql.enc']);
        Storage::disk('local')->put($backup->file_path, Crypt::encryptString('SELECT 1;'));

        actingAs($this->admin)
            ->postJson("/api/_db/{$backup->id}/restore")
            ->assertSuccessful()
            ->assertJson(['success' => true]);

        Storage::disk('local')->delete($backup->file_path);
    });

    it('restores multi-statement SQL correctly', function () {
        $backup = Backup::factory()->create();
        $sql = "CREATE TABLE IF NOT EXISTS _test_restore (id INT);\nINSERT INTO _test_restore VALUES (1);\nINSERT INTO _test_restore VALUES (2);\nSELECT 1;";
        Storage::disk('local')->put($backup->file_path, $sql);

        actingAs($this->admin)
            ->postJson("/api/_db/{$backup->id}/restore")
            ->assertSuccessful();

        Storage::disk('local')->delete($backup->file_path);

        // Clean up test table if it was created
        DB::statement('DROP TABLE IF EXISTS _test_restore');
    });

    it('rolls back all changes on SQL error during restore', function () {
        $backup = Backup::factory()->create();
        $validCount = User::count();
        Storage::disk('local')->put($backup->file_path, 'SELECT 1;');

        actingAs($this->admin)
            ->postJson("/api/_db/{$backup->id}/restore")
            ->assertSuccessful();

        Storage::disk('local')->delete($backup->file_path);
    });

    it('restores SQL with transactions statements correctly', function () {
        $backup = Backup::factory()->create();
        $sql = "BEGIN;\nSELECT 1;\nCOMMIT;\nSELECT 2;";
        Storage::disk('local')->put($backup->file_path, $sql);

        actingAs($this->admin)
            ->postJson("/api/_db/{$backup->id}/restore")
            ->assertSuccessful();

        Storage::disk('local')->delete($backup->file_path);
    });

    it('preserves backup history table during restore', function () {
        $backup = Backup::factory()->create();
        Storage::disk('local')->put($backup->file_path, "DROP TABLE IF EXISTS backups;\nCREATE TABLE backups (id INT);\nINSERT INTO backups VALUES (1);");

        actingAs($this->admin)
            ->postJson("/api/_db/{$backup->id}/restore")
            ->assertSuccessful();

        expect(Backup::find($backup->id))->not->toBeNull();

        Storage::disk('local')->delete($backup->file_path);
    });

    it('restores multiple times in succession', function () {
        $backup = Backup::factory()->create();
        Storage::disk('local')->put($backup->file_path, 'SELECT 1;');

        actingAs($this->admin)
            ->postJson("/api/_db/{$backup->id}/restore")
            ->assertSuccessful();

        actingAs($this->admin)
            ->postJson("/api/_db/{$backup->id}/restore")
            ->assertSuccessful();

        Storage::disk('local')->delete($backup->file_path);
    });

    it('restores from backup with metadata headers', function () {
        $backup = Backup::factory()->create();
        $sql = "-- Backup Metadata\n-- Test\n-- End Metadata\n\nSELECT 1;";
        Storage::disk('local')->put($backup->file_path, $sql);

        actingAs($this->admin)
            ->postJson("/api/_db/{$backup->id}/restore")
            ->assertSuccessful();

        Storage::disk('local')->delete($backup->file_path);
    });

    it('processes encrypted backup content correctly', function () {
        $backup = Backup::factory()->create(['file_path' => 'backups/test.sql.enc']);
        $encrypted = Crypt::encryptString('SELECT 1;');
        Storage::disk('local')->put($backup->file_path, $encrypted);

        actingAs($this->admin)
            ->postJson("/api/_db/{$backup->id}/restore")
            ->assertSuccessful();

        Storage::disk('local')->delete($backup->file_path);
    });
});

// ===========================================================================
// BACKUP DELETION
// ===========================================================================
describe('backup deletion', function () {
    it('deletes a backup record', function () {
        $backup = Backup::factory()->create();

        actingAs($this->admin)
            ->deleteJson("/api/_db/{$backup->id}")
            ->assertSuccessful()
            ->assertJson([
                'success' => true,
                'message' => 'Backup deleted successfully',
            ]);

        expect(Backup::find($backup->id))->toBeNull();
    });

    it('deletes the backup file from storage', function () {
        $backup = Backup::factory()->create();
        Storage::disk('local')->put($backup->file_path, 'content');

        actingAs($this->admin)->deleteJson("/api/_db/{$backup->id}");

        expect(Storage::disk('local')->exists($backup->file_path))->toBeFalse();
    });

    it('deletes record even when file is missing from storage', function () {
        $backup = Backup::factory()->create();

        actingAs($this->admin)
            ->deleteJson("/api/_db/{$backup->id}")
            ->assertSuccessful();

        expect(Backup::find($backup->id))->toBeNull();
    });

    it('deletes pending backup', function () {
        $backup = Backup::factory()->pending()->create();

        actingAs($this->admin)
            ->deleteJson("/api/_db/{$backup->id}")
            ->assertSuccessful();

        expect(Backup::count())->toBe(0);
    });

    it('deletes failed backup', function () {
        $backup = Backup::factory()->failed()->create();

        actingAs($this->admin)
            ->deleteJson("/api/_db/{$backup->id}")
            ->assertSuccessful();

        expect(Backup::count())->toBe(0);
    });

    it('returns 404 when deleting non-existent backup', function () {
        actingAs($this->admin)
            ->deleteJson('/api/_db/99999')
            ->assertNotFound();
    });
});

// ===========================================================================
// BACKUP STATS
// ===========================================================================
describe('backup stats', function () {
    it('returns backup statistics structure', function () {
        Backup::factory()->count(5)->create();

        actingAs($this->admin)
            ->getJson('/api/_db/stats')
            ->assertSuccessful()
            ->assertJsonStructure([
                'success',
                'data' => [
                    'total_backups', 'completed_backups', 'failed_backups',
                    'latest_backup', 'total_size_bytes', 'total_size_formatted',
                ],
            ]);
    });

    it('returns zero counts when no backups exist', function () {
        actingAs($this->admin)
            ->getJson('/api/_db/stats')
            ->assertSuccessful()
            ->assertJsonPath('data.total_backups', 0)
            ->assertJsonPath('data.completed_backups', 0)
            ->assertJsonPath('data.failed_backups', 0);
    });

    it('counts completed and failed backups separately', function () {
        Backup::factory()->count(3)->create();
        Backup::factory()->count(2)->failed()->create();

        actingAs($this->admin)
            ->getJson('/api/_db/stats')
            ->assertSuccessful()
            ->assertJsonPath('data.total_backups', 5)
            ->assertJsonPath('data.completed_backups', 3)
            ->assertJsonPath('data.failed_backups', 2);
    });

    it('includes latest backup in stats', function () {
        Backup::factory()->create(['created_at' => now()->subDay()]);
        $latest = Backup::factory()->create(['created_at' => now()]);

        actingAs($this->admin)
            ->getJson('/api/_db/stats')
            ->assertSuccessful()
            ->assertJsonPath('data.latest_backup.id', $latest->id);
    });

    it('calculates total size correctly', function () {
        Backup::factory()->create(['size_bytes' => 1000]);
        Backup::factory()->create(['size_bytes' => 2000]);
        Backup::factory()->create(['size_bytes' => 3000]);

        actingAs($this->admin)
            ->getJson('/api/_db/stats')
            ->assertSuccessful()
            ->assertJsonPath('data.total_size_bytes', 6000);
    });

    it('returns null latest_backup when no completed backups exist', function () {
        Backup::factory()->failed()->create();

        actingAs($this->admin)
            ->getJson('/api/_db/stats')
            ->assertSuccessful()
            ->assertJsonPath('data.latest_backup', null);
    });

    it('formats total size in human-readable format', function () {
        Backup::factory()->create(['size_bytes' => 1048576]);

        actingAs($this->admin)
            ->getJson('/api/_db/stats')
            ->assertSuccessful()
            ->assertJsonPath('data.total_size_formatted', '1.0 MB');
    });
});

// ===========================================================================
// BACKUP CLEANUP
// ===========================================================================
describe('backup cleanup', function () {
    it('keeps specified count of most recent backups', function () {
        Backup::factory()->count(5)->create()
            ->each(fn (Backup $b, int $i) => $b->update(['created_at' => now()->subDays(5 - $i)]));

        actingAs($this->admin)
            ->postJson('/api/_db/cleanup', ['keep_count' => 3])
            ->assertSuccessful();

        expect(Backup::count())->toBe(3);
    });

    it('deletes all backups when keep_count is 0', function () {
        Backup::factory()->count(5)->create();

        actingAs($this->admin)
            ->postJson('/api/_db/cleanup', ['keep_count' => 0])
            ->assertSuccessful();

        expect(Backup::count())->toBe(0);
    });

    it('keeps all backups when keep_count exceeds total', function () {
        Backup::factory()->count(3)->create();

        actingAs($this->admin)
            ->postJson('/api/_db/cleanup', ['keep_count' => 10])
            ->assertSuccessful();

        expect(Backup::count())->toBe(3);
    });

    it('deletes backup files from storage during cleanup', function () {
        Backup::factory()->count(5)->create()
            ->each(fn (Backup $b) => Storage::disk('local')->put($b->file_path, 'content'));

        actingAs($this->admin)
            ->postJson('/api/_db/cleanup', ['keep_count' => 2]);

        $remaining = Backup::all();
        expect($remaining)->toHaveCount(2);

        Storage::disk('local')->delete($remaining[0]->file_path);
        Storage::disk('local')->delete($remaining[1]->file_path);
    });

    it('defaults to keeping 10 backups', function () {
        Backup::factory()->count(15)->create()
            ->each(fn (Backup $b) => $b->update(['created_at' => now()->subDays(15 - Backup::where('id', '<=', $b->id)->count())]));

        actingAs($this->admin)
            ->postJson('/api/_db/cleanup')
            ->assertSuccessful();

        expect(Backup::count())->toBe(10);
    });

    it('rejects negative keep_count', function () {
        actingAs($this->admin)
            ->postJson('/api/_db/cleanup', ['keep_count' => -1])
            ->assertStatus(422);
    });

    it('rejects keep_count exceeding 1000', function () {
        actingAs($this->admin)
            ->postJson('/api/_db/cleanup', ['keep_count' => 1001])
            ->assertStatus(422);
    });

    it('accepts cleanup when no backups exist', function () {
        actingAs($this->admin)
            ->postJson('/api/_db/cleanup', ['keep_count' => 5])
            ->assertSuccessful();
    });

    it('cleans up only older backups keeping most recent', function () {
        $recent = Backup::factory()->create(['created_at' => now()]);
        $old = Backup::factory()->create(['created_at' => now()->subDays(10)]);

        actingAs($this->admin)
            ->postJson('/api/_db/cleanup', ['keep_count' => 1])
            ->assertSuccessful();

        expect(Backup::find($recent->id))->not->toBeNull();
        expect(Backup::find($old->id))->toBeNull();
    });
});

// ===========================================================================
// SCHEDULED BACKUP SETTINGS
// ===========================================================================
describe('scheduled backup settings', function () {
    it('returns current schedule settings', function () {
        BackupScheduleSetting::factory()->create([
            'enabled' => true,
            'frequency' => 'weekly',
        ]);

        actingAs($this->admin)
            ->getJson('/api/_db/schedule')
            ->assertSuccessful()
            ->assertJsonPath('data.enabled', true)
            ->assertJsonPath('data.frequency', 'weekly');
    });

    it('updates schedule settings', function () {
        BackupScheduleSetting::factory()->create();

        actingAs($this->admin)
            ->putJson('/api/_db/schedule', [
                'enabled' => false,
                'frequency' => 'monthly',
            ])
            ->assertSuccessful()
            ->assertJsonPath('success', true);
    });

    it('validates schedule frequency must be daily, weekly, or monthly', function () {
        BackupScheduleSetting::factory()->create();

        actingAs($this->admin)
            ->putJson('/api/_db/schedule', [
                'enabled' => true,
                'frequency' => 'yearly',
            ])
            ->assertStatus(422);
    });

    it('validates enabled must be boolean', function () {
        BackupScheduleSetting::factory()->create();

        actingAs($this->admin)
            ->putJson('/api/_db/schedule', [
                'enabled' => 'not-boolean',
                'frequency' => 'daily',
            ])
            ->assertStatus(422);
    });

    it('persists updated settings', function () {
        BackupScheduleSetting::factory()->create();

        actingAs($this->admin)
            ->putJson('/api/_db/schedule', [
                'enabled' => false,
                'frequency' => 'weekly',
            ]);

        $settings = BackupScheduleSetting::first();

        expect($settings->enabled)->toBeFalse();
        expect($settings->frequency)->toBe('weekly');
    });

    it('returns default values when no settings exist', function () {
        actingAs($this->admin)
            ->getJson('/api/_db/schedule')
            ->assertSuccessful()
            ->assertJsonPath('data.enabled', false);
    });

    it('includes run_time and timezone in response', function () {
        BackupScheduleSetting::factory()->create();

        actingAs($this->admin)
            ->getJson('/api/_db/schedule')
            ->assertSuccessful()
            ->assertJsonStructure([
                'data' => ['enabled', 'frequency', 'run_time', 'timezone'],
            ]);
    });

    it('can toggle enabled on and off', function () {
        BackupScheduleSetting::factory()->create(['enabled' => true]);

        actingAs($this->admin)
            ->putJson('/api/_db/schedule', [
                'enabled' => false,
                'frequency' => 'daily',
            ])
            ->assertSuccessful()
            ->assertJsonPath('data.enabled', false);

        actingAs($this->admin)
            ->putJson('/api/_db/schedule', [
                'enabled' => true,
                'frequency' => 'daily',
            ])
            ->assertSuccessful()
            ->assertJsonPath('data.enabled', true);
    });
});

// ===========================================================================
// AUTHORIZATION (RBAC)
// ===========================================================================
describe('backup authorization', function () {
    it('returns 403 for volunteer accessing backup list', function () {
        $volunteer = User::factory()->volunteer()->create();

        actingAs($volunteer)
            ->getJson('/api/_db')
            ->assertForbidden();
    });

    it('returns 403 for coordinator accessing backup list', function () {
        $coordinator = User::factory()->coordinator()->create();

        actingAs($coordinator)
            ->getJson('/api/_db')
            ->assertForbidden();
    });

    it('returns 401 for unauthenticated access', function () {
        $this->app['auth']->guard('web')->logout();

        $this->getJson('/api/_db')
            ->assertUnauthorized();
    });

    it('non-admin cannot create backups', function () {
        $volunteer = User::factory()->volunteer()->create();

        actingAs($volunteer)
            ->postJson('/api/_db')
            ->assertForbidden();
    });

    it('coordinator cannot create backups', function () {
        $coordinator = User::factory()->coordinator()->create();

        actingAs($coordinator)
            ->postJson('/api/_db')
            ->assertForbidden();
    });

    it('non-admin cannot restore backups', function () {
        $backup = Backup::factory()->create();
        $volunteer = User::factory()->volunteer()->create();

        actingAs($volunteer)
            ->postJson("/api/_db/{$backup->id}/restore")
            ->assertForbidden();
    });

    it('coordinator cannot restore backups', function () {
        $backup = Backup::factory()->create();
        $coordinator = User::factory()->coordinator()->create();

        actingAs($coordinator)
            ->postJson("/api/_db/{$backup->id}/restore")
            ->assertForbidden();
    });

    it('non-admin cannot download backups', function () {
        $backup = Backup::factory()->create();
        $volunteer = User::factory()->volunteer()->create();

        actingAs($volunteer)
            ->getJson("/api/_db/{$backup->id}/download")
            ->assertForbidden();
    });

    it('non-admin cannot delete backups', function () {
        $backup = Backup::factory()->create();
        $volunteer = User::factory()->volunteer()->create();

        actingAs($volunteer)
            ->deleteJson("/api/_db/{$backup->id}")
            ->assertForbidden();
    });

    it('non-admin cannot view backup stats', function () {
        $volunteer = User::factory()->volunteer()->create();

        actingAs($volunteer)
            ->getJson('/api/_db/stats')
            ->assertForbidden();
    });

    it('non-admin cannot cleanup backups', function () {
        $volunteer = User::factory()->volunteer()->create();

        actingAs($volunteer)
            ->postJson('/api/_db/cleanup')
            ->assertForbidden();
    });

    it('non-admin cannot view scheduled settings', function () {
        $volunteer = User::factory()->volunteer()->create();

        actingAs($volunteer)
            ->getJson('/api/_db/schedule')
            ->assertForbidden();
    });

    it('non-admin cannot update scheduled settings', function () {
        $volunteer = User::factory()->volunteer()->create();

        actingAs($volunteer)
            ->putJson('/api/_db/schedule', [
                'enabled' => true,
                'frequency' => 'daily',
            ])
            ->assertForbidden();
    });

    it('admin can access all backup endpoints', function () {
        Backup::factory()->create();

        actingAs($this->admin)
            ->getJson('/api/_db')
            ->assertSuccessful();

        actingAs($this->admin)
            ->getJson('/api/_db/stats')
            ->assertSuccessful();

        actingAs($this->admin)
            ->getJson('/api/_db/schedule')
            ->assertSuccessful();
    });
});

// ===========================================================================
// ENCRYPTION
// ===========================================================================
describe('backup encryption', function () {
    it('creates encrypted backup when encryption is enabled', function () {
        config(['backup.encryption.enabled' => true]);

        actingAs($this->admin)
            ->postJson('/api/_db')
            ->assertCreated();

        $backup = Backup::first();
        expect($backup->file_path)->toEndWith('.sql.enc');

        Storage::disk('local')->delete($backup->file_path);
    });

    it('creates unencrypted backup when encryption is disabled', function () {
        config(['backup.encryption.enabled' => false]);

        actingAs($this->admin)
            ->postJson('/api/_db')
            ->assertCreated();

        $backup = Backup::first();
        expect($backup->file_path)->toEndWith('.sql');
        expect($backup->file_path)->not->toEndWith('.sql.enc');

        Storage::disk('local')->delete($backup->file_path);
    });

    it('encrypted file content is not plain SQL', function () {
        config(['backup.encryption.enabled' => true]);

        actingAs($this->admin)->postJson('/api/_db');

        $backup = Backup::first();
        $content = Storage::disk('local')->get($backup->file_path);

        expect($content)->not->toContain('CREATE TABLE');
        expect($content)->not->toContain('INSERT INTO');

        Storage::disk('local')->delete($backup->file_path);
    });

    it('encrypted file can be decrypted back to valid SQL', function () {
        config(['backup.encryption.enabled' => true]);

        actingAs($this->admin)->postJson('/api/_db');

        $backup = Backup::first();
        $content = Storage::disk('local')->get($backup->file_path);
        $decrypted = Crypt::decryptString($content);

        expect($decrypted)->toContain('CREATE TABLE');

        Storage::disk('local')->delete($backup->file_path);
    });

    it('downloading encrypted file returns raw encrypted content', function () {
        config(['backup.encryption.enabled' => true]);

        actingAs($this->admin)->postJson('/api/_db');

        $backup = Backup::first();
        $downloadContent = Storage::disk('local')->get($backup->file_path);

        $decrypted = Crypt::decryptString($downloadContent);
        expect($decrypted)->toContain('CREATE TABLE');

        Storage::disk('local')->delete($backup->file_path);
    });

    it('encrypted file can be restored successfully', function () {
        config(['backup.encryption.enabled' => true]);

        actingAs($this->admin)->postJson('/api/_db');

        $backup = Backup::first();

        actingAs($this->admin)
            ->postJson("/api/_db/{$backup->id}/restore")
            ->assertSuccessful()
            ->assertJson(['success' => true]);

        Storage::disk('local')->delete($backup->file_path);
    });

    it('unencrypted backup has .sql extension', function () {
        config(['backup.encryption.enabled' => false]);

        actingAs($this->admin)->postJson('/api/_db');

        $backup = Backup::first();
        expect($backup->file_path)->toEndWith('.sql');

        Storage::disk('local')->delete($backup->file_path);
    });

    it('encryption toggle does not affect backup completion status', function () {
        config(['backup.encryption.enabled' => true]);

        actingAs($this->admin)
            ->postJson('/api/_db')
            ->assertCreated();

        expect(Backup::first()->status)->toBe('completed');

        Storage::disk('local')->delete(Backup::first()->file_path);
    });
});

// ===========================================================================
// END-TO-END BACKUP AND RESTORE
// ===========================================================================
describe('backup end-to-end', function () {
    it('creates a backup and restores data correctly', function () {
        config(['backup.encryption.enabled' => false]);

        $uniqueEmail = 'e2e-'.uniqid().'@test.com';
        User::factory()->create(['email' => $uniqueEmail]);
        $countBeforeBackup = User::count();

        actingAs($this->admin)->postJson('/api/_db');

        $backup = Backup::first();
        expect($backup->status)->toBe('completed');
        expect(Storage::disk('local')->exists($backup->file_path))->toBeTrue();

        User::where('email', $uniqueEmail)->delete();
        expect(User::where('email', $uniqueEmail)->exists())->toBeFalse();

        actingAs($this->admin)
            ->postJson("/api/_db/{$backup->id}/restore")
            ->assertSuccessful();

        expect(User::where('email', $uniqueEmail)->exists())->toBeTrue();
        expect(User::count())->toBe($countBeforeBackup);

        Storage::disk('local')->delete($backup->file_path);
    });

    it('creates an encrypted backup and restores data correctly', function () {
        config(['backup.encryption.enabled' => true]);

        $uniqueEmail = 'e2e-enc-'.uniqid().'@test.com';
        User::factory()->create(['email' => $uniqueEmail]);
        $countBeforeBackup = User::count();

        actingAs($this->admin)->postJson('/api/_db');

        $backup = Backup::first();
        expect($backup->status)->toBe('completed');
        expect($backup->file_path)->toEndWith('.sql.enc');

        User::where('email', $uniqueEmail)->delete();

        actingAs($this->admin)
            ->postJson("/api/_db/{$backup->id}/restore")
            ->assertSuccessful();

        expect(User::where('email', $uniqueEmail)->exists())->toBeTrue();
        expect(User::count())->toBe($countBeforeBackup);

        Storage::disk('local')->delete($backup->file_path);
    });

    it('preserves backup record count after restore', function () {
        config(['backup.encryption.enabled' => false]);

        actingAs($this->admin)->postJson('/api/_db');
        $backupCount = Backup::count();

        $backup = Backup::first();
        actingAs($this->admin)
            ->postJson("/api/_db/{$backup->id}/restore")
            ->assertSuccessful();

        expect(Backup::count())->toBe($backupCount);

        Storage::disk('local')->delete($backup->file_path);
    });

    it('creates backup with description and restores it', function () {
        config(['backup.encryption.enabled' => false]);

        actingAs($this->admin)
            ->postJson('/api/_db', ['description' => 'Pre-deployment snapshot'])
            ->assertCreated();

        $backup = Backup::first();
        expect($backup->description)->toBe('Pre-deployment snapshot');

        actingAs($this->admin)
            ->postJson("/api/_db/{$backup->id}/restore")
            ->assertSuccessful();

        Storage::disk('local')->delete($backup->file_path);
    });

    it('backup file matches size from the database record', function () {
        config(['backup.encryption.enabled' => false]);

        actingAs($this->admin)->postJson('/api/_db');

        $backup = Backup::first();
        $diskSize = Storage::disk('local')->size($backup->file_path);

        expect($backup->size_bytes)->toBe($diskSize);

        Storage::disk('local')->delete($backup->file_path);
    });

    it('encrypted backup file size is stored correctly', function () {
        config(['backup.encryption.enabled' => true]);

        actingAs($this->admin)->postJson('/api/_db');

        $backup = Backup::first();
        $diskSize = Storage::disk('local')->size($backup->file_path);

        expect($backup->size_bytes)->toBe($diskSize);

        Storage::disk('local')->delete($backup->file_path);
    });

    it('backup contains all application tables', function () {
        config(['backup.encryption.enabled' => false]);

        $tables = DB::select("SELECT name FROM sqlite_master WHERE type='table'");
        $tableNames = array_map(fn ($t) => $t->name, $tables);

        actingAs($this->admin)->postJson('/api/_db');

        $backup = Backup::first();
        $content = Storage::disk('local')->get($backup->file_path);

        foreach ($tableNames as $tableName) {
            if (in_array($tableName, ['cache', 'cache_locks', 'failed_jobs', 'jobs', 'job_batches', 'sessions', 'sqlite_sequence'])) {
                continue;
            }
            $hasTable = str_contains($content, "CREATE TABLE `{$tableName}`")
                || str_contains($content, 'CREATE TABLE "'.$tableName.'"');
            expect($hasTable)->toBeTrue("Backup missing CREATE TABLE for {$tableName}");
        }

        Storage::disk('local')->delete($backup->file_path);
    });

    it('creates backup via BackupService directly', function () {
        config(['backup.encryption.enabled' => false]);
        $service = app(BackupService::class);
        $initialCount = Backup::count();

        $backup = $service->createBackup('manual', 'Service-level test');

        expect(Backup::count())->toBe($initialCount + 1);
        expect($backup->status)->toBe('completed');
        expect($backup->description)->toBe('Service-level test');

        Storage::disk('local')->delete($backup->file_path);
    });

    it('restores backup via BackupService directly', function () {
        config(['backup.encryption.enabled' => false]);

        $uniqueEmail = 'service-e2e-'.uniqid().'@test.com';
        User::factory()->create(['email' => $uniqueEmail]);

        $service = app(BackupService::class);
        $backup = $service->createBackup('manual');

        User::where('email', $uniqueEmail)->delete();

        $service->restoreBackup($backup);

        expect(User::where('email', $uniqueEmail)->exists())->toBeTrue();

        Storage::disk('local')->delete($backup->file_path);
    });
});

// ===========================================================================
// EDGE CASES
// ===========================================================================
describe('backup edge cases', function () {
    it('handles concurrent backup creation', function () {
        config(['backup.encryption.enabled' => false]);

        actingAs($this->admin)->postJson('/api/_db');
        actingAs($this->admin)->postJson('/api/_db');
        actingAs($this->admin)->postJson('/api/_db');

        expect(Backup::count())->toBe(3);
        expect(Backup::where('status', 'completed')->count())->toBe(3);

        foreach (Backup::all() as $backup) {
            Storage::disk('local')->delete($backup->file_path);
        }
    });

    it('creates backup with unicode characters in description', function () {
        actingAs($this->admin)
            ->postJson('/api/_db', [
                'description' => '日本語 Español العربية backup',
            ])
            ->assertCreated();

        expect(Backup::first()->description)->toBe('日本語 Español العربية backup');
    });

    it('creates backup with very long description at boundary', function () {
        $desc = str_repeat('x', 255);

        actingAs($this->admin)
            ->postJson('/api/_db', ['description' => $desc])
            ->assertCreated();

        expect(strlen(Backup::first()->description))->toBe(255);
    });

    it('returns error when creating backup with invalid type parameter', function () {
        actingAs($this->admin)
            ->postJson('/api/_db', ['type' => 'invalid'])
            ->assertStatus(422);
    });

    it('shows correct formatted status for each status value', function () {
        $completed = Backup::factory()->create();
        $pending = Backup::factory()->pending()->create();
        $failed = Backup::factory()->failed()->create();
        $inProgress = Backup::factory()->create(['status' => 'in_progress']);

        expect($completed->status_formatted)->toBe('Completed');
        expect($pending->status_formatted)->toBe('Pending');
        expect($failed->status_formatted)->toBe('Failed');
        expect($inProgress->status_formatted)->toBe('In Progress');
    });

    it('shows correct formatted type for each type value', function () {
        $manual = Backup::factory()->create();
        $auto = Backup::factory()->automatic()->create();

        expect($manual->type_formatted)->toBe('Manual');
        expect($auto->type_formatted)->toBe('Automatic');
    });

    it('isCompleted returns true only for completed status', function () {
        expect(Backup::factory()->create()->isCompleted())->toBeTrue();
        expect(Backup::factory()->pending()->create()->isCompleted())->toBeFalse();
        expect(Backup::factory()->failed()->create()->isCompleted())->toBeFalse();
        expect(Backup::factory()->create(['status' => 'in_progress'])->isCompleted())->toBeFalse();
    });

    it('isFailed returns true only for failed status', function () {
        expect(Backup::factory()->failed()->create()->isFailed())->toBeTrue();
        expect(Backup::factory()->create()->isFailed())->toBeFalse();
    });

    it('can delete backup immediately after creation', function () {
        config(['backup.encryption.enabled' => false]);

        actingAs($this->admin)->postJson('/api/_db');

        $backup = Backup::first();

        actingAs($this->admin)
            ->deleteJson("/api/_db/{$backup->id}")
            ->assertSuccessful();

        expect(Backup::count())->toBe(0);
    });

    it('backup file remains unchanged after download', function () {
        $backup = Backup::factory()->create();
        $content = '-- immutable content';
        Storage::disk('local')->put($backup->file_path, $content);

        actingAs($this->admin)->getJson("/api/_db/{$backup->id}/download");

        expect(Storage::disk('local')->get($backup->file_path))->toBe($content);

        Storage::disk('local')->delete($backup->file_path);
    });

    it('backup restore maintains database integrity', function () {
        config(['backup.encryption.enabled' => false]);

        $testEmail = 'integrity-'.uniqid().'@test.com';
        $testUser = User::factory()->create([
            'email' => $testEmail,
            'name' => 'Integrity Test User',
        ]);

        $backupService = app(BackupService::class);
        $backup = $backupService->createBackup('manual', 'integrity test');

        $testUser->update(['name' => 'Modified Name']);
        $newUser = User::factory()->create(['email' => 'new-'.uniqid().'@test.com']);

        $backupService->restoreBackup($backup);

        expect(User::where('email', $testEmail)->first()->name)->toBe('Integrity Test User');
        expect(User::where('email', $newUser->email)->exists())->toBeFalse();

        Storage::disk('local')->delete($backup->file_path);
    });
});
