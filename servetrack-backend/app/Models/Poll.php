<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class Poll extends Model
{
    use HasFactory;

    protected $primaryKey = 'poll_id';

    protected $fillable = [
        'title',
        'vote_count',
        'start_date',
        'end_date',
    ];

    public function options(): \Illuminate\Database\Eloquent\Relations\BelongsToMany
    {
        return $this->belongsToMany(Option::class, 'poll_option', 'poll_id', 'option_id');
    }

    public function votes(): \Illuminate\Database\Eloquent\Relations\HasMany
    {
        return $this->hasMany(PollVote::class, 'poll_id');
    }
}
