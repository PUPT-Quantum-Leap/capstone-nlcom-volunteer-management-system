<?php

namespace App\Models;

use App\Enums\AuditAction;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class AuditLog extends Model
{
    protected $fillable = [
        'user_id',
        'actor_name',
        'actor_role',
        'action',
        'description',
        'status',
        'severity',
        'resource_type',
        'resource_id',
        'resource_label',
        'old_values',
        'new_values',
        'source',
        'ip_address',
        'user_agent',
        'reason',
        'checksum',
    ];

    protected $casts = [
        'old_values' => 'array',
        'new_values' => 'array',
        'action' => AuditAction::class,
    ];

    // ═══════════════ Immutability ═══════════════

    protected static function booted(): void
    {
        static::creating(function (AuditLog $log): void {
            $log->checksum = $log->computeChecksum();
        });

        static::updating(function (): never {
            throw new \RuntimeException('Audit logs are immutable and cannot be modified.');
        });

        static::deleting(function (): never {
            throw new \RuntimeException('Audit logs cannot be deleted through the application.');
        });
    }

    // ═══════════════ Relationships ═══════════════

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    // ═══════════════ Checksum ═══════════════

    /**
     * Compute a SHA-256 checksum from this model's persisted payload fields.
     * Called on creating so created_at is already set by Eloquent.
     */
    public function computeChecksum(): string
    {
        return hash('sha256', json_encode([
            'user_id' => $this->user_id,
            'action' => $this->action instanceof AuditAction ? $this->action->value : $this->action,
            'resource_type' => $this->resource_type,
            'resource_id' => $this->resource_id,
            'old_values' => $this->old_values,
            'new_values' => $this->new_values,
            'status' => $this->status,
        ], JSON_THROW_ON_ERROR));
    }

    /**
     * Returns true if the stored checksum no longer matches the row's payload.
     * Any DB-level tampering will cause this to return true.
     */
    public function isTampered(): bool
    {
        return $this->checksum !== $this->computeChecksum();
    }

    // ═══════════════ Scopes ═══════════════

    public function scopeForAction($query, AuditAction $action)
    {
        return $query->where('action', $action->value);
    }

    public function scopeForResource($query, string $type, ?string $id = null)
    {
        $query->where('resource_type', $type);
        if ($id !== null) {
            $query->where('resource_id', $id);
        }

        return $query;
    }

    public function scopeForUser($query, int $userId)
    {
        return $query->where('user_id', $userId);
    }

    public function scopeBySeverity($query, string $severity)
    {
        return $query->where('severity', $severity);
    }

    public function scopeByCategory($query, string $category)
    {
        return $query->where('action', 'like', $category.'.%');
    }

    public function scopeDateRange($query, ?string $from, ?string $to)
    {
        if ($from) {
            $query->where('created_at', '>=', $from);
        }
        if ($to) {
            $query->where('created_at', '<=', $to);
        }

        return $query;
    }
}
