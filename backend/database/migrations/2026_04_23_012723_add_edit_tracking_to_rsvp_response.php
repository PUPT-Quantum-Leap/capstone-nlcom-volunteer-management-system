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
            $table->integer('edit_count')->default(0)->after('voted_at');
            $table->timestamp('last_edited_at')->nullable()->after('edit_count');
            $table->unsignedBigInteger('initial_time_slot_id')->nullable()->after('last_edited_at')->comment('Original shift selected');
            $table->json('edit_history')->nullable()->after('initial_time_slot_id')->comment('Audit trail of edits');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('rsvp_response', function (Blueprint $table) {
            $table->dropColumn(['edit_count', 'last_edited_at', 'initial_time_slot_id', 'edit_history']);
        });
    }
};
