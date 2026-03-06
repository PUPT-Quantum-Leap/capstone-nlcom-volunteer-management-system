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
        Schema::create('poll_option', function (Blueprint $table) {
            $table->id('poll_option_id');
            $table->unsignedBigInteger('option_id');
            $table->unsignedBigInteger('poll_id');

            $table->foreign('option_id')->references('option_id')->on('option')->onDelete('cascade')->onUpdate('cascade');
            $table->foreign('poll_id')->references('poll_id')->on('poll')->onDelete('cascade')->onUpdate('cascade');

            $table->index('option_id', 'idx_po_option_id');
            $table->index('poll_id', 'idx_po_poll_id');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('poll_option');
    }
};
