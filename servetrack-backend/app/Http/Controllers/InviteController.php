<?php

namespace App\Http\Controllers;

use App\Models\Invite;
<<<<<<< deleon-jasmine
use App\Services\SupabaseService;
=======
>>>>>>> main
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Validator;
use Illuminate\Support\Str;

class InviteController extends Controller
{
<<<<<<< deleon-jasmine
    public function __construct(private readonly SupabaseService $supabaseService) {}

=======
>>>>>>> main
    /**
     * Create a new invite.
     */
    public function store(Request $request): JsonResponse
    {
        $validator = Validator::make($request->all(), [
<<<<<<< deleon-jasmine
            'email' => 'required|email|max:255',
            'role' => 'required|string|in:admin,coordinator,volunteer',
            'send_email' => 'boolean',
=======
            'email' => 'nullable|email',
            'role' => 'required|in:admin,coordinator,volunteer',
>>>>>>> main
        ]);

        if ($validator->fails()) {
            return response()->json([
                'success' => false,
                'message' => 'Validation failed',
                'errors' => $validator->errors(),
            ], 422);
        }

<<<<<<< deleon-jasmine
        // Check if user already exists in local database
        if ($request->email && \App\Models\User::where('email', $request->email)->exists()) {
            return response()->json([
                'success' => false,
                'message' => 'A user with this email address is already registered in the system.',
            ], 422);
        }

=======
>>>>>>> main
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

<<<<<<< deleon-jasmine
            // Generate internal invite link for our system
            $internalInviteLink = $this->generateInviteLink($token, $request->role);

            // Generate Supabase auth link for copying/sharing
            $supabaseLinkResult = $this->supabaseService->generateInviteLink($request->email, $internalInviteLink, $request->role);
            $supabaseAuthLink = $supabaseLinkResult['success'] ? $supabaseLinkResult['data']['auth_link'] : null;

            // Send email invite if email is provided and send_email is true (or defaults to true when email is provided)
            $shouldSendEmail = $request->email && ($request->boolean('send_email', true));
            $emailSent = false;

            if ($shouldSendEmail) {
                $emailResult = $this->sendInviteEmail($request->email, $internalInviteLink, $request->role, $request->user()->name);
                $emailSent = $emailResult['success'];
            }

            $responseData = [
                'invite' => $invite,
                'invite_link' => $supabaseAuthLink ?: $internalInviteLink, // Use Supabase link if available, fallback to internal
                'internal_invite_link' => $internalInviteLink,
                'supabase_auth_link' => $supabaseAuthLink,
                'email_sent' => $emailSent,
            ];

            return response()->json([
                'success' => true,
                'message' => $emailSent ? 'Invite created and email sent successfully' : 'Invite created successfully',
                'data' => $responseData,
=======
            $inviteLink = config('app.frontend_url').'/register?token='.$token;

            return response()->json([
                'success' => true,
                'message' => 'Invite created successfully',
                'data' => [
                    'invite' => $invite,
                    'invite_link' => $inviteLink,
                ],
>>>>>>> main
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
<<<<<<< deleon-jasmine
     * Generate role-specific invite link
     */
    private function generateInviteLink(string $token, string $role): string
    {
        $baseUrl = config('app.frontend_url');

        return match ($role) {
            'volunteer' => $baseUrl.'/signup-form?token='.$token,
            'admin' => $baseUrl.'/admin-auth?tab=signup&token='.$token,
            'coordinator' => $baseUrl.'/signup?token='.$token,
            default => $baseUrl.'/signup?token='.$token,
        };
    }

    /**
     * Send invite email using Supabase Auth API
     *
     * Uses Supabase's admin invite endpoint to send email with magic link.
     * The user clicks the link, authenticates with Supabase, and gets redirected\n     * to our auth callback which then routes them to the appropriate signup form.
     */
    private function sendInviteEmail(string $email, string $inviteLink, string $role, ?string $invitedBy = null): array
    {
        return $this->supabaseService->sendInviteEmail($email, $inviteLink, $role);
    }

    /**
=======
>>>>>>> main
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
