<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;

class Position extends Model
{
    use HasFactory;

    protected $table = 'position';

    protected $primaryKey = 'position_id';

    public $timestamps = false;

    protected $fillable = [
        'name',
    ];

    public function volunteers(): BelongsToMany
    {
        return $this->belongsToMany(Volunteer::class, 'volunteer_position', 'position_id', 'volunteer_id');
    }
}
