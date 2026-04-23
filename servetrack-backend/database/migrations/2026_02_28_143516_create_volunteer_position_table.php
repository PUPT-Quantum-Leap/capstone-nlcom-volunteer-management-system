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
        Schema::create('volunteer_position', function (Blueprint $table) {
            $table->id('volunteer_position_id');
            $table->unsignedBigInteger('volunteer_id');
            $table->unsignedBigInteger('position_id');

            $table->foreign('volunteer_id')->references('volunteer_id')->on('volunteer')->onDelete('cascade')->onUpdate('cascade');
            $table->foreign('position_id')->references('position_id')->on('position')->onDelete('cascade')->onUpdate('cascade');

            $table->index('volunteer_id', 'idx_vp_volunteer_id');
            $table->index('position_id', 'idx_vp_position_id');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('volunteer_position');
    }
};
