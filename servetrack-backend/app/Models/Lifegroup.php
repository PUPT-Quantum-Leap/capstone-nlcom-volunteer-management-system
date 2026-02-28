<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class Lifegroup extends Model
{
    use HasFactory;

    protected $primaryKey = 'lifegroup_id';

    protected $fillable = [
        'name',
    ];

    public function volunteers(): \Illuminate\Database\Eloquent\Relations\BelongsToMany
    {
        return $this->belongsToMany(Volunteer::class, 'volunteer_lifegroup', 'lifegroup_id', 'volunteer_id')
            ->withPivot('is_leader');
    }
}
