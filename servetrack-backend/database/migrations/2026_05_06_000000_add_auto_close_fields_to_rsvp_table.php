<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        Schema::table('rsvp', function (Blueprint $table) {
            $table->timestamp('auto_closed_at')->nullable()->after('slug');
            $table->string('auto_closed_reason', 50)->nullable()->after('auto_closed_at');
            $table->enum('closed_by', ['admin', 'system'])->nullable()->default('system')->after('auto_closed_reason');

            $table->index(['status', 'auto_closed_at'], 'idx_rsvp_status_auto_closed_at');
            $table->index(['cutoff_day', 'cutoff_time'], 'idx_rsvp_cutoff_day_time');
        });
    }

    public function down(): void
    {
        Schema::table('rsvp', function (Blueprint $table) {
            $table->dropIndex('idx_rsvp_status_auto_closed_at');
            $table->dropIndex('idx_rsvp_cutoff_day_time');
            $table->dropColumn(['auto_closed_at', 'auto_closed_reason', 'closed_by']);
        });
    }
};
