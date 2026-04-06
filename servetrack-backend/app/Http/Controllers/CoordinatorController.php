<?php

namespace App\Http\Controllers;

use App\Constants\TokenAbilities;
use App\Models\User;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Validator;
use Illuminate\Validation\Rules\Password;

class CoordinatorController extends Controller
{
    /**
     * Register a new coordinator user
     */
    public function register(Request $request): JsonResponse
    {
        // Validate incoming data
        $validator = Validator::make($request->all(), [
            'name' => 'required|string|min:2|max:100',
            'email' => 'required|email|unique:users,email',
            'password' => ['required', 'string', Password::defaults()],
            'confirmPassword' => ['required', 'string', 'same:password'],
        ]);

        if ($validator->fails()) {
            return response()->json([
                'success' => false,
                'message' => 'Validation failed',
                'errors' => $validator->errors(),
            ], 422);
        }

        try {
            $user = DB::transaction(function () use ($request): User {
                return User::create([
                    'name' => $request->name,
                    'email' => $request->email,
                    'password' => Hash::make($request->password),
                    'role' => 'coordinator',
                ]);
            });

            // Log the user in
            Auth::login($user);

            // Create Sanctum token and cookie
            $token = $user->createToken('auth-token', TokenAbilities::COORDINATOR, now()->addMinutes((int) config('sanctum.expiration', 60)))->plainTextToken;
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
                'success' => true,
                'message' => 'Coordinator registration successful',
                'user' => [
                    'id' => $user->id,
                    'name' => $user->name,
                    'email' => $user->email,
                    'role' => $user->role,
                ],
            ], 201)->withCookie($cookie);

        } catch (\Exception $e) {
            Log::error('Coordinator registration failed', [
                'error' => $e->getMessage(),
                'trace' => $e->getTraceAsString(),
            ]);

            return response()->json([
                'success' => false,
                'message' => 'Registration failed. Please try again or contact support.',
            ], 500);
        }
    }
}
