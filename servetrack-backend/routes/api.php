<?php

use App\Http\Controllers\AdminController;
use App\Http\Controllers\Auth\LoginController;
use App\Http\Controllers\Auth\RegisterController;
use App\Http\Controllers\CoordinatorController;
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
});

// Admin-only routes — requires authentication AND admin role
Route::middleware(['api', 'auth:sanctum', 'role:admin'])->group(function (): void {
    Route::get('/admin/dashboard', [AdminController::class, 'dashboard']);
    Route::get('/volunteers', [VolunteerController::class, 'index']);
    Route::get('/volunteers/{id}', [VolunteerController::class, 'show']);
    Route::get('/admin/volunteers/{id}/change-history', [VolunteerController::class, 'changeHistory']);
});
