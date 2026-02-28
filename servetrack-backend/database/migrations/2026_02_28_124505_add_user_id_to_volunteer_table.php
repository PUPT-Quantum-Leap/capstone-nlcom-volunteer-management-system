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
            // Add user_id column after volunteer_id
            $table->foreignId('user_id')->after('volunteer_id')->constrained('users');
            
            // Make email nullable 
            $table->string('email')->nullable()->change();
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('volunteer', function (Blueprint $table) {
            // Drop the foreign key constraint 
            $table->dropForeign(['user_id']);
            
            // Drop the user_id column
            $table->dropColumn('user_id');
            $table->string('email')->nullable(false)->change();
        });
    }
};
