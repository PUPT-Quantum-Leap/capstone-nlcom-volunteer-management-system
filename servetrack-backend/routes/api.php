<?php

use App\Http\Controllers\Auth\LoginController;
use App\Http\Controllers\Auth\RegisterController;
use App\Http\Controllers\VolunteerController;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Route;

// Guest-only routes — audit logging + exponential backoff rate limiting
Route::middleware(['api', 'guest', 'security.audit', 'rate.limit'])->group(function (): void {
    Route::post('/login', [LoginController::class, 'store']);
    Route::post('/register', [RegisterController::class, 'store']);
});

// Volunteer registration - public signup
Route::post('/volunteer/register', [VolunteerController::class, 'register'])
    ->middleware(['api', 'guest', 'security.audit', 'rate.limit']);

// Auth-required routes
Route::middleware(['api', 'auth:sanctum'])->group(function (): void {
    Route::post('/logout', [LoginController::class, 'destroy']);
    Route::get('/user', fn (Request $request) => $request->user());
});
