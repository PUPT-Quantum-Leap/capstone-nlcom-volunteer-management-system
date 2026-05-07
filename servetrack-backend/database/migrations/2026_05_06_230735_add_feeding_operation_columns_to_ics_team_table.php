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
        Schema::table('ics_team', function (Blueprint $table) {
            $table->string('team')->after('team_id');
            $table->string('departure_note')->nullable()->after('team');
            $table->string('location')->nullable()->after('departure_note');
            $table->integer('no_of_pax')->nullable()->after('location');
            $table->text('details')->nullable()->after('no_of_pax');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('ics_team', function (Blueprint $table) {
            $table->dropColumn(['team', 'departure_note', 'location', 'no_of_pax', 'details']);
        });
    }
};
