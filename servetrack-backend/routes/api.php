<?php

use App\Http\Controllers\AdminController;
use App\Http\Controllers\AnalyticsController;
use App\Http\Controllers\Auth\LoginController;
use App\Http\Controllers\Auth\RegisterController;
use App\Http\Controllers\BackupController;
use App\Http\Controllers\CoordinatorController;
use App\Http\Controllers\FacebookWebhookController;
use App\Http\Controllers\RsvpController;
use App\Http\Controllers\UserController;
use App\Http\Controllers\VolunteerController;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Route;

// Guest-only routes — audit logging + exponential backoff rate limiting
Route::middleware(['api', 'guest', 'security.audit', 'rate.limit'])->group(function (): void {
    Route::post('/login', [LoginController::class, 'store']);
    Route::post('/admin/login', [LoginController::class, 'adminStore']);
    Route::post('/register', [RegisterController::class, 'store']);
    Route::get('/auth/facebook', [LoginController::class, 'redirectToFacebook']);
    Route::get('/auth/facebook/callback', [LoginController::class, 'handleFacebookCallback']);
});

// Volunteer registration - public signup with registration rate limit + email normalization
Route::post('/volunteer/register', [VolunteerController::class, 'register'])
    ->middleware(['api', 'guest', 'security.audit', 'rate.limit', 'normalize.email', 'throttle:registration']);

// Admin registration - public signup with registration rate limit + email normalization
Route::post('/admin/register', [AdminController::class, 'register'])
    ->middleware(['api', 'guest', 'security.audit', 'rate.limit', 'normalize.email', 'throttle:registration']);

// Coordinator registration - public signup with registration rate limit + email normalization
Route::post('/coordinator/register', [CoordinatorController::class, 'register'])
    ->middleware(['api', 'guest', 'security.audit', 'rate.limit', 'normalize.email', 'throttle:registration']);

Route::get('/webhooks/facebook', [FacebookWebhookController::class, 'verify']);
Route::post('/webhooks/facebook', [FacebookWebhookController::class, 'handle']);

// Auth-required routes (all authenticated users)
Route::middleware(['api', 'auth:sanctum'])->group(function (): void {
    Route::post('/logout', [LoginController::class, 'destroy']);
    Route::get('/user', fn (Request $request) => $request->user());

    // Volunteer profile (volunteer role only — enforced in controller)
    Route::get('/volunteer/profile', [VolunteerController::class, 'profile']);
    Route::put('/volunteer/profile', [VolunteerController::class, 'updateProfile'])
        ->middleware('throttle:profile-update');
    Route::post('/volunteer/profile/photo', [VolunteerController::class, 'updateProfilePhoto']);
    Route::post('/volunteer/change-password', [VolunteerController::class, 'changePassword'])
        ->middleware('throttle:password-change');

    // Volunteer attendance (volunteer role only — enforced in controller)
    Route::get('/volunteer/attendance', [VolunteerController::class, 'listAttendance']);
    Route::get('/volunteer/attendance/stats', [VolunteerController::class, 'attendanceStats']);

    // RSVP — read + vote available to all authenticated users
    Route::get('/rsvp', [RsvpController::class, 'index']);
    Route::get('/rsvp/{identifier}', [RsvpController::class, 'show'])->name('rsvp.show')->where('identifier', '[\d\w\-]+');
    Route::post('/rsvp/{id}/vote', [RsvpController::class, 'vote']);
    Route::get('/rsvp/{rsvpId}/my-response', [RsvpController::class, 'getMyResponse']);
    Route::put('/rsvp/{rsvpId}/response', [RsvpController::class, 'updateResponse']);

    // RSVP Notifications — for volunteers
    Route::get('/notifications/rsvp', [RsvpController::class, 'getNotifications']);
    Route::patch('/notifications/{notificationId}/read', [RsvpController::class, 'markNotificationAsRead']);
    Route::patch('/notifications/rsvp/read-all', [RsvpController::class, 'markAllNotificationsAsRead']);
});

// Admin-only routes — requires authentication AND admin role
Route::middleware(['api', 'auth:sanctum', 'role:admin'])->group(function (): void {
    Route::get('/admin/dashboard', [AdminController::class, 'dashboard']);

    // Analytics & Reports
    Route::get('/analytics/reports', [AnalyticsController::class, 'reports']);
    Route::get('/analytics/export/pdf', [AnalyticsController::class, 'exportPdf']);
    Route::get('/analytics/export/excel', [AnalyticsController::class, 'exportExcel']);

    Route::get('/volunteers', [VolunteerController::class, 'index']);
    Route::get('/volunteers/{id}', [VolunteerController::class, 'show']);
    Route::patch('/volunteers/{id}/soft-delete', [VolunteerController::class, 'softDelete']);
    Route::patch('/volunteers/{id}/restore', [VolunteerController::class, 'restore']);
    Route::delete('/volunteers/{id}', [VolunteerController::class, 'destroy']);
    Route::get('/admin/volunteers/{id}/change-history', [VolunteerController::class, 'changeHistory']);

    // User management — CRUD for users (admin only)
    Route::apiResource('/users', UserController::class);
    Route::patch('/users/{id}/soft-delete', [UserController::class, 'softDelete']);
    Route::patch('/users/{id}/restore', [UserController::class, 'restore']);
    Route::post('/users/{id}/reset-password', [UserController::class, 'resetPassword']);

    // RSVP management — full CRUD + status toggle (admin only)
    Route::post('/rsvp', [RsvpController::class, 'store']);
    Route::put('/rsvp/{id}', [RsvpController::class, 'update']);
    Route::delete('/rsvp/{id}', [RsvpController::class, 'destroy']);
    Route::patch('/rsvp/{id}/status', [RsvpController::class, 'updateStatus']);
    Route::post('/rsvp/{id}/check-in', [RsvpController::class, 'checkIn']);
    Route::post('/rsvp/{id}/check-out', [RsvpController::class, 'checkOut']);
    Route::get('/rsvp/{id}/attendance', [RsvpController::class, 'attendance']);
    Route::post('/rsvp/{id}/notify-facebook', [RsvpController::class, 'notifyFacebook']);
    Route::post('/rsvp/{id}/notify-sms', [RsvpController::class, 'notifySms']);

    // Backup management — full CRUD + operations (admin only)
    Route::get('/backups', [BackupController::class, 'index']);
    Route::post('/backups', [BackupController::class, 'store']);
    Route::get('/backups/stats', [BackupController::class, 'stats']);
    Route::get('/backups/{backup}', [BackupController::class, 'show']);
    Route::delete('/backups/{backup}', [BackupController::class, 'destroy']);
    Route::get('/backups/{backup}/download', [BackupController::class, 'download']);
    Route::post('/backups/{backup}/restore', [BackupController::class, 'restore']);
    Route::post('/backups/cleanup', [BackupController::class, 'cleanup']);

    // Scheduled backup settings
    Route::get('/backups/schedule', [BackupController::class, 'getSchedule']);
    Route::put('/backups/schedule', [BackupController::class, 'updateSchedule']);
});
