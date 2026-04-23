<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        // First, rename the primary key on rsvp_response that was missed in the previous migration
        if (Schema::hasColumn('rsvp_response', 'poll_vote_id')) {
            Schema::table('rsvp_response', function (Blueprint $table) {
                $table->renameColumn('poll_vote_id', 'rsvp_response_id');
            });
        }

        $driver = DB::getDriverName();

        if ($driver === 'mysql') {
            // MySQL: Drop FK, rename column, add new FK
            $db = config('database.connections.mysql.database');
            $fks = DB::select(
                "SELECT CONSTRAINT_NAME FROM information_schema.KEY_COLUMN_USAGE WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'sms_notification' AND REFERENCED_TABLE_NAME IS NOT NULL",
                [$db]
            );
            foreach ($fks as $fk) {
                DB::statement("ALTER TABLE `sms_notification` DROP FOREIGN KEY `{$fk->CONSTRAINT_NAME}`");
            }

            // Drop index if it exists
            if (Schema::hasIndex('sms_notification', 'idx_sn_poll_vote_id')) {
                Schema::table('sms_notification', function (Blueprint $table) {
                    $table->dropIndex('idx_sn_poll_vote_id');
                });
            }

            if (Schema::hasColumn('sms_notification', 'poll_vote_id')) {
                Schema::table('sms_notification', function (Blueprint $table) {
                    $table->renameColumn('poll_vote_id', 'rsvp_response_id');
                });
            }

            // Add index if it doesn't exist
            if (! Schema::hasIndex('sms_notification', 'idx_sn_rsvp_response_id')) {
                Schema::table('sms_notification', function (Blueprint $table) {
                    $table->index('rsvp_response_id', 'idx_sn_rsvp_response_id');
                });
            }

            Schema::table('sms_notification', function (Blueprint $table) {
                $table->foreign('rsvp_response_id')
                    ->references('rsvp_response_id')
                    ->on('rsvp_response')
                    ->onDelete('cascade')
                    ->onUpdate('cascade');
            });
        } elseif ($driver === 'sqlite') {
            // SQLite doesn't support column rename with foreign keys easily,
            // but we can work around by disabling and re-enabling foreign keys
            DB::statement('PRAGMA foreign_keys = OFF');

            // Use raw ALTER to rename the column
            try {
                DB::statement('ALTER TABLE sms_notification RENAME COLUMN poll_vote_id TO rsvp_response_id');
                // Also rename the index name for consistency
                DB::statement('DROP INDEX IF EXISTS idx_sn_poll_vote_id');
                DB::statement('CREATE INDEX idx_sn_rsvp_response_id ON sms_notification(rsvp_response_id)');
            } catch (Exception $e) {
                // If raw SQL fails, try the table recreation approach
                $records = DB::table('sms_notification')->get()->toArray();
                Schema::dropIfExists('sms_notification');
                Schema::create('sms_notification', function (Blueprint $table) {
                    $table->id('sms_id');
                    $table->unsignedBigInteger('volunteer_id');
                    $table->unsignedBigInteger('rsvp_response_id');
                    $table->text('message');
                    $table->timestamp('sent_date')->nullable();
                    $table->index('volunteer_id', 'idx_sn_volunteer_id');
                    $table->index('rsvp_response_id', 'idx_sn_rsvp_response_id');
                });
                foreach ($records as $record) {
                    DB::table('sms_notification')->insert([
                        'sms_id' => $record->sms_id,
                        'volunteer_id' => $record->volunteer_id,
                        'rsvp_response_id' => $record->poll_vote_id,
                        'message' => $record->message,
                        'sent_date' => $record->sent_date,
                    ]);
                }
            }

            DB::statement('PRAGMA foreign_keys = ON');
        }
    }

    public function down(): void
    {
        $driver = DB::getDriverName();

        if ($driver === 'mysql') {
            $db = config('database.connections.mysql.database');
            $fks = DB::select(
                "SELECT CONSTRAINT_NAME FROM information_schema.KEY_COLUMN_USAGE WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'sms_notification' AND REFERENCED_TABLE_NAME IS NOT NULL",
                [$db]
            );
            foreach ($fks as $fk) {
                DB::statement("ALTER TABLE `sms_notification` DROP FOREIGN KEY `{$fk->CONSTRAINT_NAME}`");
            }

            Schema::table('sms_notification', function (Blueprint $table) {
                $table->dropIndex('idx_sn_rsvp_response_id');
            });

            Schema::table('sms_notification', function (Blueprint $table) {
                $table->renameColumn('rsvp_response_id', 'poll_vote_id');
            });

            Schema::table('sms_notification', function (Blueprint $table) {
                $table->index('poll_vote_id', 'idx_sn_poll_vote_id');
                $table->foreign('poll_vote_id')
                    ->references('poll_vote_id')
                    ->on('poll_vote')
                    ->onDelete('cascade')
                    ->onUpdate('cascade');
            });
        } elseif ($driver === 'sqlite') {
            DB::statement('PRAGMA foreign_keys = OFF');

            try {
                DB::statement('ALTER TABLE sms_notification RENAME COLUMN rsvp_response_id TO poll_vote_id');
                DB::statement('DROP INDEX IF EXISTS idx_sn_rsvp_response_id');
                DB::statement('CREATE INDEX idx_sn_poll_vote_id ON sms_notification(poll_vote_id)');
            } catch (Exception $e) {
                $records = DB::table('sms_notification')->get()->toArray();
                Schema::dropIfExists('sms_notification');
                Schema::create('sms_notification', function (Blueprint $table) {
                    $table->id('sms_id');
                    $table->unsignedBigInteger('volunteer_id');
                    $table->unsignedBigInteger('poll_vote_id');
                    $table->text('message');
                    $table->timestamp('sent_date')->nullable();
                    $table->index('volunteer_id', 'idx_sn_volunteer_id');
                    $table->index('poll_vote_id', 'idx_sn_poll_vote_id');
                });
                foreach ($records as $record) {
                    DB::table('sms_notification')->insert([
                        'sms_id' => $record->sms_id,
                        'volunteer_id' => $record->volunteer_id,
                        'poll_vote_id' => $record->rsvp_response_id,
                        'message' => $record->message,
                        'sent_date' => $record->sent_date,
                    ]);
                }
            }

            DB::statement('PRAGMA foreign_keys = ON');
        }
    }
};
