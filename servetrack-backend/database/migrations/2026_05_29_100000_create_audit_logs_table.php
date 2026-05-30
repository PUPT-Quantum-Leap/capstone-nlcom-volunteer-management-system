<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        Schema::create('audit_logs', function (Blueprint $table) {
            $table->id(); // doubles as monotonic sequence
            $table->foreignId('user_id')->nullable()->constrained()->nullOnDelete();

            // Who (denormalized snapshot at time of event)
            $table->string('actor_name')->nullable();
            $table->string('actor_role')->nullable();

            // What
            $table->string('action');              // e.g. 'auth.login', 'volunteer.created'
            $table->text('description')->nullable(); // human-readable summary
            $table->string('status')->default('success'); // success | failure | error
            $table->string('severity')->default('info');  // info | warning | error | critical

            // Where (resource)
            $table->string('resource_type')->nullable(); // 'volunteer', 'rsvp', 'backup'
            $table->string('resource_id')->nullable();
            $table->string('resource_label')->nullable(); // denormalized: "John Doe", "RSVP #12"

            // Change data
            $table->json('old_values')->nullable();
            $table->json('new_values')->nullable();

            // Context
            $table->string('source')->default('web'); // web | api | cli | scheduler | system
            $table->ipAddress('ip_address')->nullable();
            $table->text('user_agent')->nullable();
            $table->text('reason')->nullable(); // failure/error detail

            // Tamper evidence
            $table->string('checksum', 64)->nullable(); // SHA-256

            $table->timestamps();

            // Indexes for efficient querying
            $table->index(['action', 'created_at']);
            $table->index(['resource_type', 'resource_id']);
            $table->index('user_id');
            $table->index('severity');
            $table->index('source');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('audit_logs');
    }
};
