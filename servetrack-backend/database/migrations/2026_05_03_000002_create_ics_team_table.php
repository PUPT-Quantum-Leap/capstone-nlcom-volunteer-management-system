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
        Schema::create('ics_team', function (Blueprint $table) {
            $table->id();
            $table->unsignedBigInteger('ics_id');
            $table->unsignedBigInteger('team_id');
            $table->timestamp('created_at')->useCurrent();

            $table->foreign('ics_id')
                ->references('id')
                ->on('ics')
                ->onDelete('cascade')
                ->onUpdate('cascade');

            $table->foreign('team_id')
                ->references('id')
                ->on('teams')
                ->onDelete('cascade')
                ->onUpdate('cascade');

            $table->unique(['ics_id', 'team_id'], 'ics_team_unique');
            $table->index('ics_id');
            $table->index('team_id');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('ics_team');
    }
};
