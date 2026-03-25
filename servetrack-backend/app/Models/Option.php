<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class Option extends Model
{
    use HasFactory;

    public $timestamps = false;

    protected $table = 'option';

    protected $primaryKey = 'option_id';

    protected $fillable = [
        'text',
    ];

    /**
     * Polls that use this option (via poll_option junction table).
     */
    public function polls(): \Illuminate\Database\Eloquent\Relations\BelongsToMany
    {
        return $this->belongsToMany(Poll::class, 'poll_option', 'option_id', 'poll_id')
            ->withPivot('poll_option_id', 'time_slot', 'capacity');
    }

    /**
     * Votes cast for this option.
     */
    public function votes(): \Illuminate\Database\Eloquent\Relations\HasMany
    {
        return $this->hasMany(PollVote::class, 'option_id');
    }
}
