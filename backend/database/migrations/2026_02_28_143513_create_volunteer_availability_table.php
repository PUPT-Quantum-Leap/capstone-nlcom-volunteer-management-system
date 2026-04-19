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
        Schema::create('volunteer_availability', function (Blueprint $table) {
            $table->id('volunteer_availability_id');
            $table->unsignedBigInteger('volunteer_id');
            $table->unsignedBigInteger('availability_id');
            $table->string('custom_description', 100)->nullable();

            $table->foreign('volunteer_id')->references('volunteer_id')->on('volunteer')->onDelete('cascade')->onUpdate('cascade');
            $table->foreign('availability_id')->references('availability_id')->on('availability')->onDelete('cascade')->onUpdate('cascade');

            $table->index('volunteer_id', 'idx_va_volunteer_id');
            $table->index('availability_id', 'idx_va_availability_id');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('volunteer_availability');
    }
};
