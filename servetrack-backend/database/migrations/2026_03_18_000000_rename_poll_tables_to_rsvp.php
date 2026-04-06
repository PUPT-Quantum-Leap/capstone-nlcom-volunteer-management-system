<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        $pollTablesExist = Schema::hasTable('option') && Schema::hasTable('poll');

        if ($pollTablesExist) {
            $this->renameExistingTables();
        } else {
            $this->createTablesFromScratch();
        }
    }

    protected function renameExistingTables(): void
    {
        Schema::rename('option', 'time_slot');
        Schema::rename('poll', 'rsvp');
        Schema::rename('poll_option', 'rsvp_shift');
        Schema::rename('poll_vote', 'rsvp_response');

        Schema::table('time_slot', function (Blueprint $table) {
            $table->renameColumn('option_id', 'time_slot_id');
        });

        Schema::table('rsvp', function (Blueprint $table) {
            $table->renameColumn('poll_id', 'rsvp_id');
        });

        Schema::table('rsvp_shift', function (Blueprint $table) {
            $table->renameColumn('poll_option_id', 'rsvp_shift_id');
        });

        Schema::table('rsvp', function (Blueprint $table) {
            $table->string('event_location', 255)->nullable()->after('date');
        });

        Schema::table('rsvp_response', function (Blueprint $table) {
            $table->timestamp('checked_in_at')->nullable()->after('facebook_name');
            $table->timestamp('checked_out_at')->nullable()->after('checked_in_at');
            $table->enum('attendance_status', ['registered', 'checked_in', 'checked_out', 'no_show'])->default('registered')->after('checked_out_at');
        });

        if (DB::getDriverName() === 'mysql') {
            $db = config('database.connections.mysql.database');
            $fks = DB::select(
                "SELECT CONSTRAINT_NAME FROM information_schema.KEY_COLUMN_USAGE WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'rsvp_shift' AND REFERENCED_TABLE_NAME IS NOT NULL",
                [$db]
            );
            foreach ($fks as $fk) {
                DB::statement("ALTER TABLE `rsvp_shift` DROP FOREIGN KEY `{$fk->CONSTRAINT_NAME}`");
            }
        }

        Schema::table('rsvp_shift', function (Blueprint $table) {
            $table->dropIndex('idx_po_poll_id');
            $table->dropIndex('idx_po_option_id');
        });

        Schema::table('rsvp_shift', function (Blueprint $table) {
            $table->renameColumn('poll_id', 'rsvp_id');
            $table->renameColumn('option_id', 'time_slot_id');
        });

        Schema::table('rsvp_shift', function (Blueprint $table) {
            $table->index('rsvp_id', 'idx_rs_rsvp_id');
            $table->index('time_slot_id', 'idx_rs_time_slot_id');
            $table->foreign('rsvp_id')->references('rsvp_id')->on('rsvp')->onDelete('cascade')->onUpdate('cascade');
            $table->foreign('time_slot_id')->references('time_slot_id')->on('time_slot')->onDelete('restrict')->onUpdate('cascade');
        });

        if (DB::getDriverName() === 'mysql') {
            $db = config('database.connections.mysql.database');
            $fks = DB::select(
                "SELECT CONSTRAINT_NAME FROM information_schema.KEY_COLUMN_USAGE WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'rsvp_response' AND REFERENCED_TABLE_NAME IS NOT NULL",
                [$db]
            );
            foreach ($fks as $fk) {
                DB::statement("ALTER TABLE `rsvp_response` DROP FOREIGN KEY `{$fk->CONSTRAINT_NAME}`");
            }
        }

        Schema::table('rsvp_response', function (Blueprint $table) {
            $table->dropUnique('uq_pv_volunteer_poll');
            $table->dropIndex('idx_pv_volunteer_id');
            $table->dropIndex('idx_pv_poll_id');
            $table->dropIndex('idx_pv_option_id');
        });

        Schema::table('rsvp_response', function (Blueprint $table) {
            $table->renameColumn('poll_id', 'rsvp_id');
            $table->renameColumn('option_id', 'time_slot_id');
        });

        Schema::table('rsvp_response', function (Blueprint $table) {
            $table->unique(['volunteer_id', 'rsvp_id'], 'uq_rsvp_volunteer_rsvp');
            $table->index('volunteer_id', 'idx_rr_volunteer_id');
            $table->index('rsvp_id', 'idx_rr_rsvp_id');
            $table->index('time_slot_id', 'idx_rr_time_slot_id');
            $table->foreign('volunteer_id')->references('volunteer_id')->on('volunteer')->onDelete('cascade')->onUpdate('cascade');
            $table->foreign('rsvp_id')->references('rsvp_id')->on('rsvp')->onDelete('cascade')->onUpdate('cascade');
            $table->foreign('time_slot_id')->references('time_slot_id')->on('time_slot')->onDelete('restrict')->onUpdate('cascade');
        });
    }

    protected function createTablesFromScratch(): void
    {
        Schema::create('time_slot', function (Blueprint $table) {
            $table->id('time_slot_id');
            $table->string('text', 255)->unique();
        });

        Schema::create('rsvp', function (Blueprint $table) {
            $table->id('rsvp_id');
            $table->string('title', 255);
            $table->text('description')->nullable();
            $table->date('date');
            $table->string('event_location', 255)->nullable();
            $table->date('cutoff_day');
            $table->time('cutoff_time');
            $table->string('status')->default('draft');
            $table->string('share_url')->nullable();
            $table->timestamps();
        });

        Schema::create('rsvp_shift', function (Blueprint $table) {
            $table->id('rsvp_shift_id');
            $table->unsignedBigInteger('rsvp_id');
            $table->unsignedBigInteger('time_slot_id');
            $table->string('time_slot', 255);
            $table->unsignedInteger('capacity');

            $table->unique(['rsvp_id', 'time_slot_id'], 'uq_rsvp_shift');
            $table->foreign('rsvp_id')->references('rsvp_id')->on('rsvp')->onDelete('cascade')->onUpdate('cascade');
            $table->foreign('time_slot_id')->references('time_slot_id')->on('time_slot')->onDelete('restrict')->onUpdate('cascade');

            $table->index('rsvp_id', 'idx_rs_rsvp_id');
            $table->index('time_slot_id', 'idx_rs_time_slot_id');
        });

        Schema::create('rsvp_response', function (Blueprint $table) {
            $table->id('rsvp_response_id');
            $table->unsignedBigInteger('volunteer_id');
            $table->unsignedBigInteger('rsvp_id');
            $table->unsignedBigInteger('time_slot_id');
            $table->timestamp('voted_at')->nullable();
            $table->boolean('sms_sent')->default(false);
            $table->timestamp('checked_in_at')->nullable();
            $table->timestamp('checked_out_at')->nullable();
            $table->enum('attendance_status', ['registered', 'checked_in', 'checked_out', 'no_show'])->default('registered');

            $table->unique(['volunteer_id', 'rsvp_id'], 'uq_rsvp_volunteer_rsvp');
            $table->foreign('volunteer_id')->references('volunteer_id')->on('volunteer')->onDelete('cascade')->onUpdate('cascade');
            $table->foreign('rsvp_id')->references('rsvp_id')->on('rsvp')->onDelete('cascade')->onUpdate('cascade');
            $table->foreign('time_slot_id')->references('time_slot_id')->on('time_slot')->onDelete('restrict')->onUpdate('cascade');

            $table->timestamps();
        });
    }

    public function down(): void
    {
        // In the rename path, reverse back to poll tables
        if (! Schema::hasTable('rsvp_response') && ! Schema::hasTable('poll')) {
            return;
        }

        $tables = ['time_slot', 'rsvp', 'rsvp_shift', 'rsvp_response'];
        if (count(array_filter($tables, fn ($t) => Schema::hasTable($t))) === 0) {
            return;
        }

        // Drop tables (simple for scratch-created path)
        Schema::dropIfExists('rsvp_response');
        Schema::dropIfExists('rsvp_shift');
        Schema::dropIfExists('rsvp');
        Schema::dropIfExists('time_slot');
    }
};
