<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        Schema::table('rsvp', function (Blueprint $table): void {
            $table->softDeletes('deleted_at', 0)->after('auto_closed_reason');
        });

        Schema::table('rsvp_response', function (Blueprint $table): void {
            $table->softDeletes('deleted_at', 0)->after('edit_history');
        });

        Schema::table('rsvp_shift', function (Blueprint $table): void {
            $table->softDeletes('deleted_at', 0)->after('capacity');
        });
    }

    public function down(): void
    {
        Schema::table('rsvp_shift', function (Blueprint $table): void {
            $table->dropSoftDeletes();
        });

        Schema::table('rsvp_response', function (Blueprint $table): void {
            $table->dropSoftDeletes();
        });

        Schema::table('rsvp', function (Blueprint $table): void {
            $table->dropSoftDeletes();
        });
    }
};
