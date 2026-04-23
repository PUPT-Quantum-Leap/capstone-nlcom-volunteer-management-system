<?php

namespace App\Http\Requests\Auth;

use App\Models\User;
use Illuminate\Auth\Events\Lockout;
use Illuminate\Contracts\Validation\ValidationRule;
use Illuminate\Contracts\Validation\Validator;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\RateLimiter;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;

class LoginRequest extends FormRequest
{
    /**
     * Determine if the user is authorized to make this request.
     */
    public function authorize(): bool
    {
        return true;
    }

    /**
     * Get the validation rules that apply to the request.
     *
     * @return array<string, ValidationRule|array<mixed>|string>
     */
    public function rules(): array
    {
        $emailRule = app()->isProduction() ? 'email:rfc,dns' : 'email:rfc';

        return [
            'email' => ['required', 'string', $emailRule],
            'password' => ['required', 'string'],
        ];
    }

    /**
     * Sanitize inputs after validation passes.
     */
    public function withValidator(Validator $validator): void
    {
        $validator->after(function (Validator $validator): void {
            if ($validator->errors()->any()) {
                return;
            }

            $email = Str::lower(trim(filter_var((string) $this->input('email'), FILTER_SANITIZE_EMAIL)));
            $this->merge(['email' => $email]);
        });
    }

    /**
     * Attempt to authenticate the request's credentials.
     *
     * @throws ValidationException
     */
    public function authenticate(): void
    {
        $this->ensureIsNotRateLimited();

        $user = $this->getUserForAuthentication();

        if ($user && $user->isLockedOut()) {
            $seconds = (int) now()->diffInSeconds($user->locked_until);

            throw ValidationException::withMessages([
                'email' => __('auth.throttle', [
                    'seconds' => $seconds,
                    'minutes' => ceil($seconds / 60),
                ]),
            ])->withHeaders(['Retry-After' => $seconds]);
        }

        if (! Auth::attempt($this->only('email', 'password'), $this->boolean('remember'))) {
            if ($user) {
                $user->recordFailedAttempt();
            }

            RateLimiter::hit($this->throttleKey(), 60);

            throw ValidationException::withMessages([
                'email' => __('auth.failed'),
            ]);
        }

        $user?->resetFailedAttempts();

        RateLimiter::clear($this->throttleKey());
    }

    /**
     * Ensure the login request is not rate limited.
     *
     * @throws ValidationException
     */
    public function ensureIsNotRateLimited(): void
    {
        $maxAttempts = 5;

        if (! RateLimiter::tooManyAttempts($this->throttleKey(), $maxAttempts)) {
            return;
        }

        event(new Lockout($this));

        $seconds = RateLimiter::availableIn($this->throttleKey());
        $retryAfter = max($seconds, 60);

        throw ValidationException::withMessages([
            'email' => __('auth.throttle', [
                'seconds' => $seconds,
                'minutes' => ceil($seconds / 60),
            ]),
        ])->withHeaders([
            'Retry-After' => $retryAfter,
            'X-RateLimit-Limit' => $maxAttempts,
            'X-RateLimit-Remaining' => 0,
            'X-RateLimit-Reset' => time() + $seconds,
        ]);
    }

    /**
     * Get the rate limiting throttle key for the request.
     */
    public function throttleKey(): string
    {
        return 'login:'.Str::lower(Str::transliterate($this->string('email'))).'|'.$this->ip();
    }

    /**
     * Look up the User record for pre-authentication lockout checks.
     */
    protected function getUserForAuthentication(): ?User
    {
        return User::where('email', Str::lower($this->string('email')))->first();
    }
}
