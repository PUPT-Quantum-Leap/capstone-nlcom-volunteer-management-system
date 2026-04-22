<?php

namespace App\Http\Controllers;

use App\Models\Backup;
use App\Services\BackupService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Log;
use Symfony\Component\HttpFoundation\StreamedResponse;

class BackupController extends Controller
{
    private BackupService $backupService;

    public function __construct(BackupService $backupService)
    {
        $this->backupService = $backupService;
    }

    /**
     * Display a listing of backups
     */
    public function index(Request $request): JsonResponse
    {
        try {
            $query = Backup::query()->latest();

            // Filter by type if specified
            if ($request->has('type')) {
                $query->where('type', $request->input('type'));
            }

            // Filter by status if specified
            if ($request->has('status')) {
                $query->where('status', $request->input('status'));
            }

            // Paginate results
            $perPage = $request->input('per_page', 10);
            $backups = $query->paginate($perPage);

            return response()->json([
                'success' => true,
                'data' => $backups->items(),
                'pagination' => [
                    'current_page' => $backups->currentPage(),
                    'last_page' => $backups->lastPage(),
                    'per_page' => $backups->perPage(),
                    'total' => $backups->total(),
                ],
            ]);

        } catch (\Exception $e) {
            Log::error('Failed to fetch backups', [
                'error' => $e->getMessage(),
                'trace' => $e->getTraceAsString(),
            ]);

            return response()->json([
                'success' => false,
                'message' => 'Failed to fetch backups: '.$e->getMessage(),
            ], 500);
        }
    }

    /**
     * Store a newly created backup
     */
    public function store(Request $request): JsonResponse
    {
        try {
            $request->validate([
                'type' => 'sometimes|in:manual,automatic',
                'description' => 'sometimes|string|max:255',
            ]);

            $type = $request->input('type', 'manual');
            $description = $request->input('description');

            $backup = $this->backupService->createBackup($type, $description);

            return response()->json([
                'success' => true,
                'message' => 'Backup created successfully',
                'data' => $backup,
            ], 201);

        } catch (\Exception $e) {
            Log::error('Failed to create backup', [
                'error' => $e->getMessage(),
                'trace' => $e->getTraceAsString(),
            ]);

            return response()->json([
                'success' => false,
                'message' => 'Failed to create backup: '.$e->getMessage(),
            ], 500);
        }
    }

    /**
     * Display the specified backup
     */
    public function show(Backup $backup): JsonResponse
    {
        try {
            return response()->json([
                'success' => true,
                'data' => $backup,
            ]);

        } catch (\Exception $e) {
            Log::error('Failed to fetch backup', [
                'backup_id' => $backup->id,
                'error' => $e->getMessage(),
            ]);

            return response()->json([
                'success' => false,
                'message' => 'Failed to fetch backup: '.$e->getMessage(),
            ], 500);
        }
    }

    /**
     * Remove the specified backup
     */
    public function destroy(Backup $backup): JsonResponse
    {
        try {
            $this->backupService->deleteBackup($backup);

            return response()->json([
                'success' => true,
                'message' => 'Backup deleted successfully',
            ]);

        } catch (\Exception $e) {
            Log::error('Failed to delete backup', [
                'backup_id' => $backup->id,
                'error' => $e->getMessage(),
            ]);

            return response()->json([
                'success' => false,
                'message' => 'Failed to delete backup: '.$e->getMessage(),
            ], 500);
        }
    }

    /**
     * Download the specified backup
     */
    public function download(Backup $backup): StreamedResponse|JsonResponse
    {
        try {
            $fileContent = $this->backupService->getBackupFile($backup);

            return response()->streamDownload(function () use ($fileContent) {
                echo $fileContent;
            }, $backup->name.'.sql', [
                'Content-Type' => 'text/plain; charset=utf-8',
                'Content-Disposition' => 'attachment; filename="'.$backup->name.'.sql"',
                'Content-Length' => strlen($fileContent),
                'Cache-Control' => 'no-cache, must-revalidate',
                'Pragma' => 'no-cache',
                'Expires' => '0',
                'X-Content-Type-Options' => 'nosniff',
            ]);

        } catch (\Exception $e) {
            Log::error('Failed to download backup', [
                'backup_id' => $backup->id,
                'error' => $e->getMessage(),
            ]);

            return response()->json([
                'success' => false,
                'message' => 'Failed to download backup: '.$e->getMessage(),
            ], 500);
        }
    }

    /**
     * Restore from the specified backup
     */
    public function restore(Backup $backup): JsonResponse
    {
        try {
            $this->backupService->restoreBackup($backup);

            return response()->json([
                'success' => true,
                'message' => 'Database restored successfully from backup: '.$backup->name,
            ]);

        } catch (\Exception $e) {
            Log::error('Failed to restore backup', [
                'backup_id' => $backup->id,
                'error' => $e->getMessage(),
            ]);

            return response()->json([
                'success' => false,
                'message' => 'Failed to restore backup: '.$e->getMessage(),
            ], 500);
        }
    }

    /**
     * Get backup statistics
     */
    public function stats(): JsonResponse
    {
        try {
            $totalBackups = Backup::count();
            $completedBackups = Backup::completed()->count();
            $failedBackups = Backup::where('status', 'failed')->count();
            $latestBackup = Backup::completed()->latest()->first();
            $totalSize = Backup::completed()->sum('size_bytes');

            return response()->json([
                'success' => true,
                'data' => [
                    'total_backups' => $totalBackups,
                    'completed_backups' => $completedBackups,
                    'failed_backups' => $failedBackups,
                    'latest_backup' => $latestBackup,
                    'total_size_bytes' => $totalSize,
                    'total_size_formatted' => $this->formatBytes($totalSize),
                ],
            ]);

        } catch (\Exception $e) {
            Log::error('Failed to fetch backup stats', [
                'error' => $e->getMessage(),
            ]);

            return response()->json([
                'success' => false,
                'message' => 'Failed to fetch backup statistics: '.$e->getMessage(),
            ], 500);
        }
    }

    /**
     * Clean up old backups
     */
    public function cleanup(Request $request): JsonResponse
    {
        try {
            $request->validate([
                'keep_count' => 'sometimes|integer|min:1|max:50',
            ]);

            $keepCount = $request->input('keep_count', 10);
            $this->backupService->cleanupOldBackups($keepCount);

            return response()->json([
                'success' => true,
                'message' => "Old backups cleaned up. Keeping last {$keepCount} backups.",
            ]);

        } catch (\Exception $e) {
            Log::error('Failed to cleanup backups', [
                'error' => $e->getMessage(),
            ]);

            return response()->json([
                'success' => false,
                'message' => 'Failed to cleanup backups: '.$e->getMessage(),
            ], 500);
        }
    }

    /**
     * Get scheduled backup settings
     */
    public function getSchedule(): JsonResponse
    {
        try {
            $settings = [
                'enabled' => config('backup.schedule.enabled', false),
                'frequency' => config('backup.schedule.frequency', 'weekly'),
            ];

            return response()->json([
                'success' => true,
                'data' => $settings,
            ]);

        } catch (\Exception $e) {
            Log::error('Failed to fetch scheduled backup settings', [
                'error' => $e->getMessage(),
            ]);

            return response()->json([
                'success' => false,
                'message' => 'Failed to fetch scheduled backup settings: '.$e->getMessage(),
            ], 500);
        }
    }

    /**
     * Update scheduled backup settings
     */
    public function updateSchedule(Request $request): JsonResponse
    {
        try {
            $request->validate([
                'enabled' => 'required|boolean',
                'frequency' => 'required|in:daily,weekly,monthly',
            ]);

            $enabled = $request->input('enabled');
            $frequency = $request->input('frequency');

            Log::info('Scheduled backup settings updated', [
                'enabled' => $enabled,
                'frequency' => $frequency,
            ]);

            return response()->json([
                'success' => true,
                'message' => 'Scheduled backup settings updated successfully.',
            ]);

        } catch (\Exception $e) {
            Log::error('Failed to update scheduled backup settings', [
                'error' => $e->getMessage(),
            ]);

            return response()->json([
                'success' => false,
                'message' => 'Failed to update scheduled backup settings: '.$e->getMessage(),
            ], 500);
        }
    }

    /**
     * Format bytes to human readable format
     */
    private function formatBytes(int $bytes): string
    {
        $units = ['B', 'KB', 'MB', 'GB'];

        for ($i = 0; $bytes > 1024 && $i < count($units) - 1; $i++) {
            $bytes /= 1024;
        }

        return round($bytes, 1).' '.$units[$i];
    }
}
