<?php

namespace App\Models;

// use Illuminate\Contracts\Auth\MustVerifyEmail;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Relations\HasOne;
use Illuminate\Foundation\Auth\User as Authenticatable;
use Illuminate\Notifications\Notifiable;
use Illuminate\Support\Carbon;
use Laravel\Sanctum\HasApiTokens;

class User extends Authenticatable
{
    /** @use HasFactory<\Database\Factories\UserFactory> */
    use HasApiTokens, HasFactory, Notifiable;

    /**
     * The attributes that are mass assignable.
     *
     * @var list<string>
     */
    protected $fillable = [
        'name',
        'email',
        'password',
        'locked_until',
        'failed_attempts',
        'last_failed_at',
    ];

    /**
     * Get the volunteer profile associated with the user
     */
    public function volunteer(): HasOne
    {
        return $this->hasOne(Volunteer::class, 'user_id', 'id');
    }

    /**
     * The attributes that should be hidden for serialization.
     *
     * @var list<string>
     */
    protected $hidden = [
        'password',
        'remember_token',
    ];

    /**
     * Get the attributes that should be cast.
     *
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'email_verified_at' => 'datetime',
            'password' => 'hashed',
            'locked_until' => 'datetime',
            'last_failed_at' => 'datetime',
        ];
    }

    /**
     * Check if the user account is currently locked out.
     */
    public function isLockedOut(): bool
    {
        return $this->locked_until instanceof Carbon && $this->locked_until->isFuture();
    }

    /**
     * Lock the user account for the given number of minutes.
     */
    public function lockOut(int $minutes = 15): void
    {
        $this->update([
            'locked_until' => now()->addMinutes($minutes),
        ]);
    }

    /**
     * Unlock the user account and reset all failure tracking.
     */
    public function unlock(): void
    {
        $this->update([
            'locked_until' => null,
            'failed_attempts' => 0,
            'last_failed_at' => null,
        ]);
    }

    /**
     * Record a failed login attempt and lock the account if thresholds are exceeded.
     */
    public function recordFailedAttempt(): void
    {
        $attempts = $this->failed_attempts + 1;

        $lockoutMinutes = match (true) {
            $attempts >= 10 => 60,
            $attempts >= 7 => 30,
            $attempts >= 5 => 15,
            default => 0,
        };

        $this->update([
            'failed_attempts' => $attempts,
            'last_failed_at' => now(),
            'locked_until' => $lockoutMinutes > 0 ? now()->addMinutes($lockoutMinutes) : null,
        ]);
    }

    /**
     * Reset failed login attempts after a successful authentication.
     */
    public function resetFailedAttempts(): void
    {
        $this->update([
            'failed_attempts' => 0,
            'last_failed_at' => null,
        ]);
    }
}
