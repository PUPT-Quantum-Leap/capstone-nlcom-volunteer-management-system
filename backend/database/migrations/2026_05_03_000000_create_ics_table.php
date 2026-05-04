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
        Schema::create('ics', function (Blueprint $table) {
            $table->id();
            $table->unsignedBigInteger('rsvp_id');
            $table->string('name');
            $table->text('description')->nullable();
            $table->date('date');
            $table->string('location')->nullable();
            $table->enum('status', ['draft', 'active', 'completed'])->default('draft');
            $table->json('ai_suggestions')->nullable();
            $table->timestamps();

            $table->foreign('rsvp_id')
                ->references('rsvp_id')
                ->on('rsvp')
                ->onDelete('cascade')
                ->onUpdate('cascade');

            $table->index('rsvp_id');
            $table->index('status');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('ics');
    }
};
