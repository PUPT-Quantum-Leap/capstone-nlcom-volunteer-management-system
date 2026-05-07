<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        Schema::create('rsvp_audit_trail', function (Blueprint $table) {
            $table->id('audit_id');
            $table->unsignedBigInteger('rsvp_id');
            $table->enum('action', ['auto_closed', 'manual_closed', 'status_changed', 'edited', 'deleted', 'restored'])->default('auto_closed');
            $table->string('triggered_by', 50)->nullable();
            $table->text('reason')->nullable();
            $table->json('metadata')->nullable();
            $table->timestamps();

            $table->index('rsvp_id');
            $table->index('action');
            $table->index('triggered_by');

            $table->foreign('rsvp_id')->references('rsvp_id')->on('rsvp')->cascadeOnDelete();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('rsvp_audit_trail');
    }
};
