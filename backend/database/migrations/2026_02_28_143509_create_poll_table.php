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
        Schema::create('poll', function (Blueprint $table) {
            $table->id('poll_id');
            $table->string('title', 255);
            $table->text('description')->nullable();
            $table->date('date');
            $table->date('cutoff_day');
            $table->time('cutoff_time')->nullable();
            $table->enum('status', ['draft', 'active', 'closed'])->default('draft');
            $table->string('share_url', 500)->nullable();
            $table->timestamps();
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('poll');
    }
};
