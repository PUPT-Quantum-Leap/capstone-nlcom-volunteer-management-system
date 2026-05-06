<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class RsvpAuditTrail extends Model
{
    use HasFactory;

    protected $table = 'rsvp_audit_trail';

    protected $primaryKey = 'audit_id';

    protected $fillable = [
        'rsvp_id',
        'action',
        'triggered_by',
        'reason',
        'metadata',
    ];

    protected function casts(): array
    {
        return [
            'metadata' => 'array',
        ];
    }

    public function rsvp(): BelongsTo
    {
        return $this->belongsTo(Rsvp::class, 'rsvp_id');
    }
}
