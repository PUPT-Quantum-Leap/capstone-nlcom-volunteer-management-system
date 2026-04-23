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
        Schema::table('volunteer', function (Blueprint $table) {
            $table->boolean('notify_rsvp_on_dashboard')->default(true)->after('profile_photo');
            $table->boolean('notify_rsvp_on_email')->default(true)->after('notify_rsvp_on_dashboard');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('volunteer', function (Blueprint $table) {
            $table->dropColumn(['notify_rsvp_on_dashboard', 'notify_rsvp_on_email']);
        });
    }
};
