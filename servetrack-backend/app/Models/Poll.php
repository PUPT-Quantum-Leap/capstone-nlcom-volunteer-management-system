<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class Poll extends Model
{
    use HasFactory;

    protected $table = 'poll';

    protected $primaryKey = 'poll_id';

    protected $fillable = [
        'title',
        'description',
        'date',
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

    /**
     * Options associated with this poll (via poll_option junction table).
     * The junction table carries time_slot and capacity per poll-option pair.
     */
    public function options(): \Illuminate\Database\Eloquent\Relations\BelongsToMany
    {
        return $this->belongsToMany(Option::class, 'poll_option', 'poll_id', 'option_id')
            ->withPivot('poll_option_id', 'time_slot', 'capacity');
    }

    /**
     * Votes cast on this poll.
     */
    public function votes(): \Illuminate\Database\Eloquent\Relations\HasMany
    {
        return $this->hasMany(PollVote::class, 'poll_id');
    }

    /**
     * Check if the poll's cutoff date/time has passed.
     * Returns false if no cutoff is set (allows voting).
     */
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
