<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    /**
     * Run the migrations.
     *
     * Add indexes to frequently queried columns in the attendances table
     * to improve query performance for volunteer attendance lookups.
     */
    public function up(): void
    {
        Schema::table('attendances', function (Blueprint $table) {
            // Index for volunteer-specific attendance queries
            $table->index('volunteer_id', 'idx_attendances_volunteer_id');

            // Composite index for common query pattern: volunteer + status
            $table->index(['volunteer_id', 'status'], 'idx_attendances_volunteer_status');

            // Index for date-based queries (filtering by date range)
            $table->index('date', 'idx_attendances_date');

            // Index for status filtering
            $table->index('status', 'idx_attendances_status');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('attendances', function (Blueprint $table) {
            $table->dropIndex('idx_attendances_volunteer_id');
            $table->dropIndex('idx_attendances_volunteer_status');
            $table->dropIndex('idx_attendances_date');
            $table->dropIndex('idx_attendances_status');
        });
    }
};
