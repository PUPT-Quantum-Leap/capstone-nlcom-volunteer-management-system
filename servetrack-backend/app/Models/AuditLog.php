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
        // Audit logs are append-only — cannot be updated
        static::updating(function () {
            throw new \RuntimeException('Audit logs are immutable and cannot be modified.');
        });

        // Audit logs cannot be deleted (only via controlled purge command)
        static::deleting(function () {
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
     * Generate a SHA-256 checksum of the log payload for tamper-evidence.
     */
    public static function generateChecksum(array $data): string
    {
        $payload = json_encode([
            'user_id' => $data['user_id'] ?? null,
            'action' => $data['action'] instanceof AuditAction ? $data['action']->value : $data['action'],
            'resource_type' => $data['resource_type'] ?? null,
            'resource_id' => $data['resource_id'] ?? null,
            'old_values' => $data['old_values'] ?? null,
            'new_values' => $data['new_values'] ?? null,
            'status' => $data['status'] ?? 'success',
            'created_at' => $data['created_at'] ?? now()->toIso8601String(),
        ], JSON_THROW_ON_ERROR);

        return hash('sha256', $payload);
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
