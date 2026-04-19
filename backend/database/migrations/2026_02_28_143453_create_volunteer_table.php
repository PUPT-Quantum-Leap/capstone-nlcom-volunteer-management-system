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
        Schema::create('volunteer', function (Blueprint $table) {
            $table->id('volunteer_id');
            $table->string('first_name', 50);
            $table->string('last_name', 50);
            $table->string('facebook_name', 100);
            $table->integer('facebook_id')->nullable();
            $table->string('email', 100);
            $table->date('birthdate');
            $table->string('address', 255);
            $table->string('mobile_number', 15);
            $table->string('educational_attainment', 100);
            $table->date('last_medical_examination');

            $table->timestamps();
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('volunteer');
    }
};
