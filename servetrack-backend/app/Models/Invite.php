<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\SoftDeletes;

class Invite extends Model
{
    use HasFactory, SoftDeletes;

    protected $fillable = [
        'email',
        'token',
        'role',
        'expires_at',
        'accepted_at',
        'created_by',
    ];

    protected function casts(): array
    {
        return [
            'expires_at' => 'datetime',
            'accepted_at' => 'datetime',
        ];
    }

    public function createdBy(): BelongsTo
    {
        return $this->belongsTo(User::class, 'created_by');
    }

    public function isValid(): bool
    {
        return $this->accepted_at === null && ($this->expires_at === null || $this->expires_at->isFuture());
    }

    public function accept(): void
    {
        $this->update(['accepted_at' => now()]);
    }
}
