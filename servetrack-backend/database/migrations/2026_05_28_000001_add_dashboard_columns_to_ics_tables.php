<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        Schema::table('ics_team', function (Blueprint $table): void {
            $table->string('branch_key')->nullable()->after('team');
            $table->string('branch_title')->nullable()->after('branch_key');
            $table->string('team_key')->nullable()->after('branch_title');
            $table->string('vehicle')->nullable()->after('team_key');
        });

        Schema::table('ics_volunteer', function (Blueprint $table): void {
            $table->boolean('is_driver')->default(false)->after('role');
            $table->boolean('is_leader')->default(false)->after('is_driver');
        });
    }

    public function down(): void
    {
        Schema::table('ics_volunteer', function (Blueprint $table): void {
            $table->dropColumn(['is_driver', 'is_leader']);
        });

        Schema::table('ics_team', function (Blueprint $table): void {
            $table->dropColumn(['branch_key', 'branch_title', 'team_key', 'vehicle']);
        });
    }
};
