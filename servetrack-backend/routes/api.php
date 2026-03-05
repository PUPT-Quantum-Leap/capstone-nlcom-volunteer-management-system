<?php

<<<<<<< HEAD
use App\Http\Controllers\AuthController;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Route;

Route::get('/user', function (Request $request) {
    return $request->user();
})->middleware('auth:sanctum');

Route::prefix('v1')->group(function () {
    Route::post('/auth/register', [AuthController::class, 'register']);
=======
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

// Volunteer registration - public signup
Route::post('/volunteer/register', [VolunteerController::class, 'register'])
    ->middleware(['api', 'guest', 'security.audit', 'rate.limit']);

// Admin registration - public signup
Route::post('/admin/register', [AdminController::class, 'register'])
    ->middleware(['api', 'guest', 'security.audit', 'rate.limit']);

// Coordinator registration - public signup
Route::post('/coordinator/register', [CoordinatorController::class, 'register'])
    ->middleware(['api', 'guest', 'security.audit', 'rate.limit']);

// Auth-required routes
Route::middleware(['api', 'auth:sanctum'])->group(function (): void {
    Route::post('/logout', [LoginController::class, 'destroy']);
    Route::get('/user', fn (Request $request) => $request->user());

    // Volunteer profile
    Route::get('/volunteer/profile', [VolunteerController::class, 'profile']);
    Route::put('/volunteer/profile', [VolunteerController::class, 'updateProfile']);

    // Admin dashboard
    Route::get('/admin/dashboard', [AdminController::class, 'dashboard']);

    // Attendance
    Route::get('/volunteer/attendance', [VolunteerController::class, 'listAttendance']);
    Route::get('/volunteer/attendance/stats', [VolunteerController::class, 'attendanceStats']);
>>>>>>> origin/main
});
