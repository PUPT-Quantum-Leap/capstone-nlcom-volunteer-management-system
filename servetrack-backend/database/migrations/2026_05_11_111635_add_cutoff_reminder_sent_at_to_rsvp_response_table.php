<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        Schema::table('rsvp_response', function (Blueprint $table) {
            $table->timestamp('cutoff_reminder_sent_at')->nullable()->after('edit_history');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('rsvp_response', function (Blueprint $table) {
            $table->dropColumn('cutoff_reminder_sent_at');
        });
    }
};
