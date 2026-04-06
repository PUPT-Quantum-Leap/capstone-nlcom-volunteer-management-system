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

        Schema::table('rsvp_response', function (Blueprint $table) {
            if (! Schema::hasColumn('rsvp_response', 'created_at')) {
                $table->timestamps();
            }
        });
    }

    public function down(): void
    {
        if (! Schema::hasTable('rsvp_response')) {
            return;
        }

        Schema::table('rsvp_response', function (Blueprint $table) {
            if (Schema::hasColumn('rsvp_response', 'created_at')) {
                $table->dropTimestamps();
            }
        });
    }
};
