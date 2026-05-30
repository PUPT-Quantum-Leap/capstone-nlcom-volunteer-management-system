<?php

use App\Http\Controllers\AuditLogController;
use App\Http\Controllers\BackupController;
use Illuminate\Support\Facades\Route;

// Backup management — hidden route group (not exposed in api.php)
Route::middleware(['api', 'auth:sanctum', 'role:admin', 'throttle:30,1'])->group(function (): void {
    Route::get('/_db', [BackupController::class, 'index'])->name('backups.index');
    Route::post('/_db', [BackupController::class, 'store'])->name('backups.store');

    // Static routes must precede wildcard {backup} to avoid 404
    Route::get('/_db/stats', [BackupController::class, 'stats'])->name('backups.stats');
    Route::post('/_db/cleanup', [BackupController::class, 'cleanup'])->name('backups.cleanup');
    Route::get('/_db/schedule', [BackupController::class, 'getSchedule'])->name('backups.schedule.get');
    Route::put('/_db/schedule', [BackupController::class, 'updateSchedule'])->name('backups.schedule.update');

    Route::get('/_db/{backup}', [BackupController::class, 'show'])->name('backups.show');
    Route::delete('/_db/{backup}', [BackupController::class, 'destroy'])->name('backups.destroy');
    Route::get('/_db/{backup}/download', [BackupController::class, 'download'])->name('backups.download');
    Route::post('/_db/{backup}/restore', [BackupController::class, 'restore'])->name('backups.restore');

    // Audit Logs
    Route::get('/_audit', [AuditLogController::class, 'index'])->name('audit.index');
    Route::get('/_audit/stats', [AuditLogController::class, 'stats'])->name('audit.stats');
    Route::get('/_audit/actions', [AuditLogController::class, 'actions'])->name('audit.actions');
    Route::get('/_audit/export', [AuditLogController::class, 'export'])->name('audit.export');
});
