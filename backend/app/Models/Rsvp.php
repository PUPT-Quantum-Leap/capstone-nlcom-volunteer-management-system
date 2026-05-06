<?php

namespace App\Models;

use Carbon\Carbon;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Support\Str;

class Rsvp extends Model
{
    use HasFactory;

    protected $table = 'rsvp';

    protected $primaryKey = 'rsvp_id';

    protected $fillable = [
        'title',
        'description',
        'date',
        'event_location',
        'cutoff_day',
        'cutoff_time',
        'status',
        'share_url',
        'slug',
        'auto_closed_at',
        'auto_closed_reason',
        'closed_by',
    ];

    protected function casts(): array
    {
        return [
            'date' => 'date',
            'cutoff_day' => 'date',
            'status' => 'string',
            'auto_closed_at' => 'datetime',
        ];
    }

    public function shifts(): BelongsToMany
    {
        return $this->belongsToMany(TimeSlot::class, 'rsvp_shift', 'rsvp_id', 'time_slot_id')
            ->withPivot('time_slot', 'capacity');
    }

    public function responses(): HasMany
    {
        return $this->hasMany(RsvpResponse::class, 'rsvp_id');
    }

    public function auditTrails(): HasMany
    {
        return $this->hasMany(RsvpAuditTrail::class, 'rsvp_id');
    }

    public function scopeActive(Builder $query): Builder
    {
        return $query->where('status', 'active');
    }

    public function scopeActiveAndNotAutoClosed(Builder $query): Builder
    {
        return $query->where('status', 'active')
            ->whereNull('auto_closed_at');
    }

    public function isAutoClosed(): bool
    {
        return $this->auto_closed_at !== null;
    }

    public function shouldAutoClose(): bool
    {
        return $this->status === 'active'
            && $this->auto_closed_at === null
            && $this->isCutoffPassed();
    }

    public function isCutoffPassed(): bool
    {
        $cutoffDay = $this->cutoff_day;
        $cutoffTime = $this->cutoff_time;

        if (empty($cutoffDay) || empty($cutoffTime)) {
            return false;
        }

        try {
            $cutoffDateTime = Carbon::parse($cutoffDay)->setTimeFromTimeString($cutoffTime);
        } catch (\Throwable) {
            return false;
        }

        return now()->greaterThan($cutoffDateTime);
    }

    /**
     * Validate if a status transition is allowed.
     * Returns true if transition is valid, false otherwise.
     *
     * Valid transitions:
     * - draft can go to: active, closed
     * - active can go to: closed (only if no responses), draft (blocked)
     * - closed cannot transition to anything
     */
    public function canTransitionTo(string $newStatus): bool
    {
        $currentStatus = $this->status;

        // If status is the same, allow it
        if ($currentStatus === $newStatus) {
            return true;
        }

        // closed status is terminal - cannot transition
        if ($currentStatus === 'closed') {
            return false;
        }

        // draft can transition to active or closed
        if ($currentStatus === 'draft') {
            return in_array($newStatus, ['active', 'closed']);
        }

        // active can only transition to closed (must have no responses) or stay active
        if ($currentStatus === 'active') {
            if ($newStatus === 'draft') {
                return false; // Cannot go back to draft
            }

            if ($newStatus === 'closed') {
                // Allow closing only if there are no responses
                return $this->responses()->count() === 0;
            }
        }

        return false;
    }

    /**
     * Generate a unique slug from a title.
     */
    public static function generateUniqueSlug(string $title): string
    {
        $baseSlug = Str::slug($title).'-'.now()->format('Y-m');
        $slug = $baseSlug;
        $counter = 1;

        while (self::where('slug', $slug)->exists()) {
            $slug = $baseSlug.'-'.$counter;
            $counter++;
        }

        return $slug;
    }

    /**
     * Find RSVP by slug or numeric ID for backward compatibility.
     */
    public static function findBySlugOrId(string|int $identifier): ?self
    {
        if (is_numeric($identifier)) {
            return self::where('rsvp_id', $identifier)->first();
        }

        return self::where('slug', $identifier)->first();
    }
}
