<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        // Only needed for the rename path (MySQL). In the scratch-create path,
        // the constraint is already created in rename_poll_tables_to_rsvp migration.
        if (DB::getDriverName() !== 'mysql' || ! Schema::hasTable('rsvp_shift')) {
            return;
        }

        // Check if constraint exists
        $db = config('database.connections.mysql.database');
        $exists = DB::select(
            "SELECT COUNT(*) as count FROM information_schema.STATISTICS WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'rsvp_shift' AND INDEX_NAME = 'uq_rsvp_shift'",
            [$db]
        );

        if ((int) $exists[0]->count > 0) {
            return;
        }

        Schema::table('rsvp_shift', function ($table) {
            $table->unique(['rsvp_id', 'time_slot_id'], 'uq_rsvp_shift');
        });
    }

    public function down(): void
    {
        if (! Schema::hasTable('rsvp_shift')) {
            return;
        }

        Schema::table('rsvp_shift', function ($table) {
            try {
                $table->dropUnique('uq_rsvp_shift');
            } catch (\Throwable) {
                // Constraint doesn't exist
            }
        });
    }
};
