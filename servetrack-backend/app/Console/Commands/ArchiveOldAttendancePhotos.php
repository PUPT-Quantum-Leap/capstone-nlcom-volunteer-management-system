<?php

namespace App\Console\Commands;

use App\Models\AttendancePhoto;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\Log;

class ArchiveOldAttendancePhotos extends Command
{
    protected $signature = 'attendance:archive-photos';

    protected $description = 'Archive attendance photos older than 30 days';

    public function handle(): int
    {
        $photosToArchive = AttendancePhoto::whereNull('archived_at')
            ->where('uploaded_at', '<', now()->subDays(30))
            ->get();

        foreach ($photosToArchive as $photo) {
            $photo->archive();
        }

        Log::info('Archived old attendance photos', [
            'count' => $photosToArchive->count(),
        ]);

        $this->info("Archived {$photosToArchive->count()} photos.");

        return self::SUCCESS;
    }
}
