<?php

use App\Http\Controllers\AdminController;
use App\Http\Controllers\AnalyticsController;
use App\Http\Controllers\Api\IcsTeamController;
use App\Http\Controllers\Api\TeamController;
use App\Http\Controllers\AttendancePhotoController;
use App\Http\Controllers\Auth\LoginController;
use App\Http\Controllers\BackupController;
use App\Http\Controllers\CoordinatorController;
use App\Http\Controllers\FacebookWebhookController;
use App\Http\Controllers\IcsController;
use App\Http\Controllers\InviteController;
use App\Http\Controllers\RsvpController;
use App\Http\Controllers\SmsController;
use App\Http\Controllers\UserController;
use App\Http\Controllers\VolunteerController;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Route;

// Guest-only routes — audit logging + exponential backoff rate limiting
Route::middleware(['api', 'guest', 'security.audit', 'rate.limit'])->group(function (): void {
    Route::post('/login', [LoginController::class, 'store'])->name('auth.login');
    Route::post('/admin/login', [LoginController::class, 'adminStore'])->name('auth.admin-login');
    Route::get('/auth/facebook', [LoginController::class, 'redirectToFacebook'])->name('auth.facebook');
    Route::get('/auth/facebook/callback', [LoginController::class, 'handleFacebookCallback'])->name('auth.facebook.callback');

    // Invite validation (public)
    Route::post('/invites/validate', [InviteController::class, 'validate'])->name('invites.validate');
});

// Volunteer registration - public signup with registration rate limit + email normalization
Route::post('/volunteer/register', [VolunteerController::class, 'register'])
    ->middleware(['api', 'guest', 'security.audit', 'rate.limit', 'normalize.email', 'throttle:registration'])
    ->name('volunteer.register');

// Admin registration - public signup with registration rate limit + email normalization
Route::post('/admin/register', [AdminController::class, 'register'])
    ->middleware(['api', 'security.audit', 'rate.limit', 'normalize.email', 'throttle:registration'])
    ->name('admin.register');

// Coordinator registration - public signup with registration rate limit + email normalization
Route::post('/coordinator/register', [CoordinatorController::class, 'register'])
    ->middleware(['api', 'guest', 'security.audit', 'rate.limit', 'normalize.email', 'throttle:registration'])
    ->name('coordinator.register');

Route::get('/webhooks/facebook', [FacebookWebhookController::class, 'verify'])->name('webhooks.facebook.verify');
Route::post('/webhooks/facebook', [FacebookWebhookController::class, 'handle'])->name('webhooks.facebook.handle');

// Public RSVP view — accessible to all users (authenticated and unauthenticated)
Route::get('/rsvp/{identifier}', [RsvpController::class, 'show'])->name('rsvp.show')->where('identifier', '[\d\w\-]+');

// Auth-required routes (all authenticated users)
Route::middleware(['api', 'auth:sanctum'])->group(function (): void {
    Route::post('/logout', [LoginController::class, 'destroy'])->name('auth.logout');
    Route::get('/user', fn (Request $request) => $request->user())->name('auth.user');

    // Volunteer profile (volunteer role only — enforced in controller)
    Route::get('/volunteer/profile', [VolunteerController::class, 'profile'])->name('volunteer.profile');
    Route::put('/volunteer/profile', [VolunteerController::class, 'updateProfile'])
        ->middleware('throttle:profile-update')
        ->name('volunteer.profile.update');
    Route::post('/volunteer/profile/photo', [VolunteerController::class, 'updateProfilePhoto'])->name('volunteer.profile.photo');
    Route::post('/volunteer/change-password', [VolunteerController::class, 'changePassword'])
        ->middleware('throttle:password-change')
        ->name('volunteer.password.change');

    // Volunteer attendance (volunteer role only — enforced in controller)
    Route::get('/volunteer/attendance', [VolunteerController::class, 'listAttendance'])->name('volunteer.attendance.index');
    Route::get('/volunteer/attendance/stats', [VolunteerController::class, 'attendanceStats'])->name('volunteer.attendance.stats');

    // RSVP — voting actions available to all authenticated users
    Route::get('/rsvp', [RsvpController::class, 'index'])->name('rsvp.index');
    Route::post('/rsvp/{id}/vote', [RsvpController::class, 'vote'])->name('rsvp.vote');
    Route::get('/rsvp/{rsvpId}/my-response', [RsvpController::class, 'getMyResponse'])->name('rsvp.my-response');
    Route::put('/rsvp/{rsvpId}/response', [RsvpController::class, 'updateResponse'])->name('rsvp.response.update');

    // RSVP Notifications — for volunteers
    Route::get('/notifications/rsvp', [RsvpController::class, 'getNotifications'])->name('notifications.rsvp');
    Route::patch('/notifications/{notificationId}/read', [RsvpController::class, 'markNotificationAsRead'])->name('notifications.read');
    Route::patch('/notifications/rsvp/read-all', [RsvpController::class, 'markAllNotificationsAsRead'])->name('notifications.read-all');
});

// Admin-only routes — requires authentication AND admin role
Route::middleware(['api', 'auth:sanctum', 'role:admin'])->group(function (): void {
    Route::get('/admin/dashboard', [AdminController::class, 'dashboard'])->name('admin.dashboard');
    Route::get('/admin/attendance-from-rsvp', [AdminController::class, 'attendanceFromRsvp'])->name('admin.attendance.from-rsvp');
    Route::post('/admin/attendance-status', [AdminController::class, 'updateAttendanceStatus'])->name('admin.attendance.status.update');

    // Analytics & Reports
    Route::get('/analytics/reports', [AnalyticsController::class, 'reports'])->name('analytics.reports');
    Route::get('/analytics/export/pdf', [AnalyticsController::class, 'exportPdf'])->name('analytics.export.pdf');
    Route::get('/analytics/export/excel', [AnalyticsController::class, 'exportExcel'])->name('analytics.export.excel');

    Route::get('/volunteers', [VolunteerController::class, 'index'])->name('volunteers.index');
    Route::get('/volunteers/{id}', [VolunteerController::class, 'show'])->name('volunteers.show');
    Route::put('/volunteers/{id}', [VolunteerController::class, 'update'])->name('volunteers.update');
    Route::patch('/volunteers/{id}/soft-delete', [VolunteerController::class, 'softDelete'])->name('volunteers.soft-delete');
    Route::patch('/volunteers/{id}/restore', [VolunteerController::class, 'restore'])->name('volunteers.restore');
    Route::delete('/volunteers/{id}', [VolunteerController::class, 'destroy'])->name('volunteers.destroy');
    Route::get('/admin/volunteers/{id}/change-history', [VolunteerController::class, 'changeHistory'])->name('admin.volunteers.change-history');

    // User management — CRUD for users (admin only)
    Route::apiResource('/users', UserController::class);
    Route::patch('/users/{id}/soft-delete', [UserController::class, 'softDelete'])->name('users.soft-delete');
    Route::patch('/users/{id}/restore', [UserController::class, 'restore'])->name('users.restore');
    Route::post('/users/{id}/reset-password', [UserController::class, 'resetPassword'])->name('users.reset-password');

    // Invite management — create, list, delete (admin only)
    Route::post('/invites', [InviteController::class, 'store'])->name('invites.store');
    Route::get('/invites', [InviteController::class, 'index'])->name('invites.index');
    Route::delete('/invites/{id}', [InviteController::class, 'destroy'])->name('invites.destroy');

    // Attendance photo management — upload, list, delete (admin only)
    Route::post('/attendance-photos', [AttendancePhotoController::class, 'store'])->name('attendance-photos.store');
    Route::get('/attendance-photos', [AttendancePhotoController::class, 'index'])->name('attendance-photos.index');
    Route::post('/attendance-photos/archive-old', [AttendancePhotoController::class, 'archiveOldPhotos'])->name('attendance-photos.archive-old');
    Route::delete('/attendance-photos/{id}', [AttendancePhotoController::class, 'destroy'])->name('attendance-photos.destroy');

    // RSVP management — full CRUD + status toggle (admin only)
    Route::post('/rsvp', [RsvpController::class, 'store'])->name('rsvp.store');
    Route::put('/rsvp/{id}', [RsvpController::class, 'update'])->name('rsvp.update');
    Route::delete('/rsvp/{id}', [RsvpController::class, 'destroy'])->name('rsvp.destroy');
    Route::patch('/rsvp/{id}/status', [RsvpController::class, 'updateStatus'])->name('rsvp.status.update');
    Route::post('/rsvp/{id}/check-in', [RsvpController::class, 'checkIn'])->name('rsvp.check-in');
    Route::post('/rsvp/{id}/check-out', [RsvpController::class, 'checkOut'])->name('rsvp.check-out');
    Route::get('/rsvp/{id}/attendance', [RsvpController::class, 'attendance'])->name('rsvp.attendance');
    Route::post('/rsvp/{id}/notify-facebook', [RsvpController::class, 'notifyFacebook'])->name('rsvp.notify.facebook');
    Route::post('/rsvp/{id}/notify-sms', [RsvpController::class, 'notifySms'])->name('rsvp.notify.sms');
    Route::get('/rsvp-trashed', [RsvpController::class, 'trashed'])->name('rsvp.trashed');
    Route::post('/rsvp/{id}/restore', [RsvpController::class, 'restore'])->name('rsvp.restore');
    Route::delete('/rsvp/{id}/force-delete', [RsvpController::class, 'forceDelete'])->name('rsvp.force-delete');

    // Backup management — full CRUD + operations (admin only)
    Route::get('/backups', [BackupController::class, 'index'])->name('backups.index');
    Route::post('/backups', [BackupController::class, 'store'])->name('backups.store');
    Route::get('/backups/stats', [BackupController::class, 'stats'])->name('backups.stats');
    Route::get('/backups/{backup}', [BackupController::class, 'show'])->name('backups.show');
    Route::delete('/backups/{backup}', [BackupController::class, 'destroy'])->name('backups.destroy');
    Route::get('/backups/{backup}/download', [BackupController::class, 'download'])->name('backups.download');
    Route::post('/backups/{backup}/restore', [BackupController::class, 'restore'])->name('backups.restore');
    Route::post('/backups/cleanup', [BackupController::class, 'cleanup'])->name('backups.cleanup');

    // Scheduled backup settings
    Route::get('/backups/schedule', [BackupController::class, 'getSchedule'])->name('backups.schedule.get');
    Route::put('/backups/schedule', [BackupController::class, 'updateSchedule'])->name('backups.schedule.update');

    // Admin profile routes
    Route::get('/admin/profile', [AdminController::class, 'profile'])->name('admin.profile');
    Route::put('/admin/profile', [AdminController::class, 'updateProfile'])
        ->middleware('throttle:profile-update')
        ->name('admin.profile.update');

    // SMS configuration status check
    Route::get('/sms/config-status', [SmsController::class, 'configStatus'])->name('sms.config-status');

    // ICS Team management — feeding operation data (admin only)
    Route::get('/ics-team', [IcsTeamController::class, 'index']);
    Route::post('/ics-team', [IcsTeamController::class, 'store']);
    Route::put('/ics-team/{id}', [IcsTeamController::class, 'update']);
    Route::get('/teams', [TeamController::class, 'index']);

    // ICS management — full CRUD + AI suggestions (admin only)
    Route::get('/ics', [IcsController::class, 'index'])->name('ics.index');
    Route::get('/ics/{id}', [IcsController::class, 'show'])->name('ics.show');
    Route::post('/ics', [IcsController::class, 'store'])->name('ics.store');
    Route::put('/ics/{id}', [IcsController::class, 'update'])->name('ics.update');
    Route::delete('/ics/{id}', [IcsController::class, 'destroy'])->name('ics.destroy');
    Route::get('/ics/{rsvpId}/rsvp-volunteers', [IcsController::class, 'getRsvpVolunteers'])->name('ics.rsvp-volunteers');
    Route::get('/ics/{icsId}/ai-suggestions', [IcsController::class, 'getAiSuggestions'])->name('ics.ai-suggestions');
    Route::post('/ics/{icsId}/apply-suggestions', [IcsController::class, 'applyAiSuggestions'])->name('ics.apply-suggestions');
    Route::post('/ics/{icsId}/assign-volunteer', [IcsController::class, 'assignVolunteer'])->name('ics.assign-volunteer');
    Route::post('/ics/{icsId}/remove-volunteer', [IcsController::class, 'removeVolunteer'])->name('ics.remove-volunteer');
});
