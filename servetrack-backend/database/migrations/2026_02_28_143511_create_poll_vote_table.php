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
        Schema::create('poll_vote', function (Blueprint $table) {
            $table->id('poll_vote_id');
            $table->unsignedBigInteger('volunteer_id');
            $table->unsignedBigInteger('poll_id');
            $table->unsignedBigInteger('option_id');
            $table->timestamp('voted_at')->nullable();
            $table->boolean('sms_sent')->default(false);
            $table->string('facebook_id', 100)->nullable();
            $table->string('facebook_name', 100)->nullable();

            $table->foreign('volunteer_id')->references('volunteer_id')->on('volunteer')->onDelete('cascade')->onUpdate('cascade');
            $table->foreign('poll_id')->references('poll_id')->on('poll')->onDelete('cascade')->onUpdate('cascade');
            $table->foreign('option_id')->references('option_id')->on('option')->onDelete('restrict')->onUpdate('cascade');

            $table->unique(['volunteer_id', 'poll_id'], 'uq_pv_volunteer_poll');
            $table->index('volunteer_id', 'idx_pv_volunteer_id');
            $table->index('poll_id', 'idx_pv_poll_id');
            $table->index('option_id', 'idx_pv_option_id');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('poll_vote');
    }
};
