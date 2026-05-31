<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        Schema::table('volunteer', function (Blueprint $table) {
            if (Schema::hasColumn('volunteer', 'facebook_id')) {
                $table->dropColumn('facebook_id');
            }
            if (Schema::hasColumn('volunteer', 'messenger_psid')) {
                $table->dropColumn('messenger_psid');
            }
        });

        Schema::table('rsvp_response', function (Blueprint $table) {
            if (Schema::hasColumn('rsvp_response', 'facebook_id')) {
                $table->dropColumn('facebook_id');
            }
        });
    }

    public function down(): void
    {
        Schema::table('volunteer', function (Blueprint $table) {
            if (! Schema::hasColumn('volunteer', 'facebook_id')) {
                $table->integer('facebook_id')->nullable();
            }
            if (! Schema::hasColumn('volunteer', 'messenger_psid')) {
                $table->string('messenger_psid')->nullable();
            }
        });

        Schema::table('rsvp_response', function (Blueprint $table) {
            if (! Schema::hasColumn('rsvp_response', 'facebook_id')) {
                $table->string('facebook_id', 100)->nullable();
            }
        });
    }
};
