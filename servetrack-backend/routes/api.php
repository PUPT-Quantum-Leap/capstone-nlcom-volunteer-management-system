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

// Volunteer registration - public signup with email normalization
Route::post('/volunteer/register', [VolunteerController::class, 'register'])
    ->middleware(['api', 'guest', 'security.audit', 'rate.limit', 'normalize.email']);

// Admin registration - public signup with email normalization
Route::post('/admin/register', [AdminController::class, 'register'])
    ->middleware(['api', 'guest', 'security.audit', 'rate.limit', 'normalize.email']);

// Coordinator registration - public signup with email normalization
Route::post('/coordinator/register', [CoordinatorController::class, 'register'])
    ->middleware(['api', 'guest', 'security.audit', 'rate.limit', 'normalize.email']);

// Auth-required routes
Route::middleware(['api', 'auth:sanctum'])->group(function (): void {
    Route::post('/logout', [LoginController::class, 'destroy']);
    Route::get('/user', fn (Request $request) => $request->user());

    // Volunteer profile
    Route::get('/volunteer/profile', [VolunteerController::class, 'profile']);
    Route::put('/volunteer/profile', [VolunteerController::class, 'updateProfile'])
        ->middleware('throttle:profile-update');
    Route::post('/volunteer/profile/photo', [VolunteerController::class, 'updateProfilePhoto']);
    Route::post('/volunteer/change-password', [VolunteerController::class, 'changePassword'])
        ->middleware('throttle:password-change');

    // Admin dashboard
    Route::get('/admin/dashboard', [AdminController::class, 'dashboard']);

    // Admin volunteer management
    Route::get('/volunteers', [VolunteerController::class, 'index']);
    Route::get('/volunteers/{id}', [VolunteerController::class, 'show']);
    Route::get('/admin/volunteers/{id}/change-history', [VolunteerController::class, 'changeHistory']);

    // Attendance
    Route::get('/volunteer/attendance', [VolunteerController::class, 'listAttendance']);
    Route::get('/volunteer/attendance/stats', [VolunteerController::class, 'attendanceStats']);
});
