<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class PollVote extends Model
{
    use HasFactory;

    public $timestamps = false;

    protected $table = 'poll_vote';

    protected $primaryKey = 'poll_vote_id';

    protected $fillable = [
        'volunteer_id',
        'poll_id',
        'option_id',
        'voted_at',
        'sms_sent',
        'facebook_id',
        'facebook_name',
    ];

    protected function casts(): array
    {
        return [
            'voted_at' => 'datetime',
            'sms_sent' => 'boolean',
        ];
    }

    public function volunteer(): \Illuminate\Database\Eloquent\Relations\BelongsTo
    {
        return $this->belongsTo(Volunteer::class, 'volunteer_id');
    }

    public function poll(): \Illuminate\Database\Eloquent\Relations\BelongsTo
    {
        return $this->belongsTo(Poll::class, 'poll_id');
    }

    public function option(): \Illuminate\Database\Eloquent\Relations\BelongsTo
    {
        return $this->belongsTo(Option::class, 'option_id');
    }

    public function smsNotifications(): \Illuminate\Database\Eloquent\Relations\HasMany
    {
        return $this->hasMany(SmsNotification::class, 'poll_vote_id');
    }
}
