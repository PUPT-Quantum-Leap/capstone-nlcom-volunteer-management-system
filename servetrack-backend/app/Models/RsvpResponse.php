<?php

namespace App\Models;

use Carbon\Carbon;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\SoftDeletes;

class RsvpResponse extends Model
{
    use HasFactory, SoftDeletes;

    public $timestamps = false;

    protected $table = 'rsvp_response';

    protected $primaryKey = 'rsvp_response_id';

    protected $fillable = [
        'volunteer_id',
        'rsvp_id',
        'time_slot_id',
        'voted_at',
        'sms_sent',
        'facebook_id',
        'facebook_name',
        'checked_in_at',
        'checked_out_at',
        'attendance_status',
        'edit_count',
        'last_edited_at',
        'initial_time_slot_id',
        'edit_history',
        'cutoff_reminder_sent_at',
    ];

    protected function casts(): array
    {
        return [
            'voted_at' => 'datetime',
            'sms_sent' => 'boolean',
            'checked_in_at' => 'datetime',
            'checked_out_at' => 'datetime',
            'last_edited_at' => 'datetime',
            'attendance_status' => 'string',
            'edit_history' => 'array',
            'cutoff_reminder_sent_at' => 'datetime',
            'deleted_at' => 'datetime',
        ];
    }

    /**
     * @return BelongsTo<Volunteer, $this>
     */
    public function volunteer(): BelongsTo
    {
        return $this->belongsTo(Volunteer::class, 'volunteer_id');
    }

    /**
     * @return BelongsTo<Rsvp, $this>
     */
    public function rsvp(): BelongsTo
    {
        return $this->belongsTo(Rsvp::class, 'rsvp_id');
    }

    /**
     * @return BelongsTo<TimeSlot, $this>
     */
    public function timeSlot(): BelongsTo
    {
        return $this->belongsTo(TimeSlot::class, 'time_slot_id');
    }

    /**
     * @return HasMany<SmsNotification, $this>
     */
    public function smsNotifications(): HasMany
    {
        return $this->hasMany(SmsNotification::class, 'rsvp_response_id');
    }

    /**
     * Get the attendance record associated with this RSVP response.
     *
     * @return HasMany<Attendance, $this>
     */
    public function attendances(): HasMany
    {
        return $this->hasMany(Attendance::class, 'rsvp_response_id', 'rsvp_response_id');
    }

    public function checkIn(): void
    {
        $this->checked_in_at = Carbon::now();
        $this->attendance_status = 'checked_in';
        $this->save();
    }

    public function checkOut(): void
    {
        $this->checked_out_at = Carbon::now();
        $this->attendance_status = 'checked_out';
        $this->save();
    }

    public function markNoShow(): void
    {
        $this->attendance_status = 'no_show';
        $this->save();
    }

    /**
     * Check if volunteer can edit their response.
     * Can edit if: event is active, cutoff not passed, and edit_count < 3
     */
    public function canEdit(): bool
    {
        $rsvp = $this->rsvp;

        // Must have status = 'active'
        if ($rsvp->status !== 'active') {
            return false;
        }

        // Cutoff must not be passed
        if ($rsvp->isCutoffPassed()) {
            return false;
        }

        // Must have edits remaining
        return $this->edit_count < 3;
    }

    /**
     * Get remaining edits for this response.
     */
    public function getRemainingEdits(): int
    {
        return 3 - $this->edit_count;
    }

    /**
     * Record an edit to the response history.
     */
    public function recordEdit(int $oldTimeSlotId, int $newTimeSlotId): void
    {
        $history = $this->edit_history ?? [];

        $history[] = [
            'old_time_slot_id' => $oldTimeSlotId,
            'new_time_slot_id' => $newTimeSlotId,
            'edited_at' => now()->toIso8601String(),
        ];

        $this->edit_history = $history;
        $this->edit_count++;
        $this->last_edited_at = Carbon::now();
    }
}
