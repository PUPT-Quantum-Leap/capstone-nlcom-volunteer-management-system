<?php

use App\Models\Attendance;
use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        if (! Schema::hasTable('attendances') || ! Schema::hasTable('rsvp')) {
            return;
        }

        if (! Schema::hasColumn('attendances', 'rsvp_id') || ! Schema::hasColumn('attendances', 'location')) {
            return;
        }

        $driver = DB::connection()->getDriverName();

        if ($driver === 'mysql') {
            DB::statement('
                UPDATE attendances a
                JOIN rsvp r ON a.rsvp_id = r.rsvp_id
                SET a.location = r.event_location
                WHERE a.location IS NULL 
                  AND r.event_location IS NOT NULL
                  AND a.rsvp_id IS NOT NULL
            ');
        } else {
            // Fallback for non-MySQL drivers if needed, but since the project uses MySQL 8.0...
            $rows = Attendance::query()
                ->from('attendances', 'a')
                ->join('rsvp as r', 'a.rsvp_id', '=', 'r.rsvp_id')
                ->whereNull('a.location')
                ->whereNotNull('r.event_location')
                ->select('a.attendance_id', 'r.event_location')
                ->get();

            foreach ($rows as $row) {
                Attendance::query()
                    ->where('attendance_id', $row->attendance_id)
                    ->update(['location' => $row->event_location]);
            }
        }
    }

    public function down(): void
    {
        // Irreversible backfill: we can't know the original location values.
    }
};
