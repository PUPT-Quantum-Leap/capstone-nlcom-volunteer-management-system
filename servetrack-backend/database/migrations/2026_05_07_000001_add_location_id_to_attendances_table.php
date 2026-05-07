<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        Schema::table('attendances', function (Blueprint $table) {
            if (Schema::hasColumn('attendances', 'location_id')) {
                return;
            }

            $table->unsignedBigInteger('location_id')->nullable()->after('location');
            $table->foreign('location_id')
                ->references('location_id')
                ->on('locations')
                ->nullOnDelete()
                ->cascadeOnUpdate();
            $table->index('location_id');
        });
    }

    public function down(): void
    {
        Schema::table('attendances', function (Blueprint $table) {
            if (! Schema::hasColumn('attendances', 'location_id')) {
                return;
            }

            $table->dropForeign(['location_id']);
            $table->dropIndex(['location_id']);
            $table->dropColumn('location_id');
        });
    }
};
