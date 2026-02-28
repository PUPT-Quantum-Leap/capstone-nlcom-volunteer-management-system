<?php

namespace App\Http\Controllers;

use App\Models\User;
use App\Models\Volunteer;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Validator;

class VolunteerController extends Controller
{
    /**
     * Register a new volunteer
     */
    public function register(Request $request): JsonResponse
    {
        // Validate incoming data
        $validator = Validator::make($request->all(), [
            'firstName' => 'required|string|min:2|max:50',
            'lastName' => 'required|string|min:2|max:50',
            'facebookName' => 'nullable|string|max:100',
            'email' => 'required|email|unique:users,email',
            'mobileNumber' => 'required|string|regex:/^(09|\+639)\d{9}$/',
            'birthdate' => 'required|date|before:today',
            'completeAddress' => 'required|string|min:10|max:255',

            'educationalAttainment' => 'required|string|max:100',
            'lastMedicalExam' => 'required|date|before_or_equal:today',

            // Password (for authentication)
            'password' => 'required|string|min:8|confirmed',
        ]);

        if ($validator->fails()) {
            return response()->json([
                'success' => false,
                'message' => 'Validation failed',
                'errors' => $validator->errors(),
            ], 422);
        }

        // Create user account
        try {
            $user = User::create([
                'name' => $request->firstName.' '.$request->lastName,
                'email' => $request->email,
                'password' => Hash::make($request->password),
            ]);

            // Create volunteer profile linked to user
            $volunteer = Volunteer::create([
                'user_id' => $user->id,
                'first_name' => $request->firstName,
                'last_name' => $request->lastName,
                'facebook_name' => $request->facebookName ?? null,
                'email' => $request->email,
                'mobile_number' => $request->mobileNumber,
                'birthdate' => $request->birthdate,
                'address' => $request->completeAddress,
                'educational_attainment' => $request->educationalAttainment,
                'last_medical_examination' => $request->lastMedicalExam,
            ]);

            return response()->json([
                'success' => true,
                'message' => 'Volunteer registered successfully',
                'data' => [
                    'user' => $user,
                    'volunteer' => $volunteer,
                ],
            ], 201);

        } catch (\Exception $e) {
            return response()->json([
                'success' => false,
                'message' => 'Registration failed: '.$e->getMessage(),
            ], 500);
        }
    }
}
