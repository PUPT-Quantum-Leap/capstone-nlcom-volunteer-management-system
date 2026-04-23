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
        Schema::create('volunteer_training', function (Blueprint $table) {
            $table->id('volunteer_training_id');
            $table->unsignedBigInteger('volunteer_id');
            $table->unsignedBigInteger('training_id');

            $table->foreign('volunteer_id')->references('volunteer_id')->on('volunteer')->onDelete('cascade')->onUpdate('cascade');
            $table->foreign('training_id')->references('training_id')->on('training')->onDelete('cascade')->onUpdate('cascade');

            $table->index('volunteer_id', 'idx_vt_volunteer_id');
            $table->index('training_id', 'idx_vt_training_id');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('volunteer_training');
    }
};
