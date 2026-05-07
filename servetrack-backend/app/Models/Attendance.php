<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class Attendance extends Model
{
    use HasFactory;

    protected $primaryKey = 'attendance_id';

    protected $fillable = [
        'volunteer_id',
        'date',
        'hours',
        'description',
        'location',
        'rsvp_id',
        'status',
        'created_by',
        'rsvp_response_id',
    ];

    protected function casts(): array
    {
        return [
            'date' => 'date',
            'hours' => 'decimal:1',
        ];
    }

    public function volunteer(): BelongsTo
    {
        return $this->belongsTo(Volunteer::class, 'volunteer_id', 'volunteer_id');
    }

    public function createdBy(): BelongsTo
    {
        return $this->belongsTo(User::class, 'created_by');
    }

    public function rsvp(): BelongsTo
    {
        return $this->belongsTo(Rsvp::class, 'rsvp_id', 'rsvp_id');
    }

    public function rsvpResponse(): BelongsTo
    {
        return $this->belongsTo(RsvpResponse::class, 'rsvp_response_id', 'rsvp_response_id');
    }
}
