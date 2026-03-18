<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class RsvpResponse extends Model
{
    use HasFactory;

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
    ];

    protected function casts(): array
    {
        return [
            'voted_at' => 'datetime',
            'sms_sent' => 'boolean',
            'checked_in_at' => 'datetime',
            'checked_out_at' => 'datetime',
            'attendance_status' => 'string',
        ];
    }

    public function volunteer(): \Illuminate\Database\Eloquent\Relations\BelongsTo
    {
        return $this->belongsTo(Volunteer::class, 'volunteer_id');
    }

    public function rsvp(): \Illuminate\Database\Eloquent\Relations\BelongsTo
    {
        return $this->belongsTo(Rsvp::class, 'rsvp_id');
    }

    public function timeSlot(): \Illuminate\Database\Eloquent\Relations\BelongsTo
    {
        return $this->belongsTo(TimeSlot::class, 'time_slot_id');
    }

    public function smsNotifications(): \Illuminate\Database\Eloquent\Relations\HasMany
    {
        return $this->hasMany(SmsNotification::class, 'poll_vote_id');
    }

    public function checkIn(): void
    {
        $this->checked_in_at = now();
        $this->attendance_status = 'checked_in';
        $this->save();
    }

    public function checkOut(): void
    {
        $this->checked_out_at = now();
        $this->attendance_status = 'checked_out';
        $this->save();
    }

    public function markNoShow(): void
    {
        $this->attendance_status = 'no_show';
        $this->save();
    }
}
