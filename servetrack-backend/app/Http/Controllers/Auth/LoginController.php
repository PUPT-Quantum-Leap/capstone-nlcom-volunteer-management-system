<?php

namespace App\Http\Controllers\Auth;

use App\Http\Controllers\Controller;
use App\Http\Requests\Auth\LoginRequest;
use App\Models\User;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Response;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Cookie;
use Illuminate\Support\Facades\Hash;
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

        $userData = $user->toArray();
        $userData['user_type'] = $this->getUserType($user);

        // Load specific profile data
        switch ($userData['user_type']) {
            case 'admin':
                $userData['admin_profile'] = $user->admin;
                break;
            case 'coordinator':
                $userData['coordinator_profile'] = $user->coordinator;
                break;
            case 'volunteer':
            default:
                $userData['volunteer_profile'] = $user->volunteer;
                break;
        }

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
            'user' => $userData,
        ])->withCookie($cookie);
    }

    /**
     * Determine the user type based on role and profile
     */
    private function getUserType(User $user): string
    {
        if ($user->role === 'admin') {
            return 'admin';
        }

        if ($user->role === 'coordinator') {
            return 'coordinator';
        }

        if ($user->volunteer) {
            return 'volunteer';
        }

        // Default to volunteer for backward compatibility
        return 'volunteer';
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
