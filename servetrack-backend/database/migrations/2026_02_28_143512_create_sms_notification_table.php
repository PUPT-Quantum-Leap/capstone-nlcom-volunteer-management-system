<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('sms_notification', function (Blueprint $table) {
            $table->id('sms_id');
            $table->unsignedBigInteger('volunteer_id');
            $table->unsignedBigInteger('rsvp_response_id')->nullable();
            $table->text('message');
            $table->timestamp('sent_date')->nullable();

            $table->foreign('volunteer_id')->references('volunteer_id')->on('volunteer')->onDelete('cascade')->onUpdate('cascade');

            $table->index('volunteer_id', 'idx_sn_volunteer_id');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('sms_notification');
    }
};
