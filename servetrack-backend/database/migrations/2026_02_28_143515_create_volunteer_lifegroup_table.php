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
        Schema::create('volunteer_lifegroup', function (Blueprint $table) {
            $table->id('volunteer_lifegroup_id');
            $table->unsignedBigInteger('volunteer_id');
            $table->unsignedBigInteger('lifegroup_id');
            $table->boolean('is_leader')->default(false);

            $table->foreign('volunteer_id')->references('volunteer_id')->on('volunteer')->onDelete('cascade')->onUpdate('cascade');
            $table->foreign('lifegroup_id')->references('lifegroup_id')->on('lifegroup')->onDelete('cascade')->onUpdate('cascade');

            $table->index('volunteer_id', 'idx_vl_volunteer_id');
            $table->index('lifegroup_id', 'idx_vl_lifegroup_id');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('volunteer_lifegroup');
    }
};
