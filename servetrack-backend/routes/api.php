<?php

use App\Http\Controllers\Auth\LoginController;
use App\Http\Controllers\Auth\RegisterController;
use App\Http\Controllers\VolunteerController;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Route;

// Guest-only routes
Route::middleware(['guest', 'security.audit'])->group(function (): void {
    Route::post('/login', [LoginController::class, 'store'])->middleware('throttle:5,1');
    Route::post('/register', [RegisterController::class, 'store']);

    // Add volunteer registration route
    Route::post('/volunteer/register', [VolunteerController::class, 'register']);
});

// Auth-required routes
Route::middleware('auth:sanctum')->group(function (): void {
    Route::post('/logout', [LoginController::class, 'destroy']);
    Route::get('/user', fn (Request $request) => $request->user());
});
