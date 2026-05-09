<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class BackupScheduleSetting extends Model
{
    protected $fillable = [
        'enabled',
        'frequency',
    ];

    protected function casts(): array
    {
        return [
            'enabled' => 'boolean',
        ];
    }

    /**
     * Singleton-style settings row: ensures exactly one persisted schedule
     * configuration.
     */
    public static function current(): self
    {
        $existing = static::query()->first();

        if ($existing !== null) {
            return $existing;
        }

        return static::query()->create([
            'enabled' => (bool) config('backup.schedule.enabled', false),
            'frequency' => config('backup.schedule.frequency', 'weekly'),
        ]);
    }

    /**
     * Whether an automatic backup should run today for this cadence, evaluated in
     * the configured schedule timezone (daily = always when invoked at scheduled
     * time; weekly = Sundays; monthly = first calendar day).
     */
    public function shouldCreateBackupToday(): bool
    {
        $timezone = config('backup.schedule.timezone', 'UTC');
        $now = now()->timezone($timezone);

        return match ($this->frequency) {
            'daily' => true,
            'weekly' => $now->dayOfWeek === 0,
            'monthly' => (int) $now->format('j') === 1,
            default => false,
        };
    }
}
