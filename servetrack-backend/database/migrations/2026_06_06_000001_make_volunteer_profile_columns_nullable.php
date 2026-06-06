<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        Schema::table('volunteer', function (Blueprint $table) {
            $table->string('facebook_name', 100)->nullable()->change();
            $table->date('birthdate')->nullable()->change();
            $table->string('address', 255)->nullable()->change();
            $table->string('educational_attainment', 100)->nullable()->change();
            $table->date('last_medical_examination')->nullable()->change();
        });
    }

    public function down(): void
    {
        Schema::table('volunteer', function (Blueprint $table) {
            $table->string('facebook_name', 100)->nullable(false)->change();
            $table->date('birthdate')->nullable(false)->change();
            $table->string('address', 255)->nullable(false)->change();
            $table->string('educational_attainment', 100)->nullable(false)->change();
            $table->date('last_medical_examination')->nullable(false)->change();
        });
    }
};
