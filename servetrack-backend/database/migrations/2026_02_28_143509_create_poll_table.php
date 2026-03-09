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
            $table->string('title', 100);
            $table->text('description')->nullable();
            $table->date('date');
            $table->string('cutoff_day', 20);
            $table->string('cutoff_time', 20);
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
