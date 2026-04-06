<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (! Schema::hasTable('rsvp_response')) {
            return;
        }

        $columns = [];
        if (Schema::hasColumn('rsvp_response', 'facebook_id')) {
            $columns[] = 'facebook_id';
        }
        if (Schema::hasColumn('rsvp_response', 'facebook_name')) {
            $columns[] = 'facebook_name';
        }

        if (empty($columns)) {
            return;
        }

        Schema::table('rsvp_response', function (Blueprint $table) use ($columns) {
            $table->dropColumn($columns);
        });
    }

    public function down(): void
    {
        if (! Schema::hasTable('rsvp_response')) {
            return;
        }

        Schema::table('rsvp_response', function (Blueprint $table) {
            if (! Schema::hasColumn('rsvp_response', 'facebook_id')) {
                $table->unsignedDecimal('facebook_id', 20)->nullable()->after('sms_sent');
            }
            if (! Schema::hasColumn('rsvp_response', 'facebook_name')) {
                $table->string('facebook_name', 255)->nullable()->after('facebook_id');
            }
        });
    }
};
