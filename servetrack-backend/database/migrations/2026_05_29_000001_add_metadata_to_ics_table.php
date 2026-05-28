<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        Schema::table('ics', function (Blueprint $table): void {
            $table->unsignedInteger('objective')->nullable()->after('location');
            $table->string('menu')->nullable()->after('objective');
            $table->unsignedInteger('meal_breakfast')->default(0)->after('menu');
            $table->unsignedInteger('meal_lunch')->default(0)->after('meal_breakfast');
            $table->unsignedInteger('meal_snacks')->default(0)->after('meal_lunch');
        });
    }

    public function down(): void
    {
        Schema::table('ics', function (Blueprint $table): void {
            $table->dropColumn(['objective', 'menu', 'meal_breakfast', 'meal_lunch', 'meal_snacks']);
        });
    }
};
