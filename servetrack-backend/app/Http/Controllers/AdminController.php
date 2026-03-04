<?php

namespace App\Http\Controllers;

use App\Models\Admin;
use App\Models\User;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Validator;

class AdminController extends Controller
{
    /**
     * Register a new admin user
     */
    public function register(Request $request): JsonResponse
    {
        // Validate incoming data
        $validator = Validator::make($request->all(), [
            'firstName' => 'required|string|min:2|max:50',
            'lastName' => 'required|string|min:2|max:50',
            'email' => 'required|email|unique:users,email|unique:admin,email',
            'contactNumber' => 'nullable|string|max:20',
            'password' => 'required|string|min:8',
            'confirmPassword' => 'required|string|same:password',
        ]);

        if ($validator->fails()) {
            return response()->json([
                'success' => false,
                'message' => 'Validation failed',
                'errors' => $validator->errors(),
            ], 422);
        }

        try {
            $result = DB::transaction(function () use ($request) {
                // Create admin user in users table
                $user = User::create([
                    'name' => $request->firstName.' '.$request->lastName,
                    'email' => $request->email,
                    'password' => Hash::make($request->password),
                    'role' => 'admin',
                ]);

                // Create admin profile in admin table
                $admin = Admin::create([
                    'first_name' => $request->firstName,
                    'last_name' => $request->lastName,
                    'email' => $request->email,
                    'contact_number' => $request->contactNumber,
                ]);

                return [
                    'user' => $user,
                    'admin' => $admin,
                ];
            });

            // Log the user in
            Auth::login($result['user']);

            // Create Sanctum token and cookie
            $token = $result['user']->createToken('auth-token', ['*'], now()->addMinutes(config('sanctum.expiration', 60)))->plainTextToken;
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
                'message' => 'Admin registration successful',
                'user' => [
                    'id' => $result['user']->id,
                    'name' => $result['user']->name,
                    'email' => $result['user']->email,
                    'role' => $result['user']->role,
                    'admin_profile' => [
                        'id' => $result['admin']->id,
                        'first_name' => $result['admin']->first_name,
                        'last_name' => $result['admin']->last_name,
                        'contact_number' => $result['admin']->contact_number,
                    ],
                ],
            ], 201)->withCookie($cookie);

        } catch (\Exception $e) {
            return response()->json([
                'success' => false,
                'message' => 'Registration failed: '.$e->getMessage(),
            ], 500);
        }
    }
}
