<?php

namespace App\Http\Controllers\Auth;

use App\Constants\TokenAbilities;
use App\Http\Controllers\Controller;
use App\Http\Requests\Auth\RegisterRequest;
use App\Models\User;
use Illuminate\Http\JsonResponse;

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

        try {
            $user = User::create($userData);
        } catch (\Exception $e) {
            return response()->json([
                'message' => 'Registration failed: '.$e->getMessage(),
            ], 500);
        }

        $token = $user->createToken(
            'auth-token',
            TokenAbilities::VOLUNTEER,
            now()->addMinutes((int) config('sanctum.expiration', 60))
        )->plainTextToken;

        $cookie = cookie(
            'auth_token',
            $token,
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
