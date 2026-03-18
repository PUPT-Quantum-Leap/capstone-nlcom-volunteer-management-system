<?php

use App\Http\Controllers\AdminController;
use App\Http\Controllers\Auth\LoginController;
use App\Http\Controllers\Auth\RegisterController;
use App\Http\Controllers\CoordinatorController;
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
    Route::get('/rsvp/{id}', [RsvpController::class, 'show']);
    Route::post('/rsvp/{id}/vote', [RsvpController::class, 'vote']);
});

// Admin-only routes — requires authentication AND admin role
Route::middleware(['api', 'auth:sanctum', 'role:admin'])->group(function (): void {
    Route::get('/admin/dashboard', [AdminController::class, 'dashboard']);
    Route::get('/volunteers', [VolunteerController::class, 'index']);
    Route::get('/volunteers/{id}', [VolunteerController::class, 'show']);
    Route::patch('/volunteers/{id}/soft-delete', [VolunteerController::class, 'softDelete']);
    Route::patch('/volunteers/{id}/restore', [VolunteerController::class, 'restore']);
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
});
