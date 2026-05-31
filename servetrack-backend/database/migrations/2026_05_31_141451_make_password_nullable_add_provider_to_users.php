<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $table->string('password')->nullable()->change();
            $table->string('provider')->nullable()->after('role');
            $table->string('provider_id')->nullable()->after('provider');
            $table->unique(['provider', 'provider_id'], 'uniq_users_provider');
        });
    }

    public function down(): void
    {
        // Assign a random password to any SSO users with NULL password so the
        // NOT NULL constraint change below won't fail.
        DB::table('users')->whereNull('password')->each(function (object $user): void {
            DB::table('users')
                ->where('id', $user->id)
                ->update(['password' => Hash::make(bin2hex(random_bytes(16)))]);
        });

        Schema::table('users', function (Blueprint $table) {
            $table->dropUnique('uniq_users_provider');
            $table->dropColumn(['provider', 'provider_id']);
            $table->string('password')->nullable(false)->change();
        });
    }
};
