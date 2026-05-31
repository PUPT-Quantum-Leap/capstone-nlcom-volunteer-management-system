<?php

namespace App\Http\Controllers\Auth;

use App\Constants\TokenAbilities;
use App\Enums\AuditAction;
use App\Http\Controllers\Controller;
use App\Http\Requests\Auth\LoginRequest;
use App\Models\User;
use App\Services\AuditLogger;
use App\Services\OAuthService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Response;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Http;
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
            AuditLogger::failure(AuditAction::AUTH_LOGIN_FAILED, 'Invalid credentials', [
                'actor_name' => $request->input('email'),
                'resource_type' => 'user',
            ]);

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
        /** @var User $user */

        // Volunteer login endpoint should not authenticate admin accounts.
        if ($user && $user->role === 'admin') {
            Auth::guard('web')->logout();
            if ($request->hasSession()) {
                $request->session()->invalidate();
                $request->session()->regenerateToken();
            }

            return response()->json([
                'message' => 'Admin accounts must use /admin-login.',
            ], 422)->withHeaders([
                'Cache-Control' => 'no-store, no-cache, must-revalidate',
                'Pragma' => 'no-cache',
            ]);
        }

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

        $remember = $request->boolean('remember');

        AuditLogger::success(AuditAction::AUTH_LOGIN, [
            'resource_type' => 'user',
            'resource_id' => $user->id,
            'resource_label' => $user->name,
            'description' => "User logged in: {$user->email}",
        ]);

        return $this->buildAuthenticatedResponse($userData, $user, $this->abilitiesForRole($user->role), $remember);
    }

    /**
     * Handle an incoming admin-only authentication request.
     */
    public function adminStore(LoginRequest $request): JsonResponse
    {
        try {
            $request->authenticate();
        } catch (ValidationException) {
            AuditLogger::failure(AuditAction::AUTH_LOGIN_FAILED, 'Invalid credentials', [
                'actor_name' => $request->input('email'),
                'resource_type' => 'user',
            ]);

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
        /** @var User $user */

        // Admin login endpoint accepts only admin role.
        if (! $user || $user->role !== 'admin') {
            Auth::guard('web')->logout();
            if ($request->hasSession()) {
                $request->session()->invalidate();
                $request->session()->regenerateToken();
            }

            return response()->json([
                'message' => 'Invalid credentials',
            ], 422)->withHeaders([
                'Cache-Control' => 'no-store, no-cache, must-revalidate',
                'Pragma' => 'no-cache',
            ]);
        }

        $userData = $user->toArray();
        $userData['user_type'] = 'admin';
        $userData['admin_profile'] = $user->admin;

        $remember = $request->boolean('remember');

        AuditLogger::success(AuditAction::AUTH_LOGIN, [
            'resource_type' => 'user',
            'resource_id' => $user->id,
            'resource_label' => $user->name,
            'description' => "Admin logged in: {$user->email}",
        ]);

        return $this->buildAuthenticatedResponse($userData, $user, TokenAbilities::ADMIN, $remember);
    }

    /**
     * Redirect to Google OAuth for authentication.
     */
    public function redirectToGoogle(Request $request): JsonResponse
    {
        $clientId = config('services.google.client_id');
        $redirectUri = config('services.google.redirect_uri');

        if (! $clientId || ! $redirectUri) {
            return response()->json(['message' => 'Google login is not configured.'], 500);
        }

        $state = bin2hex(random_bytes(32));

        $params = http_build_query([
            'client_id' => $clientId,
            'redirect_uri' => $redirectUri,
            'response_type' => 'code',
            'scope' => 'email profile',
            'state' => $state,
        ]);

        // Return state to the frontend — it stores it in sessionStorage and
        // sends it back with the callback request. This avoids cross-domain
        // session issues when the frontend and backend are on different origins.
        return response()->json([
            'redirect_url' => "https://accounts.google.com/o/oauth2/v2/auth?{$params}",
            'state' => $state,
        ]);
    }

    /**
     * Handle Google OAuth callback.
     */
    public function handleGoogleCallback(Request $request, OAuthService $oauthService): JsonResponse
    {
        $code = $request->query('code');
        $incomingState = $request->query('state');
        // Frontend sends back the state it stored in sessionStorage
        $expectedState = $request->query('expected_state');

        if (
            ! is_string($incomingState)
            || ! is_string($expectedState)
            || ! hash_equals($expectedState, $incomingState)
        ) {
            return response()->json(['message' => 'Invalid OAuth state.'], 400);
        }

        if (! $code) {
            return response()->json(['message' => 'Authorization code not provided.'], 400);
        }

        try {
            $tokenResponse = Http::timeout(10)->asForm()->post('https://oauth2.googleapis.com/token', [
                'client_id' => config('services.google.client_id'),
                'client_secret' => config('services.google.client_secret'),
                'redirect_uri' => config('services.google.redirect_uri'),
                'grant_type' => 'authorization_code',
                'code' => $code,
            ]);

            if ($tokenResponse->failed()) {
                return response()->json(['message' => 'Failed to exchange code for access token.'], 400);
            }

            $accessToken = $tokenResponse->json('access_token');

            $userResponse = Http::timeout(10)->withToken($accessToken)
                ->get('https://www.googleapis.com/oauth2/v2/userinfo');

            if ($userResponse->failed()) {
                return response()->json(['message' => 'Failed to fetch user profile.'], 400);
            }

            $googleUser = $userResponse->json();
            $email = $googleUser['email'] ?? null;

            if (! $email) {
                return response()->json(['message' => 'Google account has no email address.'], 400);
            }

            $name = trim(($googleUser['given_name'] ?? '').' '.($googleUser['family_name'] ?? ''))
                ?: ($googleUser['name'] ?? 'Google User');

            [$user, $needsProfileCompletion] = $oauthService->findOrCreateFromProvider(
                'google',
                (string) $googleUser['id'],
                $email,
                $name,
            );

            if ($user === null) {
                return response()->json([
                    'message' => 'This email is already linked to a different sign-in method.',
                ], 409);
            }

            $userData = $user->toArray();
            $userData['user_type'] = 'volunteer';
            $userData['volunteer_profile'] = $user->volunteer;
            $userData['needs_profile_completion'] = $needsProfileCompletion;

            return $this->buildAuthenticatedResponse($userData, $user, TokenAbilities::VOLUNTEER);
        } catch (\Exception $e) {
            report($e);

            return response()->json(['message' => 'Google authentication failed.'], 500);
        }
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
        $user = $request->user();

        AuditLogger::success(AuditAction::AUTH_LOGOUT, [
            'resource_type' => 'user',
            'resource_id' => $user?->id,
            'resource_label' => $user?->name,
        ]);

        $request->user()->tokens()->delete();

        Auth::guard('web')->logout();

        if ($request->hasSession()) {
            $request->session()->invalidate();
            $request->session()->regenerateToken();
        }

        $cookie = cookie('auth_token', '', -1);

        return response()->noContent()->withCookie($cookie);
    }

    /**
     * Resolve Sanctum token abilities for the given user role.
     *
     * @return string[]
     */
    private function abilitiesForRole(string $role): array
    {
        return match ($role) {
            'admin' => TokenAbilities::ADMIN,
            'coordinator' => TokenAbilities::COORDINATOR,
            default => TokenAbilities::VOLUNTEER,
        };
    }

    /**
     * Build authenticated login response with a Sanctum auth cookie.
     *
     * @param  array<string, mixed>  $userData
     * @param  string[]  $abilities
     */
    private function buildAuthenticatedResponse(array $userData, User $user, array $abilities, bool $remember = false): JsonResponse
    {
        $expirationMinutes = $remember
            ? 43200 // 30 days in minutes
            : (int) config('sanctum.expiration', 60);

        $token = $user->createToken('auth-token', $abilities, now()->addMinutes($expirationMinutes))->plainTextToken;

        $cookie = cookie(
            'auth_token',
            $token,
            $expirationMinutes,
            '/',
            config('session.domain'),
            true,  // secure
            true,  // httpOnly
            false, // raw
            'none' // SameSite=None required for cross-subdomain requests
        );

        return response()->json([
            'user' => $userData,
        ])->withCookie($cookie);
    }
}
