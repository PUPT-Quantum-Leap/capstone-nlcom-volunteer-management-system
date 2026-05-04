<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;

class Ics extends Model
{
    use HasFactory;

    protected $table = 'ics';

    protected $fillable = [
        'rsvp_id',
        'name',
        'description',
        'date',
        'location',
        'status',
        'ai_suggestions',
    ];

    protected function casts(): array
    {
        return [
            'date' => 'date',
            'status' => 'string',
            'ai_suggestions' => 'array',
        ];
    }

    public function rsvp(): BelongsTo
    {
        return $this->belongsTo(Rsvp::class, 'rsvp_id');
    }

    public function volunteers(): BelongsToMany
    {
        return $this->belongsToMany(
            Volunteer::class,
            'ics_volunteer',
            'ics_id',
            'volunteer_id'
        )->withPivot('team_id', 'role', 'assigned_at');
    }

    public function teams(): BelongsToMany
    {
        return $this->belongsToMany(
            Team::class,
            'ics_team',
            'ics_id',
            'team_id'
        )->withPivot('created_at');
    }
}
