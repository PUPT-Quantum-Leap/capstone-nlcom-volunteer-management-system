<?php

namespace App\Http\Controllers\Auth;

use App\Constants\TokenAbilities;
use App\Http\Controllers\Controller;
use App\Http\Requests\Auth\LoginRequest;
use App\Models\User;
use App\Models\Volunteer;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Response;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Str;
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

        return $this->buildAuthenticatedResponse($userData, $user, $this->abilitiesForRole($user->role));
    }

    /**
     * Handle an incoming admin-only authentication request.
     */
    public function adminStore(LoginRequest $request): JsonResponse
    {
        try {
            $request->authenticate();
        } catch (ValidationException) {
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

        return $this->buildAuthenticatedResponse($userData, $user, TokenAbilities::ADMIN);
    }

    /**
     * Redirect to Facebook OAuth for authentication.
     */
    public function redirectToFacebook(): JsonResponse
    {
        $facebookAppId = config('services.facebook.app_id');
        $redirectUri = config('services.facebook.redirect_uri');

        if (! $facebookAppId || ! $redirectUri) {
            return response()->json([
                'message' => 'Facebook login is not configured.',
            ], 500);
        }

        $permissions = 'email,public_profile';
        $state = Str::random(40);
        session()->put('facebook_oauth_state', $state);
        $oauthUrl = "https://www.facebook.com/v18.0/dialog/oauth?client_id={$facebookAppId}&redirect_uri={$redirectUri}&scope={$permissions}&response_type=code&state={$state}";

        return response()->json(['redirect_url' => $oauthUrl]);
    }

    /**
     * Handle Facebook OAuth callback.
     */
    public function handleFacebookCallback(Request $request): JsonResponse
    {
        $code = $request->query('code');
        $state = $request->query('state');
        $redirectUri = config('services.facebook.redirect_uri');

        if (! $code) {
            return response()->json(['message' => 'Authorization code not provided.'], 400);
        }

        $storedState = session('facebook_oauth_state');
        if (! $state || ! $storedState || $state !== $storedState) {
            return response()->json(['message' => 'Invalid OAuth state parameter.'], 400);
        }

        $facebookAppId = config('services.facebook.app_id');
        $facebookAppSecret = config('services.facebook.app_secret');

        try {
            $tokenResponse = Http::get('https://graph.facebook.com/v18.0/oauth/access_token', [
                'client_id' => $facebookAppId,
                'client_secret' => $facebookAppSecret,
                'redirect_uri' => $redirectUri,
                'code' => $code,
            ]);

            if ($tokenResponse->failed()) {
                return response()->json(['message' => 'Failed to exchange code for access token.'], 400);
            }

            $accessToken = $tokenResponse->json('access_token');

            $userResponse = Http::get('https://graph.facebook.com/v18.0/me', [
                'fields' => 'id,name,email,first_name,last_name',
                'access_token' => $accessToken,
            ]);

            if ($userResponse->failed()) {
                return response()->json(['message' => 'Failed to fetch user profile.'], 400);
            }

            $fbUser = $userResponse->json();

            $volunteer = Volunteer::where('facebook_id', $fbUser['id'])->first();

            if (! $volunteer) {
                $user = User::where('email', $fbUser['email'] ?? null)
                    ->where('role', 'volunteer')
                    ->first();

                if ($user) {
                    $volunteer = Volunteer::where('user_id', $user->id)->first();
                    if ($volunteer) {
                        $volunteer->update([
                            'facebook_id' => $fbUser['id'],
                            'facebook_name' => $fbUser['name'],
                        ]);
                    }
                }

                if (! $volunteer && isset($fbUser['email'])) {
                    DB::transaction(function () use ($fbUser) {
                        $user = User::create([
                            'name' => $fbUser['first_name'].' '.$fbUser['last_name'],
                            'email' => $fbUser['email'],
                            'password' => bcrypt('fb_'.$fbUser['id'].'_'.time()),
                            'role' => 'volunteer',
                        ]);

                        return Volunteer::create([
                            'user_id' => $user->id,
                            'first_name' => $fbUser['first_name'],
                            'last_name' => $fbUser['last_name'],
                            'facebook_id' => $fbUser['id'],
                            'facebook_name' => $fbUser['name'],
                        ]);
                    });
                } elseif (! $volunteer) {
                    return response()->json([
                        'message' => 'No account found. Please register first.',
                    ], 404);
                }
            }

            session()->forget('facebook_oauth_state');

            $user = $volunteer->user;

            $userData = $user->toArray();
            $userData['user_type'] = 'volunteer';
            $userData['volunteer_profile'] = $volunteer;

            return $this->buildAuthenticatedResponse($userData, $user, TokenAbilities::VOLUNTEER);
        } catch (\Exception $e) {
            Log::error('Facebook authentication failed: '.$e->getMessage(), [
                'exception' => get_class($e),
                'file' => $e->getFile(),
                'line' => $e->getLine(),
            ]);

            return response()->json([
                'message' => 'Facebook authentication failed.',
            ], 500);
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
    private function buildAuthenticatedResponse(array $userData, User $user, array $abilities): JsonResponse
    {
        $token = $user->createToken('auth-token', $abilities, now()->addMinutes((int) config('sanctum.expiration', 60)))->plainTextToken;

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
}
