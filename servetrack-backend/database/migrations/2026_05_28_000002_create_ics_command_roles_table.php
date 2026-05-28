<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        Schema::create('ics_command_roles', function (Blueprint $table): void {
            $table->id();
            $table->foreignId('ics_id')->constrained('ics')->cascadeOnDelete();
            $table->string('role_key');
            $table->string('role_title');
            $table->unsignedBigInteger('volunteer_id')->nullable();
            $table->string('assigned_name')->nullable();
            $table->timestamps();

            $table->foreign('volunteer_id')
                ->references('volunteer_id')
                ->on('volunteer')
                ->nullOnDelete()
                ->cascadeOnUpdate();

            $table->unique(['ics_id', 'role_key'], 'ics_command_roles_unique');
            $table->index('role_key');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('ics_command_roles');
    }
};
