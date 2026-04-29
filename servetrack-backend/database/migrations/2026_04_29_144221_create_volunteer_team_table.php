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
        Schema::create('volunteer_team', function (Blueprint $table) {
            $table->id();
            $table->unsignedBigInteger('volunteer_id');
            $table->unsignedBigInteger('team_id');

            $table->foreign('volunteer_id')
                ->references('volunteer_id')
                ->on('volunteer')
                ->onDelete('cascade')
                ->onUpdate('cascade');

            $table->foreign('team_id')
                ->references('id')
                ->on('teams')
                ->onDelete('cascade')
                ->onUpdate('cascade');

            // Add composite unique constraint to prevent duplicate volunteer-team pairs
            $table->unique(['volunteer_id', 'team_id'], 'volunteer_team_unique');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('volunteer_team');
    }
};
