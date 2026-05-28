<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

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
}
