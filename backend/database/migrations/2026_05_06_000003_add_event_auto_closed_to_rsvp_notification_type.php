<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        Schema::table('rsvp_notification', function (Blueprint $table) {
            $table->enum('type', ['event_created', 'event_updated', 'reminder', 'event_auto_closed'])
                ->default('event_created')
                ->change();
        });
    }

    public function down(): void
    {
        Schema::table('rsvp_notification', function (Blueprint $table) {
            $table->enum('type', ['event_created', 'event_updated', 'reminder'])
                ->default('event_created')
                ->change();
        });
    }
};
