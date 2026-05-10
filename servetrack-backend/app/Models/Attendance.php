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
        'location_id',
        'rsvp_id',
        'status',
        'created_by',
        'rsvp_response_id',
    ];

    protected function casts(): array
    {
        return [
            'date' => 'date',
            'hours' => 'decimal:2',
        ];
    }

    /**
     * @return BelongsTo<Volunteer, $this>
     */
    public function volunteer(): BelongsTo
    {
        return $this->belongsTo(Volunteer::class, 'volunteer_id', 'volunteer_id');
    }

    /**
     * @return BelongsTo<User, $this>
     */
    public function createdBy(): BelongsTo
    {
        return $this->belongsTo(User::class, 'created_by', 'id');
    }

    /**
     * @return BelongsTo<Rsvp, $this>
     */
    public function rsvp(): BelongsTo
    {
        return $this->belongsTo(Rsvp::class, 'rsvp_id', 'rsvp_id');
    }

    /**
     * @return BelongsTo<RsvpResponse, $this>
     */
    public function rsvpResponse(): BelongsTo
    {
        return $this->belongsTo(RsvpResponse::class, 'rsvp_response_id', 'rsvp_response_id');
    }
}
