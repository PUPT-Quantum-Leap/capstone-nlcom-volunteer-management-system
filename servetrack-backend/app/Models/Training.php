<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;

class Training extends Model
{
    use HasFactory;

    protected $table = 'training';

    protected $primaryKey = 'training_id';

    public $timestamps = false;

    protected $fillable = [
        'name',
    ];

    public function volunteers(): BelongsToMany
    {
        return $this->belongsToMany(Volunteer::class, 'volunteer_training', 'training_id', 'volunteer_id');
    }
}
