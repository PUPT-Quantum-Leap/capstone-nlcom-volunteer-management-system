<?php

use App\Models\Backup;
use App\Models\BackupScheduleSetting;
use App\Models\User;
use Illuminate\Support\Facades\Storage;

use function Pest\Laravel\actingAs;

beforeEach(function () {
    $this->admin = User::factory()->admin()->create();
});

describe('backup listing', function () {
    it('returns paginated backup list', function () {
        Backup::factory()->count(5)->create();

        actingAs($this->admin)
            ->getJson('/api/backups')
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
            ->getJson('/api/backups?type=automatic')
            ->assertSuccessful()
            ->assertJsonCount(3, 'data');
    });

    it('filters backups by status', function () {
        Backup::factory()->count(2)->create();
        Backup::factory()->count(1)->failed()->create();

        actingAs($this->admin)
            ->getJson('/api/backups?status=failed')
            ->assertSuccessful()
            ->assertJsonCount(1, 'data');
    });
});

describe('backup creation', function () {
    it('creates a manual backup', function () {
        actingAs($this->admin)
            ->postJson('/api/backups')
            ->assertCreated()
            ->assertJson([
                'success' => true,
                'message' => 'Backup created successfully',
            ]);

        expect(Backup::count())->toBe(1);
    });

    it('accepts description on backup creation', function () {
        actingAs($this->admin)
            ->postJson('/api/backups', [
                'description' => 'Pre-update snapshot',
            ])
            ->assertCreated();

        expect(Backup::first()->description)->toBe('Pre-update snapshot');
    });
});

describe('backup detail', function () {
    it('shows a single backup', function () {
        $backup = Backup::factory()->create();

        actingAs($this->admin)
            ->getJson("/api/backups/{$backup->id}")
            ->assertSuccessful()
            ->assertJsonPath('data.id', $backup->id);
    });
});

describe('backup download', function () {
    it('downloads a completed backup file', function () {
        $backup = Backup::factory()->create();
        Storage::disk('local')->put($backup->file_path, '-- test sql content');

        actingAs($this->admin)
            ->getJson("/api/backups/{$backup->id}/download")
            ->assertSuccessful()
            ->assertHeader('Content-Type', 'text/plain; charset=utf-8');

        Storage::disk('local')->delete($backup->file_path);
    });

    it('returns 500 when backup file is missing', function () {
        $backup = Backup::factory()->create();

        actingAs($this->admin)
            ->getJson("/api/backups/{$backup->id}/download")
            ->assertStatus(500);
    });
});

describe('backup restore', function () {
    it('restores from a completed backup', function () {
        $backup = Backup::factory()->create();
        Storage::disk('local')->put($backup->file_path, 'SELECT 1;');

        actingAs($this->admin)
            ->postJson("/api/backups/{$backup->id}/restore")
            ->assertSuccessful()
            ->assertJson(['success' => true]);

        Storage::disk('local')->delete($backup->file_path);
    });

    it('cannot restore from a pending backup', function () {
        $backup = Backup::factory()->pending()->create();

        actingAs($this->admin)
            ->postJson("/api/backups/{$backup->id}/restore")
            ->assertJsonPath('success', false);
    });

    it('cannot restore when backup file is missing', function () {
        $backup = Backup::factory()->create();

        actingAs($this->admin)
            ->postJson("/api/backups/{$backup->id}/restore")
            ->assertJsonPath('success', false);
    });
});

describe('backup deletion', function () {
    it('deletes a backup', function () {
        $backup = Backup::factory()->create();

        actingAs($this->admin)
            ->deleteJson("/api/backups/{$backup->id}")
            ->assertSuccessful()
            ->assertJson([
                'success' => true,
                'message' => 'Backup deleted successfully',
            ]);

        expect(Backup::find($backup->id))->toBeNull();
    });
});

describe('backup stats', function () {
    it('returns backup statistics', function () {
        Backup::factory()->count(5)->create();
        Backup::factory()->count(2)->failed()->create();
        Backup::factory()->count(1)->pending()->create();

        actingAs($this->admin)
            ->getJson('/api/backups/stats')
            ->assertSuccessful()
            ->assertJsonStructure([
                'success',
                'data' => [
                    'total_backups',
                    'completed_backups',
                    'failed_backups',
                    'latest_backup',
                    'total_size_bytes',
                    'total_size_formatted',
                ],
            ]);
    });
});

describe('backup cleanup', function () {
    it('cleans up old backups keeping specified count', function () {
        Backup::factory()->count(5)->create()
            ->each(fn (Backup $b, int $i) => $b->update(['created_at' => now()->subDays(5 - $i)]));

        actingAs($this->admin)
            ->postJson('/api/backups/cleanup', ['keep_count' => 3])
            ->assertSuccessful();

        expect(Backup::count())->toBe(3);
    });
});

describe('scheduled backup settings', function () {
    it('returns current schedule settings', function () {
        BackupScheduleSetting::factory()->create([
            'enabled' => true,
            'frequency' => 'weekly',
        ]);

        actingAs($this->admin)
            ->getJson('/api/backups/schedule')
            ->assertSuccessful()
            ->assertJsonPath('data.enabled', true)
            ->assertJsonPath('data.frequency', 'weekly');
    });

    it('updates schedule settings', function () {
        BackupScheduleSetting::factory()->create();

        actingAs($this->admin)
            ->putJson('/api/backups/schedule', [
                'enabled' => false,
                'frequency' => 'monthly',
            ])
            ->assertSuccessful()
            ->assertJsonPath('success', true);
    });

    it('validates schedule frequency must be daily, weekly, or monthly', function () {
        BackupScheduleSetting::factory()->create();

        actingAs($this->admin)
            ->putJson('/api/backups/schedule', [
                'enabled' => true,
                'frequency' => 'yearly',
            ])
            ->assertStatus(422);
    });

    it('validates enabled must be boolean', function () {
        BackupScheduleSetting::factory()->create();

        actingAs($this->admin)
            ->putJson('/api/backups/schedule', [
                'enabled' => 'not-boolean',
                'frequency' => 'daily',
            ])
            ->assertStatus(422);
    });
});

describe('backup authorization', function () {
    it('returns 403 for non-admin users', function () {
        $volunteer = User::factory()->volunteer()->create();

        actingAs($volunteer)
            ->getJson('/api/backups')
            ->assertForbidden();
    });

    it('returns 401 for unauthenticated access', function () {
        $this->app['auth']->guard('web')->logout();

        $this->getJson('/api/backups')
            ->assertUnauthorized();
    });

    it('non-admin cannot create backups', function () {
        $volunteer = User::factory()->volunteer()->create();

        actingAs($volunteer)
            ->postJson('/api/backups')
            ->assertForbidden();
    });

    it('non-admin cannot restore backups', function () {
        $backup = Backup::factory()->create();
        $volunteer = User::factory()->volunteer()->create();

        actingAs($volunteer)
            ->postJson("/api/backups/{$backup->id}/restore")
            ->assertForbidden();
    });
});
