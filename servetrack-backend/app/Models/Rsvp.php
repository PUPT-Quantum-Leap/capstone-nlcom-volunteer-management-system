<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

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
    ];

    protected function casts(): array
    {
        return [
            'date' => 'date',
            'cutoff_day' => 'date',
            'status' => 'string',
        ];
    }

    public function shifts(): \Illuminate\Database\Eloquent\Relations\BelongsToMany
    {
        return $this->belongsToMany(TimeSlot::class, 'rsvp_shift', 'rsvp_id', 'time_slot_id')
            ->withPivot('rsvp_shift_id', 'time_slot', 'capacity');
    }

    public function responses(): \Illuminate\Database\Eloquent\Relations\HasMany
    {
        return $this->hasMany(RsvpResponse::class, 'rsvp_id');
    }

    public function isCutoffPassed(): bool
    {
        $cutoffDay = $this->cutoff_day;
        $cutoffTime = $this->cutoff_time;

        if (empty($cutoffDay) || empty($cutoffTime)) {
            return false;
        }

        try {
            $cutoffDateTime = \Carbon\Carbon::parse($cutoffDay)->setTimeFromTimeString($cutoffTime);
        } catch (\Throwable) {
            return false;
        }

        return now()->greaterThan($cutoffDateTime);
    }
}
