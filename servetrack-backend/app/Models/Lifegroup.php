<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;

class Lifegroup extends Model
{
    use HasFactory;

    protected $table = 'lifegroup';

    protected $primaryKey = 'lifegroup_id';

    public $timestamps = false;

    protected $fillable = [
        'name',
    ];

    public function volunteers(): BelongsToMany
    {
        return $this->belongsToMany(Volunteer::class, 'volunteer_lifegroup', 'lifegroup_id', 'volunteer_id')
            ->withPivot('is_leader');
    }
}
