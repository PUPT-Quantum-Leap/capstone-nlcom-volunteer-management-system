<?php

namespace App\Console\Commands;

use App\Models\BackupScheduleSetting;
use App\Services\BackupService;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\Log;
use Throwable;

class RunScheduledBackup extends Command
{
    protected $signature = 'backup:schedule-run';

    protected $description = 'Create an automatic database backup when '
        .'schedule settings and cadence allow';

    public function handle(BackupService $backupService): int
    {
        $settings = BackupScheduleSetting::current();

        if (! $settings->enabled) {
            $this->components->info('Scheduled backups are disabled; skipping.');

            return self::SUCCESS;
        }

        if (! $settings->shouldCreateBackupToday()) {
            $this->components->info(sprintf(
                'Cadence (%s) does not run today; skipping.',
                $settings->frequency,
            ));

            return self::SUCCESS;
        }

        try {
            $backupService->createBackup('automatic', 'Scheduled backup');
            $this->components->info('Scheduled backup completed successfully.');

            return self::SUCCESS;
        } catch (Throwable $e) {
            Log::error('Scheduled backup command failed', [
                'error' => $e->getMessage(),
                'trace' => $e->getTraceAsString(),
            ]);
            $message = 'Scheduled backup failed: '.$e->getMessage();
            $this->components->error($message);

            return self::FAILURE;
        }
    }
}
