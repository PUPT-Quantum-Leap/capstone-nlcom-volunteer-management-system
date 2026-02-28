<?php

namespace App\Http\Controllers\Auth;

use App\Http\Controllers\Controller;
use App\Http\Requests\Auth\LoginRequest;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Response;
use Illuminate\Support\Facades\Auth;
use Illuminate\Validation\ValidationException;

class LoginController extends Controller
{
    /**
     * Handle an incoming authentication request.
     */
    public function store(LoginRequest $request): JsonResponse
    {
        try {
            $request->authenticate();
        } catch (ValidationException) {
            // Generic message prevents email enumeration
            return response()->json([
                'message' => 'Invalid credentials',
            ], 422)->withHeaders([
                'Cache-Control' => 'no-store, no-cache, must-revalidate',
                'Pragma' => 'no-cache',
            ]);
        }

        if ($request->hasSession()) {
            $request->session()->regenerate();
        }

        $user = $request->user();
        $token = $user->createToken('auth-token', ['*'], now()->addMinutes(config('sanctum.expiration', 60)))->plainTextToken;

        $cookie = cookie(
            'auth_token',
            $token,
            config('sanctum.expiration', 60),
            '/',
            null,
            true,
            true,
            false,
            'strict'
        );

        return response()->json([
            'user' => $user,
        ])->withCookie($cookie);
    }

    /**
     * Destroy an authenticated session.
     */
    public function destroy(Request $request): Response
    {
        $request->user()->tokens()->delete();

        Auth::guard('web')->logout();

        if ($request->hasSession()) {
            $request->session()->invalidate();
            $request->session()->regenerateToken();
        }

        $cookie = cookie('auth_token', '', -1);

        return response()->noContent()->withCookie($cookie);
    }
}
