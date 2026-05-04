<?php

namespace App\Providers;

use App\Models\RsvpResponse;
use App\Models\User;
use App\Models\Volunteer;
use App\Observers\RsvpResponseObserver;
use App\Observers\UserObserver;
use App\Observers\VolunteerObserver;
use Illuminate\Cache\RateLimiting\Limit;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\RateLimiter;
use Illuminate\Support\ServiceProvider;
use Illuminate\Validation\Rules\Password;

class AppServiceProvider extends ServiceProvider
{
    /**
     * Register any application services.
     */
    public function register(): void
    {
        //
    }

    /**
     * Bootstrap any application services.
     */
    public function boot(): void
    {
        Password::defaults(function () {
            return Password::min(12)
                ->mixedCase()
                ->numbers()
                ->symbols()
                ->uncompromised(3);
        });

        // Rate limiters for profile update and password change
        RateLimiter::for('profile-update', function (Request $request) {
            return Limit::perMinute(10)->by($request->user()?->id ?: $request->ip());
        });

        RateLimiter::for('password-change', function (Request $request) {
            return Limit::perMinute(5)->by($request->user()?->id ?: $request->ip());
        });

        RateLimiter::for('registration', function (Request $request) {
            return Limit::perMinute(5)->by($request->ip());
        });

        // Register Volunteer observer for audit logging
        Volunteer::observe(VolunteerObserver::class);

        // Register User observer for security audit logging (role/password changes)
        User::observe(UserObserver::class);

        // Register RsvpResponse observer for ICS auto-availability
        RsvpResponse::observe(RsvpResponseObserver::class);
    }
}
