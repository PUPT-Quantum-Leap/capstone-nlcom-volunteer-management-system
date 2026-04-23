<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class RsvpNotification extends Model
{
    use HasFactory;

    protected $table = 'rsvp_notification';

    protected $primaryKey = 'notification_id';

    protected $fillable = [
        'volunteer_id',
        'rsvp_id',
        'type',
        'message',
        'read_at',
        'email_sent',
    ];

    protected function casts(): array
    {
        return [
            'read_at' => 'datetime',
            'email_sent' => 'boolean',
            'created_at' => 'datetime',
            'updated_at' => 'datetime',
        ];
    }

    public function volunteer(): BelongsTo
    {
        return $this->belongsTo(Volunteer::class, 'volunteer_id');
    }

    public function rsvp(): BelongsTo
    {
        return $this->belongsTo(Rsvp::class, 'rsvp_id');
    }

    /**
     * Mark notification as read.
     */
    public function markAsRead(): void
    {
        $this->read_at = now();
        $this->save();
    }

    /**
     * Check if notification is read.
     */
    public function isRead(): bool
    {
        return $this->read_at !== null;
    }
}
