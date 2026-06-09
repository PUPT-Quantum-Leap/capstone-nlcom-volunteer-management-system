<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;

class IcsTeam extends Model
{
    /** @use HasFactory<\Database\Factories\IcsTeamFactory> */
    use HasFactory;

    protected $table = 'ics_team';

    protected $fillable = [
        'ics_id',
        'team_id',
        'team',
        'branch_key',
        'branch_title',
        'team_key',
        'vehicle',
        'departure_note',
        'location',
        'time',
        'no_of_pax',
        'details',
    ];

    public function ics(): BelongsTo
    {
        return $this->belongsTo(Ics::class, 'ics_id');
    }

    public function team(): BelongsTo
    {
        return $this->belongsTo(Team::class, 'team_id');
    }

    /**
     * Volunteers assigned to this ICS team via the ics_volunteer pivot.
     *
     * Key mapping:
     *  - Pivot foreign key: ics_volunteer.team_id  → matches ics_team.team_id (local key)
     *  - Pivot related key: ics_volunteer.volunteer_id → matches volunteer.volunteer_id
     *  - Scoped by ics_id to isolate assignments per ICS instance.
     */
    public function volunteers(): BelongsToMany
    {
        return $this->belongsToMany(
            Volunteer::class,
            'ics_volunteer',
            'team_id',       // foreignPivotKey
            'volunteer_id',  // relatedPivotKey
            'team_id',       // parentKey
            'volunteer_id'   // relatedKey
        )->wherePivot('ics_id', $this->ics_id)
            ->withPivot('role', 'is_driver', 'is_leader', 'assigned_at');
    }
}
