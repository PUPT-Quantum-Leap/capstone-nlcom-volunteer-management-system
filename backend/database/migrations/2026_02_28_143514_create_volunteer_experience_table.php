<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        Schema::create('volunteer_experience', function (Blueprint $table) {
            $table->id('volunteer_experience_id');
            $table->unsignedBigInteger('volunteer_id');
            $table->unsignedBigInteger('experience_id');

            $table->foreign('volunteer_id')->references('volunteer_id')->on('volunteer')->onDelete('cascade')->onUpdate('cascade');
            $table->foreign('experience_id')->references('experience_id')->on('experience')->onDelete('cascade')->onUpdate('cascade');

            $table->index('volunteer_id', 'idx_ve_volunteer_id');
            $table->index('experience_id', 'idx_ve_experience_id');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('volunteer_experience');
    }
};
