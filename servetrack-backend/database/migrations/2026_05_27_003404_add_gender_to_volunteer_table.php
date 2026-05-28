<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        Schema::table('volunteer', function (Blueprint $table) {
            $table->string('gender', 10)->nullable()->after('last_medical_examination');
        });
    }

    public function down(): void
    {
        Schema::table('volunteer', function (Blueprint $table) {
            $table->dropColumn('gender');
        });
    }
};
