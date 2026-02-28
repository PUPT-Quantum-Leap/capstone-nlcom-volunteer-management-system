<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;

class Volunteer extends Model
{
    use HasFactory;

    // Volunteer Table
    protected $table = 'volunteer';

    // Volunteer Table's primary key
    protected $primaryKey = 'volunteer_id';

    // Field Assignment
    protected $fillable = [
        'user_id',
        'first_name',
        'last_name',
        'facebook_name',
        'facebook_id',
        'email',
        'birthdate',
        'address',
        'mobile_number',
        'educational_attainment',
        'last_medical_examination',
    ];

    protected $casts = [
        'birthdate' => 'date',
        'last_medical_examination' => 'date',
        'facebook_id' => 'integer',
        'user_id' => 'integer',
    ];

    // Define Relationship
    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class, 'user_id', 'id');
    }

    public function experiences(): BelongsToMany
    {
        return $this->belongsToMany(
            Experience::class,
            'volunteer_experience',
            'volunteer_id',
            'experience_id'
        );
    }

    public function skills(): BelongsToMany
    {
        return $this->belongsToMany(
            Skill::class,
            'volunteer_skill',
            'volunteer_id',
            'skill_id'
        );
    }

    public function trainings(): BelongsToMany
    {
        return $this->belongsToMany(
            Training::class,
            'volunteer_training',
            'volunteer_id',
            'training_id'
        );
    }
}
