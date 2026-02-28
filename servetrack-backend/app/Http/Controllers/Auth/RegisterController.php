<?php

namespace App\Http\Controllers\Auth;

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
        // If email already exists, return a generic success to prevent enumeration.
        // The unique:users validation in RegisterRequest catches this for legitimate
        // registrations, but an attacker probing via timing can still detect it, so
        // we short-circuit here before touching the DB further.
        if (User::where('email', $request->input('email'))->exists()) {
            return response()->json([
                'message' => 'Registration successful',
            ], 201);
        }

        $user = User::create($request->validated());

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
        ], 201)->withCookie($cookie);
    }
}
