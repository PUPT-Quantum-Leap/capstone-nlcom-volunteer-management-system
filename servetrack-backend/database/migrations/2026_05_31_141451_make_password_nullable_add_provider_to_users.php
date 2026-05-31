<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $table->string('password')->nullable()->change();
            $table->string('provider')->nullable()->after('role');
            $table->string('provider_id')->nullable()->after('provider');
            $table->index(['provider', 'provider_id'], 'idx_users_provider');
        });
    }

    public function down(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $table->dropIndex('idx_users_provider');
            $table->dropColumn(['provider', 'provider_id']);
            $table->string('password')->nullable(false)->change();
        });
    }
};
