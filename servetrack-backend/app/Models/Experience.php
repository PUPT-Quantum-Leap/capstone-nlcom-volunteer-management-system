<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;

class Experience extends Model
{
    use HasFactory;

    protected $table = 'experience';

    protected $primaryKey = 'experience_id';

    public $timestamps = false;

    protected $fillable = [
        'name',
    ];

    public function volunteers(): BelongsToMany
    {
        return $this->belongsToMany(Volunteer::class, 'volunteer_experience', 'experience_id', 'volunteer_id');
    }
}
