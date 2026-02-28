<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class Availability extends Model
{
    use HasFactory;

    protected $primaryKey = 'availability_id';

    protected $fillable = [
        'name',
    ];

    public function volunteers(): \Illuminate\Database\Eloquent\Relations\BelongsToMany
    {
        return $this->belongsToMany(Volunteer::class, 'volunteer_availability', 'availability_id', 'volunteer_id');
    }
}
