<?php

namespace App\Http\Controllers\Auth;

use App\Http\Controllers\Controller;
use App\Http\Requests\Auth\ForgotPasswordRequest;
use App\Http\Requests\Auth\NewPasswordRequest;
use App\Mail\ResetPasswordMail;
use App\Models\User;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\Mail;
use Illuminate\Support\Facades\Password;
use Illuminate\Validation\ValidationException;

class ForgotPasswordController extends Controller
{
    public function sendAdminResetLink(ForgotPasswordRequest $request): JsonResponse
    {
        return $this->sendResetLinkForRole($request, 'admin');
    }

    public function sendVolunteerResetLink(ForgotPasswordRequest $request): JsonResponse
    {
        return $this->sendResetLinkForRole($request, ['volunteer', 'coordinator']);
    }

    private function sendResetLinkForRole(ForgotPasswordRequest $request, string|array $roles): JsonResponse
    {
        $user = User::where('email', $request->input('email'))->first();
        $allowedRoles = (array) $roles;

        if (! $user || ! in_array($user->role, $allowedRoles, true)) {
            return response()->json([
                'message' => 'If this email is registered, you will receive a password reset link.',
            ]);
        }

        $token = Password::broker('users')->createToken($user);

        Mail::to($user->email)->queue(new ResetPasswordMail($user, $token));

        return response()->json([
            'message' => 'If this email is registered, you will receive a password reset link.',
        ]);
    }

    public function reset(NewPasswordRequest $request): JsonResponse
    {
        $status = Password::broker('users')->reset(
            $request->only('email', 'password', 'password_confirmation', 'token'),
            function (User $user, string $password): void {
                $user->update(['password' => $password]);
                $user->resetFailedAttempts();
            }
        );

        if ($status === Password::PASSWORD_RESET) {
            return response()->json([
                'message' => 'Your password has been reset successfully. You can now log in with your new password.',
            ]);
        }

        throw ValidationException::withMessages([
            'email' => [__($status)],
        ]);
    }
}
