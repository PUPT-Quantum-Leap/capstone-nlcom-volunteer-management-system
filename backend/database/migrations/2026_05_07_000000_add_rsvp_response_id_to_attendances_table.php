<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        Schema::table('attendances', function (Blueprint $table) {
            if (Schema::hasColumn('attendances', 'rsvp_response_id')) {
                return;
            }

            $table->unsignedBigInteger('rsvp_response_id')->nullable()->after('rsvp_id');
            $table->index('rsvp_response_id');
            $table->foreign('rsvp_response_id')
                ->references('rsvp_response_id')
                ->on('rsvp_response')
                ->nullOnDelete()
                ->cascadeOnUpdate();
        });
    }

    public function down(): void
    {
        Schema::table('attendances', function (Blueprint $table) {
            if (! Schema::hasColumn('attendances', 'rsvp_response_id')) {
                return;
            }

            $table->dropForeign(['rsvp_response_id']);
            $table->dropIndex(['rsvp_response_id']);
            $table->dropColumn('rsvp_response_id');
        });
    }
};
