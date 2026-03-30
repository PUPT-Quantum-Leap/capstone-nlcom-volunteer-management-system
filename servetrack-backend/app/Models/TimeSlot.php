<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class TimeSlot extends Model
{
    use HasFactory;

    public $timestamps = false;

    protected $table = 'time_slot';

    protected $primaryKey = 'time_slot_id';

    protected $fillable = [
        'text',
    ];

    public function rsvps(): \Illuminate\Database\Eloquent\Relations\BelongsToMany
    {
        return $this->belongsToMany(Rsvp::class, 'rsvp_shift', 'time_slot_id', 'rsvp_id')
            ->withPivot('time_slot', 'capacity');
    }

    public function responses(): \Illuminate\Database\Eloquent\Relations\HasMany
    {
        return $this->hasMany(RsvpResponse::class, 'time_slot_id');
    }
}
