<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;

class Skill extends Model
{
    use HasFactory;

    protected $table = 'skill';

    protected $primaryKey = 'skill_id';

    public $timestamps = false;

    protected $fillable = [
        'name',
    ];

    public function volunteers(): BelongsToMany
    {
        return $this->belongsToMany(Volunteer::class, 'volunteer_skill', 'skill_id', 'volunteer_id');
    }
}
