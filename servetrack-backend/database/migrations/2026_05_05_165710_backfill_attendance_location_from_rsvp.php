<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;
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

        $rows = DB::table('attendances')
            ->whereNull('location')
            ->whereNotNull('rsvp_id')
            ->select('attendance_id', 'rsvp_id')
            ->get();

        foreach ($rows as $row) {
            $rsvp = DB::table('rsvp')
                ->where('rsvp_id', $row->rsvp_id)
                ->select('event_location')
                ->first();

            if (! $rsvp) {
                continue;
            }

            $location = $rsvp->event_location;
            if (! empty($location)) {
                DB::table('attendances')
                    ->where('attendance_id', $row->attendance_id)
                    ->update(['location' => $location]);
            }
        }
    }

    public function down(): void
    {
        // Irreversible backfill: we can't know the original location values.
    }
};
