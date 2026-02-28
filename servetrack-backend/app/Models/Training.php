<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class Training extends Model
{
    use HasFactory;

    protected $primaryKey = 'training_id';

    protected $fillable = [
        'name',
    ];

    public function volunteers(): \Illuminate\Database\Eloquent\Relations\BelongsToMany
    {
        return $this->belongsToMany(Volunteer::class, 'volunteer_training', 'training_id', 'volunteer_id');
    }
}
