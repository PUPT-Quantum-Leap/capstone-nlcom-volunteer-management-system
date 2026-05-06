<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        Schema::table('rsvp_notification', function (Blueprint $table) {
            $table->unsignedBigInteger('volunteer_id')->nullable()->change();
        });
    }

    public function down(): void
    {
        Schema::table('rsvp_notification', function (Blueprint $table) {
            $table->unsignedBigInteger('volunteer_id')->nullable(false)->change();
        });
    }
};
