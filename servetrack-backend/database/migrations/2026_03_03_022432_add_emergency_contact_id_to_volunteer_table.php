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
            $table->unsignedBigInteger('emergency_contact_id')
                ->nullable()
                ->after('user_id');
            $table->foreign('emergency_contact_id')
                ->references('emergency_contact_id')
                ->on('emergency_contact')
                ->onDelete('set null');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('volunteer', function (Blueprint $table) {
            $table->dropForeign(['emergency_contact_id']);
            $table->dropColumn('emergency_contact_id');
        });
    }
};
