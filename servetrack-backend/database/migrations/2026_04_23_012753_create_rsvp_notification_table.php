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
        Schema::create('rsvp_notification', function (Blueprint $table) {
            $table->id('notification_id');
            $table->unsignedBigInteger('volunteer_id');
            $table->unsignedBigInteger('rsvp_id');
            $table->enum('type', ['event_created', 'event_updated', 'reminder'])->default('event_created');
            $table->text('message');
            $table->timestamp('read_at')->nullable();
            $table->boolean('email_sent')->default(false);
            $table->timestamps();

            $table->index('volunteer_id');
            $table->index('rsvp_id');
            $table->index('read_at');

            $table->foreign('volunteer_id')->references('volunteer_id')->on('volunteer')->cascadeOnDelete();
            $table->foreign('rsvp_id')->references('rsvp_id')->on('rsvp')->cascadeOnDelete();
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('rsvp_notification');
    }
};
