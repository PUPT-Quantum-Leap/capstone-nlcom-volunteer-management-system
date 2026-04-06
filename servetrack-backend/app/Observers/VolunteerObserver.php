<?php

namespace App\Observers;

use App\Models\ProfileChangeLog;
use App\Models\Volunteer;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\DB;

class VolunteerObserver
{
    /**
     * Handle the Volunteer "created" event.
     */
    public function created(Volunteer $volunteer): void
    {
        //
    }

    /**
     * Handle the Volunteer "updated" event.
     */
    public function updating(Volunteer $volunteer): void
    {
        $dirty = $volunteer->getDirty();
        $original = $volunteer->getOriginal();
        $userId = Auth::id() ?? $volunteer->user_id;
        $ip = request()->ip();

        $logs = [];

        foreach ($dirty as $field => $newValue) {
            $oldValue = $original[$field] ?? null;

            if (in_array($field, ['created_at', 'updated_at'])) {
                continue;
            }

            $normalizedOld = $this->normalizeValue($oldValue);
            $normalizedNew = $this->normalizeValue($newValue);

            if ($normalizedOld === $normalizedNew) {
                continue;
            }

            $logs[] = [
                'volunteer_id' => $volunteer->volunteer_id,
                'changed_by_user_id' => $userId,
                'field_name' => $field,
                'old_value' => $normalizedOld,
                'new_value' => $normalizedNew,
                'ip_address' => $ip,
                'created_at' => now(),
                'updated_at' => now(),
            ];
        }

        if (! empty($logs)) {
            DB::transaction(function () use ($logs): void {
                ProfileChangeLog::insert($logs);
            });
        }
    }

    /**
     * Normalize a value for comparison.
     */
    private function normalizeValue(mixed $value): string
    {
        if ($value === null) {
            return '';
        }

        if ($value instanceof \Carbon\Carbon) {
            return $value->format('Y-m-d');
        }

        return (string) $value;
    }

    /**
     * Handle the Volunteer "deleted" event.
     */
    public function deleted(Volunteer $volunteer): void
    {
        //
    }

    /**
     * Handle the Volunteer "restored" event.
     */
    public function restored(Volunteer $volunteer): void
    {
        //
    }

    /**
     * Handle the Volunteer "force deleted" event.
     */
    public function forceDeleted(Volunteer $volunteer): void
    {
        //
    }
}
