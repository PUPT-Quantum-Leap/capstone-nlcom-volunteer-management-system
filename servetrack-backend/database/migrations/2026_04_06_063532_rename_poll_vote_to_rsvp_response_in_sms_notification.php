<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (! Schema::hasTable('sms_notification')) {
            return;
        }

        // Path 1: Old migration created poll_vote_id — rename it
        if (Schema::hasColumn('sms_notification', 'poll_vote_id')) {
            if (DB::getDriverName() === 'mysql') {
                $db = config('database.connections.mysql.database');
                $fks = DB::select(
                    "SELECT CONSTRAINT_NAME FROM information_schema.KEY_COLUMN_USAGE WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'sms_notification' AND COLUMN_NAME = 'poll_vote_id' AND REFERENCED_TABLE_NAME IS NOT NULL",
                    [$db]
                );
                foreach ($fks as $fk) {
                    DB::statement("ALTER TABLE `sms_notification` DROP FOREIGN KEY `{$fk->CONSTRAINT_NAME}`");
                }
            }

            Schema::table('sms_notification', function ($table) {
                $table->renameColumn('poll_vote_id', 'rsvp_response_id');
            });
        }

        // Path 2: Add FK if column exists but has no FK
        if (Schema::hasColumn('sms_notification', 'rsvp_response_id')) {
            Schema::table('sms_notification', function ($table) {
                $table->foreign('rsvp_response_id')
                    ->references('rsvp_response_id')
                    ->on('rsvp_response')
                    ->onDelete('cascade')
                    ->onUpdate('cascade');
            });

            if (! $this->hasIndex('sms_notification', 'idx_sn_rsvp_response_id')) {
                Schema::table('sms_notification', function ($table) {
                    $table->index('rsvp_response_id', 'idx_sn_rsvp_response_id');
                });
            }
        }
    }

    public function down(): void
    {
        if (! Schema::hasTable('sms_notification') || ! Schema::hasColumn('sms_notification', 'rsvp_response_id')) {
            return;
        }

        if (DB::getDriverName() === 'mysql') {
            $db = config('database.connections.mysql.database');
            $fks = DB::select(
                "SELECT CONSTRAINT_NAME FROM information_schema.KEY_COLUMN_USAGE WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'sms_notification' AND COLUMN_NAME = 'rsvp_response_id' AND REFERENCED_TABLE_NAME IS NOT NULL",
                [$db]
            );
            foreach ($fks as $fk) {
                DB::statement("ALTER TABLE `sms_notification` DROP FOREIGN KEY `{$fk->CONSTRAINT_NAME}`");
            }
        }

        Schema::table('sms_notification', function ($table) {
            $table->dropForeign(['rsvp_response_id']);
            $table->renameColumn('rsvp_response_id', 'poll_vote_id');
        });
    }

    protected function hasIndex(string $table, string $index): bool
    {
        if (DB::getDriverName() === 'mysql') {
            $db = config('database.connections.mysql.database');
            $result = DB::select(
                'SELECT COUNT(*) as count FROM information_schema.STATISTICS WHERE TABLE_SCHEMA = ? AND TABLE_NAME = ? AND INDEX_NAME = ?',
                [$db, $table, $index]
            );

            return (int) $result[0]->count > 0;
        }

        return false;
    }
};
