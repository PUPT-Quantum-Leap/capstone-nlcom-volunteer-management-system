<?php

use App\Enums\AuditAction;
use App\Models\AuditLog;
use App\Models\User;
use App\Services\AuditLogger;

describe('AuditLog integrity', function (): void {
    it('generates a checksum on creation', function (): void {
        $log = AuditLogger::success(AuditAction::AUTH_LOGIN);

        expect($log)->not->toBeNull()
            ->and($log->checksum)->not->toBeNull()
            ->and(strlen($log->checksum))->toBe(64); // SHA-256 hex
    });

    it('checksum is consistent — isTampered() returns false on an untouched record', function (): void {
        $log = AuditLogger::success(AuditAction::AUTH_LOGIN);

        expect($log->isTampered())->toBeFalse();
    });

    it('detects tampering when a payload field is changed directly in the DB', function (): void {
        $log = AuditLogger::success(AuditAction::AUTH_LOGIN);

        // Bypass the immutability guard and mutate directly at DB level
        Illuminate\Support\Facades\DB::table('audit_logs')
            ->where('id', $log->id)
            ->update(['status' => 'failure']);

        $tampered = AuditLog::find($log->id);

        expect($tampered->isTampered())->toBeTrue();
    });

    it('throws when update is attempted through Eloquent', function (): void {
        $log = AuditLogger::success(AuditAction::AUTH_LOGIN);

        expect(fn () => $log->update(['status' => 'failure']))
            ->toThrow(RuntimeException::class, 'immutable');
    });

    it('throws when delete is attempted through Eloquent', function (): void {
        $log = AuditLogger::success(AuditAction::AUTH_LOGIN);

        expect(fn () => $log->delete())
            ->toThrow(RuntimeException::class, 'cannot be deleted');
    });

    it('captures the authenticated user as actor', function (): void {
        $user = User::factory()->create(['role' => 'admin']);
        $this->actingAs($user);

        $log = AuditLogger::success(AuditAction::AUTH_LOGIN);

        expect($log->user_id)->toBe($user->id)
            ->and($log->actor_name)->toBe($user->name)
            ->and($log->actor_role)->toBe('admin');
    });

    it('falls back to System actor when no user is authenticated', function (): void {
        $log = AuditLogger::log(AuditAction::BACKUP_CREATED, ['source' => 'scheduler']);

        expect($log->user_id)->toBeNull()
            ->and($log->actor_name)->toBe('System')
            ->and($log->source)->toBe('scheduler');
    });
});
