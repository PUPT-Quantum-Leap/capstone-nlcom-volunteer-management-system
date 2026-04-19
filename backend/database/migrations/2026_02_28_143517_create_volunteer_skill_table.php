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
        Schema::create('volunteer_skill', function (Blueprint $table) {
            $table->id('volunteer_skill_id');
            $table->unsignedBigInteger('volunteer_id');
            $table->unsignedBigInteger('skill_id');

            $table->foreign('volunteer_id')->references('volunteer_id')->on('volunteer')->onDelete('cascade')->onUpdate('cascade');
            $table->foreign('skill_id')->references('skill_id')->on('skill')->onDelete('cascade')->onUpdate('cascade');

            $table->index('volunteer_id', 'idx_vs_volunteer_id');
            $table->index('skill_id', 'idx_vs_skill_id');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('volunteer_skill');
    }
};
