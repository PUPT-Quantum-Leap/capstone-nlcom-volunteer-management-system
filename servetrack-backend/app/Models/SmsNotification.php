<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class SmsNotification extends Model
{
    use HasFactory;

    protected $primaryKey = 'sms_id';

    protected $fillable = [
        'volunteer_id',
        'rsvp_response_id',
        'message',
        'sent_date',
    ];

    protected $casts = [
        'sent_date' => 'date',
    ];

    public function volunteer(): BelongsTo
    {
        return $this->belongsTo(Volunteer::class, 'volunteer_id');
    }

    public function rsvpResponse(): BelongsTo
    {
        return $this->belongsTo(RsvpResponse::class, 'rsvp_response_id');
    }
}
