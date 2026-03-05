<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;

class EmergencyContact extends Model
{
    protected $primaryKey = 'emergency_contact_id';

    protected $table = 'emergency_contact';

    protected $fillable = [
        'name',
        'phone_number',
        'relationship',
    ];

    public function volunteers(): HasMany
    {
        return $this->hasMany(
            Volunteer::class,
            'emergency_contact_id'
        );
    }
}
