<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class SmsNotification extends Model
{
    use HasFactory;

    protected $primaryKey = 'sms_id';

    protected $fillable = [
        'volunteer_id',
        'poll_vote_id',
        'message',
        'sent_date',
    ];

    protected $casts = [
        'sent_date' => 'date',
    ];

    public function volunteer(): \Illuminate\Database\Eloquent\Relations\BelongsTo
    {
        return $this->belongsTo(Volunteer::class, 'volunteer_id');
    }

    public function pollVote(): \Illuminate\Database\Eloquent\Relations\BelongsTo
    {
        return $this->belongsTo(PollVote::class, 'poll_vote_id');
    }
}
