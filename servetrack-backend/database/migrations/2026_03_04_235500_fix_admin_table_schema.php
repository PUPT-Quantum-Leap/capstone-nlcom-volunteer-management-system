<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        if (! Schema::hasTable('admin')) {
            return;
        }

        Schema::table('admin', function (Blueprint $table): void {
            if (! Schema::hasColumn('admin', 'email')) {
                $table->string('email')->nullable()->unique();
            }

            if (! Schema::hasColumn('admin', 'contact_number')) {
                $table->string('contact_number', 20)->nullable();
            }

            if (! Schema::hasColumn('admin', 'user_id')) {
                $table->foreignId('user_id')->nullable()->constrained('users')->nullOnDelete();
            }

            if (! Schema::hasColumn('admin', 'created_at')) {
                $table->timestamp('created_at')->nullable();
            }

            if (! Schema::hasColumn('admin', 'updated_at')) {
                $table->timestamp('updated_at')->nullable();
            }
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        if (! Schema::hasTable('admin')) {
            return;
        }

        Schema::table('admin', function (Blueprint $table): void {
            if (Schema::hasColumn('admin', 'user_id')) {
                $table->dropForeign(['user_id']);
                $table->dropColumn('user_id');
            }

            if (Schema::hasColumn('admin', 'updated_at')) {
                $table->dropColumn('updated_at');
            }

            if (Schema::hasColumn('admin', 'created_at')) {
                $table->dropColumn('created_at');
            }

            if (Schema::hasColumn('admin', 'contact_number')) {
                $table->dropColumn('contact_number');
            }

            if (Schema::hasColumn('admin', 'email')) {
                $table->dropUnique('admin_email_unique');
                $table->dropColumn('email');
            }
        });
    }
};
