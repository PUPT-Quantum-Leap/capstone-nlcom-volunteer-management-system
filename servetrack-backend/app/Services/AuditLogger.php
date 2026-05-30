<?php

namespace App\Services;

use App\Enums\AuditAction;
use App\Models\AuditLog;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Request;

class AuditLogger
{
    /**
     * Log an audit event.
     *
     * @param  AuditAction  $action  The action being performed
     * @param  array  $options  Additional options:
     *                          - description: string          Human-readable description
     *                          - resource_type: string        Resource category ('volunteer', 'rsvp', etc.)
     *                          - resource_id: string|int      Resource identifier
     *                          - resource_label: string       Human-friendly resource name
     *                          - old_values: array            Previous state
     *                          - new_values: array            New state
     *                          - status: string               'success' | 'failure' | 'error'
     *                          - reason: string               Failure/error detail
     *                          - source: string               'web' | 'api' | 'cli' | 'scheduler' | 'system'
     *                          - user: User|null              Override the authenticated user
     */
    public static function log(AuditAction $action, array $options = []): ?AuditLog
    {
        try {
            $user = $options['user'] ?? Auth::user();

            $data = [
                'user_id' => $user?->id,
                'actor_name' => $user?->name ?? ($options['actor_name'] ?? 'System'),
                'actor_role' => $user?->role ?? ($options['actor_role'] ?? 'system'),
                'action' => $action,
                'description' => $options['description'] ?? $action->label(),
                'status' => $options['status'] ?? 'success',
                'severity' => $options['severity'] ?? $action->severity(),
                'resource_type' => $options['resource_type'] ?? null,
                'resource_id' => isset($options['resource_id']) ? (string) $options['resource_id'] : null,
                'resource_label' => $options['resource_label'] ?? null,
                'old_values' => $options['old_values'] ?? null,
                'new_values' => $options['new_values'] ?? null,
                'source' => $options['source'] ?? self::detectSource(),
                'ip_address' => Request::ip(),
                'user_agent' => Request::userAgent(),
                'reason' => $options['reason'] ?? null,
            ];

            return AuditLog::create($data);
        } catch (\Throwable $e) {
            // Audit write failure must never break the user action
            // Escalate to security log channel instead
            Log::channel('security')->error('Audit log write failed', [
                'action' => $action->value,
                'error' => $e->getMessage(),
                'options' => array_diff_key($options, array_flip(['old_values', 'new_values'])),
            ]);

            return null;
        }
    }

    /**
     * Log a successful action with minimal params.
     */
    public static function success(AuditAction $action, array $options = []): ?AuditLog
    {
        return self::log($action, array_merge($options, ['status' => 'success']));
    }

    /**
     * Log a failed action.
     */
    public static function failure(AuditAction $action, string $reason, array $options = []): ?AuditLog
    {
        return self::log($action, array_merge($options, [
            'status' => 'failure',
            'reason' => $reason,
            'severity' => 'warning',
        ]));
    }

    /**
     * Log a model change with automatic old/new value diffing.
     */
    public static function modelChanged(
        AuditAction $action,
        \Illuminate\Database\Eloquent\Model $model,
        array $options = []
    ): ?AuditLog {
        $dirty = $model->getDirty();
        $original = array_intersect_key($model->getOriginal(), $dirty);

        // Redact sensitive fields
        $sensitiveFields = ['password', 'remember_token', 'api_token', 'secret'];
        foreach ($sensitiveFields as $field) {
            if (isset($dirty[$field])) {
                $dirty[$field] = '[REDACTED]';
            }
            if (isset($original[$field])) {
                $original[$field] = '[REDACTED]';
            }
        }

        return self::log($action, array_merge([
            'resource_type' => strtolower(class_basename($model)),
            'resource_id' => $model->getKey(),
            'resource_label' => $model->name ?? $model->title ?? (string) $model->getKey(),
            'old_values' => ! empty($original) ? $original : null,
            'new_values' => ! empty($dirty) ? $dirty : null,
        ], $options));
    }

    /**
     * Detect the source context (web, cli, scheduler, etc.)
     */
    private static function detectSource(): string
    {
        if (app()->runningInConsole()) {
            // Check if it's a scheduled task
            $argv = $_SERVER['argv'] ?? [];
            if (in_array('schedule:run', $argv) || in_array('schedule:work', $argv)) {
                return 'scheduler';
            }

            return 'cli';
        }

        if (Request::is('api/*')) {
            return 'api';
        }

        return 'web';
    }
}
