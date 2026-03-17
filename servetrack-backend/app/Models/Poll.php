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
     * Get votes cast for this poll.
     *
     * @return \Illuminate\Database\Eloquent\Relations\HasMany HasMany relation of PollVote models using `poll_id` as the foreign key.
     */
    public function votes(): \Illuminate\Database\Eloquent\Relations\HasMany
    {
        return $this->hasMany(PollVote::class, 'poll_id');
    }

    /**
     * Determine whether the poll's cutoff datetime has already passed.
     *
     * If either `cutoff_day` or `cutoff_time` is empty, the method returns `false`.
     *
     * @return bool `true` if the current time is after the poll's cutoff datetime, `false` otherwise.
     */
    public function isCutoffPassed(): bool
    {
        $cutoffDay = $this->cutoff_day;
        $cutoffTime = $this->cutoff_time;

        if (empty($cutoffDay) || empty($cutoffTime)) {
            return false;
        }

        $timeString = is_numeric($cutoffTime) ? $cutoffTime : strtotime($cutoffTime);
        $cutoffDateTime = \Carbon\Carbon::parse($cutoffDay)->setTime(
            date('H', $timeString),
            date('i', $timeString),
            0
        );

        return now()->greaterThan($cutoffDateTime);
    }
}
