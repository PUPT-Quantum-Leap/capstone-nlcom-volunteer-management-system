<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\SoftDeletes;

class Volunteer extends Model
{
    use HasFactory, SoftDeletes;

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
        'messenger_psid',
        'email',
        'birthdate',
        'address',
        'mobile_number',
        'educational_attainment',
        'last_medical_examination',
        'emergency_contact_id',
        'user_id',
        'profile_photo',
        'deleted_at',
    ];

    protected $casts = [
        'birthdate' => 'date',
        'last_medical_examination' => 'date',
        'facebook_id' => 'integer',
        'messenger_psid' => 'string',
    ];

    // Define Relationships
    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    public function emergencyContact(): BelongsTo
    {
        return $this->belongsTo(
            EmergencyContact::class,
            'emergency_contact_id'
        );
    }

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

    public function pollVotes(): HasMany
    {
        return $this->hasMany(PollVote::class, 'volunteer_id');
    }

    public function smsNotifications(): HasMany
    {
        return $this->hasMany(SmsNotification::class, 'volunteer_id');
    }

    public function attendances(): HasMany
    {
        return $this->hasMany(Attendance::class, 'volunteer_id', 'volunteer_id');
    }
}
