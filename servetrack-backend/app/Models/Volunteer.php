<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
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
    ];

    // Define Relationships
    public function availabilities(): BelongsToMany
    {
        return $this->belongsToMany(
            Availability::class,
            'volunteer_availability',
            'volunteer_id',
            'availability_id'
        )->withPivot('custom_description');
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

    public function lifegroups(): BelongsToMany
    {
        return $this->belongsToMany(
            Lifegroup::class,
            'volunteer_lifegroup',
            'volunteer_id',
            'lifegroup_id'
        )->withPivot('is_leader');
    }

    public function positions(): BelongsToMany
    {
        return $this->belongsToMany(
            Position::class,
            'volunteer_position',
            'volunteer_id',
            'position_id'
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

    public function pollVotes(): \Illuminate\Database\Eloquent\Relations\HasMany
    {
        return $this->hasMany(PollVote::class, 'volunteer_id');
    }

    public function smsNotifications(): \Illuminate\Database\Eloquent\Relations\HasMany
    {
        return $this->hasMany(SmsNotification::class, 'volunteer_id');
    }
}
