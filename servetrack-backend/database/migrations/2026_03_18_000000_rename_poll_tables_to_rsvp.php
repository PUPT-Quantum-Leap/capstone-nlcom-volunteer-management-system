<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::rename('option', 'time_slot');

        Schema::rename('poll', 'rsvp');

        Schema::rename('poll_option', 'rsvp_shift');

        Schema::rename('poll_vote', 'rsvp_response');

        Schema::table('time_slot', function (Blueprint $table) {
            $table->renameColumn('option_id', 'time_slot_id');
        });

        Schema::table('rsvp', function (Blueprint $table) {
            $table->renameColumn('poll_id', 'rsvp_id');
        });

        Schema::table('rsvp_shift', function (Blueprint $table) {
            $table->renameColumn('poll_option_id', 'rsvp_shift_id');
        });

        Schema::table('rsvp', function (Blueprint $table) {
            $table->string('event_location', 255)->nullable()->after('date');
        });

        Schema::table('rsvp_response', function (Blueprint $table) {
            $table->timestamp('checked_in_at')->nullable()->after('facebook_name');
            $table->timestamp('checked_out_at')->nullable()->after('checked_in_at');
            $table->enum('attendance_status', ['registered', 'checked_in', 'checked_out', 'no_show'])->default('registered')->after('checked_out_at');
        });

        Schema::table('rsvp_shift', function (Blueprint $table) {
            $table->renameColumn('poll_id', 'rsvp_id');
            $table->renameColumn('option_id', 'time_slot_id');
        });

        Schema::table('rsvp_response', function (Blueprint $table) {
            $table->renameColumn('poll_id', 'rsvp_id');
            $table->renameColumn('option_id', 'time_slot_id');
            $table->dropUnique('uq_pv_volunteer_poll');
            $table->unique(['volunteer_id', 'rsvp_id'], 'uq_rsvp_volunteer_rsvp');
        });

        Schema::table('rsvp_shift', function (Blueprint $table) {
            $table->dropIndex('idx_po_poll_id');
            $table->dropIndex('idx_po_option_id');
            $table->index('rsvp_id', 'idx_rs_rsvp_id');
            $table->index('time_slot_id', 'idx_rs_time_slot_id');
        });

        Schema::table('rsvp_response', function (Blueprint $table) {
            $table->dropIndex('idx_pv_volunteer_id');
            $table->dropIndex('idx_pv_poll_id');
            $table->dropIndex('idx_pv_option_id');
            $table->index('volunteer_id', 'idx_rr_volunteer_id');
            $table->index('rsvp_id', 'idx_rr_rsvp_id');
            $table->index('time_slot_id', 'idx_rr_time_slot_id');
        });
    }

    public function down(): void
    {
        Schema::table('rsvp_response', function (Blueprint $table) {
            $table->dropIndex('idx_rr_volunteer_id');
            $table->dropIndex('idx_rr_rsvp_id');
            $table->dropIndex('idx_rr_time_slot_id');
            $table->renameColumn('rsvp_id', 'poll_id');
            $table->renameColumn('time_slot_id', 'option_id');
            $table->index('poll_id', 'idx_pv_poll_id');
            $table->index('option_id', 'idx_pv_option_id');
            $table->index('volunteer_id', 'idx_pv_volunteer_id');
        });

        Schema::table('rsvp_shift', function (Blueprint $table) {
            $table->dropIndex('idx_rs_rsvp_id');
            $table->dropIndex('idx_rs_time_slot_id');
            $table->renameColumn('rsvp_id', 'poll_id');
            $table->renameColumn('time_slot_id', 'option_id');
            $table->index('poll_id', 'idx_po_poll_id');
            $table->index('option_id', 'idx_po_option_id');
        });

        Schema::table('rsvp_response', function (Blueprint $table) {
            $table->dropUnique('uq_rsvp_volunteer_rsvp');
            $table->unique(['volunteer_id', 'poll_id'], 'uq_pv_volunteer_poll');
        });

        Schema::table('rsvp_response', function (Blueprint $table) {
            $table->dropColumn('attendance_status');
            $table->dropColumn('checked_out_at');
            $table->dropColumn('checked_in_at');
        });

        Schema::table('rsvp', function (Blueprint $table) {
            $table->dropColumn('event_location');
        });

        Schema::rename('rsvp_response', 'poll_vote');
        Schema::rename('rsvp_shift', 'poll_option');
        Schema::rename('rsvp', 'poll');
        Schema::rename('time_slot', 'option');
    }
};
