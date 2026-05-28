<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class IcsCommandRole extends Model
{
    protected $fillable = [
        'ics_id',
        'role_key',
        'role_title',
        'volunteer_id',
        'assigned_name',
    ];

    public function ics(): BelongsTo
    {
        return $this->belongsTo(Ics::class, 'ics_id');
    }

    public function volunteer(): BelongsTo
    {
        return $this->belongsTo(Volunteer::class, 'volunteer_id', 'volunteer_id');
    }
}
