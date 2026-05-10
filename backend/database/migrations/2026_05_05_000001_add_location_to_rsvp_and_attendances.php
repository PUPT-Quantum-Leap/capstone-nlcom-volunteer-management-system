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
        // Add location_id to RSVP table to link to locations table
        Schema::table('rsvp', function (Blueprint $table) {
            $table->unsignedBigInteger('location_id')->nullable()->after('event_location');
            $table->foreign('location_id')
                ->references('location_id')
                ->on('locations')
                ->onDelete('set null')
                ->onUpdate('cascade');
            $table->index('location_id');
        });

        // Add location column to attendances table
        Schema::table('attendances', function (Blueprint $table) {
            $table->string('location', 255)->nullable()->after('description');
            $table->unsignedBigInteger('rsvp_id')->nullable()->after('location');
            $table->foreign('rsvp_id')
                ->references('rsvp_id')
                ->on('rsvp')
                ->onDelete('set null')
                ->onUpdate('cascade');
            $table->index('rsvp_id');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('attendances', function (Blueprint $table) {
            $table->dropForeign(['rsvp_id']);
            $table->dropIndex(['rsvp_id']);
            $table->dropColumn('rsvp_id');
            $table->dropColumn('location');
        });

        Schema::table('rsvp', function (Blueprint $table) {
            $table->dropForeign(['location_id']);
            $table->dropIndex(['location_id']);
            $table->dropColumn('location_id');
        });
    }
};
