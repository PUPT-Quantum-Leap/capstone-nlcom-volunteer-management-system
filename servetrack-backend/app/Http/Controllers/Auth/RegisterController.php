<?php

namespace App\Http\Controllers\Auth;

use App\Constants\TokenAbilities;
use App\Http\Controllers\Controller;
use App\Http\Requests\Auth\RegisterRequest;
use App\Models\Invite;
use App\Models\User;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\Log;

class RegisterController extends Controller
{
    /**
     * Handle an incoming registration request.
     */
    public function store(RegisterRequest $request): JsonResponse
    {
        // Provide default name if not provided
        $userData = $request->validated();
        if (! isset($userData['name']) || empty($userData['name'])) {
            $userData['name'] = 'Volunteer User';
        }

        // Remove token from user data (not a user field)
        $inviteToken = $userData['token'] ?? null;
        unset($userData['token']);

        try {
            $user = User::create($userData);
        } catch (\Exception $e) {
            Log::error('Generic registration failed', [
                'error' => $e->getMessage(),
                'trace' => $e->getTraceAsString(),
            ]);

            return response()->json([
                'message' => 'Registration failed. Please try again or contact support.',
            ], 500);
        }

        // Mark invite as used if token was provided
        if ($inviteToken) {
            $invite = Invite::where('token', $inviteToken)->first();
            if ($invite && $invite->isValid()) {
                $invite->update([
                    'accepted_at' => now(),
                ]);
            }
        }

        $authToken = $user->createToken(
            'auth-token',
            TokenAbilities::VOLUNTEER,
            now()->addMinutes((int) config('sanctum.expiration', 60))
        )->plainTextToken;

        $cookie = cookie(
            'auth_token',
            $authToken,
            (int) config('sanctum.expiration', 60),
            '/',
            null,
            true,
            true,
            false,
            'strict'
        );

        return response()->json([
            'success' => true,
            'user' => $user,
        ], 201)->withCookie($cookie);
    }
}
