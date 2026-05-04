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
        Schema::create('ics_volunteer', function (Blueprint $table) {
            $table->id();
            $table->unsignedBigInteger('ics_id');
            $table->unsignedBigInteger('volunteer_id');
            $table->unsignedBigInteger('team_id')->nullable();
            $table->string('role')->nullable();
            $table->timestamp('assigned_at')->nullable();

            $table->foreign('ics_id')
                ->references('id')
                ->on('ics')
                ->onDelete('cascade')
                ->onUpdate('cascade');

            $table->foreign('volunteer_id')
                ->references('volunteer_id')
                ->on('volunteer')
                ->onDelete('cascade')
                ->onUpdate('cascade');

            $table->foreign('team_id')
                ->references('id')
                ->on('teams')
                ->onDelete('set null')
                ->onUpdate('cascade');

            $table->unique(['ics_id', 'volunteer_id'], 'ics_volunteer_unique');
            $table->index('ics_id');
            $table->index('volunteer_id');
            $table->index('team_id');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('ics_volunteer');
    }
};
