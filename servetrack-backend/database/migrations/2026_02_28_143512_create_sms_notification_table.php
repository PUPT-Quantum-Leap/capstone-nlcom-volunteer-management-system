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
        Schema::create('sms_notification', function (Blueprint $table) {
            $table->id('sms_id');
            $table->unsignedBigInteger('volunteer_id');
            $table->unsignedBigInteger('poll_vote_id');
            $table->text('message');
            $table->date('sent_date');

            $table->foreign('volunteer_id')->references('volunteer_id')->on('volunteer')->onDelete('cascade')->onUpdate('cascade');
            $table->foreign('poll_vote_id')->references('poll_vote_id')->on('poll_vote')->onDelete('cascade')->onUpdate('cascade');

            $table->index('volunteer_id', 'idx_sn_volunteer_id');
            $table->index('poll_vote_id', 'idx_sn_poll_vote_id');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('sms_notification');
    }
};
