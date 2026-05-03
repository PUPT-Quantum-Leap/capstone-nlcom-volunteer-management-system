<?php

namespace App\Http\Controllers;

use App\Models\Invite;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Validator;
use Illuminate\Support\Str;

class InviteController extends Controller
{
    /**
     * Create a new invite.
     */
    public function store(Request $request): JsonResponse
    {
        $validator = Validator::make($request->all(), [
            'email' => 'nullable|email',
            'role' => 'required|in:admin,coordinator,volunteer',
        ]);

        if ($validator->fails()) {
            return response()->json([
                'success' => false,
                'message' => 'Validation failed',
                'errors' => $validator->errors(),
            ], 422);
        }

        try {
            $token = Str::random(64);
            $expiresAt = now()->addDays(7);

            $invite = Invite::create([
                'email' => $request->email,
                'token' => $token,
                'role' => $request->role,
                'expires_at' => $expiresAt,
                'created_by' => $request->user()->id,
            ]);

            $inviteLink = config('app.frontend_url').'/register?token='.$token;

            return response()->json([
                'success' => true,
                'message' => 'Invite created successfully',
                'data' => [
                    'invite' => $invite,
                    'invite_link' => $inviteLink,
                ],
            ], 201);
        } catch (\Exception $e) {
            Log::error('Invite creation failed', [
                'error' => $e->getMessage(),
                'trace' => $e->getTraceAsString(),
            ]);

            return response()->json([
                'success' => false,
                'message' => 'Failed to create invite',
                'error' => $e->getMessage(),
            ], 500);
        }
    }

    /**
     * Validate an invite token.
     */
    public function validate(Request $request): JsonResponse
    {
        $validator = Validator::make($request->all(), [
            'token' => 'required|string',
        ]);

        if ($validator->fails()) {
            return response()->json([
                'success' => false,
                'message' => 'Validation failed',
                'errors' => $validator->errors(),
            ], 422);
        }

        $invite = Invite::where('token', $request->token)->first();

        if (! $invite) {
            return response()->json([
                'success' => false,
                'message' => 'Invalid invite token',
            ], 404);
        }

        if (! $invite->isValid()) {
            return response()->json([
                'success' => false,
                'message' => 'Invite has expired or already been used',
            ], 400);
        }

        return response()->json([
            'success' => true,
            'message' => 'Invite is valid',
            'data' => [
                'email' => $invite->email,
                'role' => $invite->role,
            ],
        ]);
    }

    /**
     * List all invites (admin only).
     */
    public function index(Request $request): JsonResponse
    {
        $query = Invite::with('createdBy')->orderBy('created_at', 'desc');

        if ($search = $request->query('search')) {
            $query->where('email', 'like', '%'.$search.'%');
        }

        $invites = $query->paginate(15);

        return response()->json([
            'success' => true,
            'data' => $invites,
        ]);
    }

    /**
     * Delete an invite.
     */
    public function destroy(int $id): JsonResponse
    {
        $invite = Invite::find($id);

        if (! $invite) {
            return response()->json([
                'success' => false,
                'message' => 'Invite not found',
            ], 404);
        }

        $invite->delete();

        return response()->json([
            'success' => true,
            'message' => 'Invite deleted successfully',
        ]);
    }
}
