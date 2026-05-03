<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Team extends Model
{
    use HasFactory;

    protected $table = 'teams';

    protected $fillable = [
        'name',
    ];

    public function volunteers(): BelongsToMany
    {
        return $this->belongsToMany(
            Volunteer::class,
            'volunteer_team',
            'team_id',
            'volunteer_id'
        );
    }

    public function sites(): HasMany
    {
        return $this->hasMany(Site::class, 'team_id');
    }
}
