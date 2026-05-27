<?php

namespace App\Services;

use App\Models\Backup;
use Exception;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;

class BackupService
{
    private string $backupDisk;

    private string $backupPath;

    public function __construct()
    {
        $this->backupDisk = config('backup.disk', 'local');
        $this->backupPath = config('backup.path', 'backups');
    }

    /**
     * Create a new backup of the database
     */
    public function createBackup(string $type = 'manual', ?string $description = null): Backup
    {
        $backupName = $this->generateBackupName();
        $backup = Backup::create([
            'name' => $backupName,
            'file_path' => $this->backupPath.'/'.$backupName.'.sql',
            'size_bytes' => 0,
            'type' => $type,
            'status' => 'pending',
            'description' => $description,
        ]);

        try {
            $backup->update(['status' => 'in_progress']);

            $filePath = $this->performBackup($backup);
            $fileSize = Storage::disk($this->backupDisk)->size($filePath);

            $backup->update([
                'file_path' => $filePath,
                'size_bytes' => $fileSize,
                'status' => 'completed',
                'completed_at' => now(),
            ]);

            Log::info("Backup created successfully: {$backup->name}");

            return $backup;

        } catch (Exception $e) {
            $backup->update([
                'status' => 'failed',
                'error_message' => $e->getMessage(),
            ]);

            Log::error("Backup creation failed: {$backup->name}", [
                'error' => $e->getMessage(),
                'trace' => $e->getTraceAsString(),
            ]);

            throw $e;
        }
    }

    /**
     * Perform the actual backup operation
     */
    private function performBackup(Backup $backup): string
    {
        $tempDir = storage_path('app/temp/'.Str::uuid());
        $sqlFile = $tempDir.'/database.sql';
        $backupFile = $tempDir.'/'.$backup->name.'.sql';

        // Ensure temp directory exists
        if (! is_dir($tempDir)) {
            mkdir($tempDir, 0755, true);
        }

        try {
            // Create database dump
            $this->createDatabaseDump($sqlFile);

            // Add backup metadata to the SQL file
            $this->addBackupMetadata($sqlFile, $backup);

            // Copy to backup file
            copy($sqlFile, $backupFile);

            // Move to final storage location
            $finalPath = $this->backupPath.'/'.$backup->name.'.sql';
            Storage::disk($this->backupDisk)->put($finalPath, file_get_contents($backupFile));

            return $finalPath;

        } finally {
            // Clean up temporary files
            $this->cleanupTempFiles($tempDir);
        }
    }

    /**
     * Create database dump using PHP
     */
    private function createDatabaseDump(string $outputFile): void
    {
        // Resolve database connection and driver
        $connectionName = config('database.default');
        if (! $connectionName) {
            throw new Exception('Database default connection not configured');
        }

        $driver = config("database.connections.{$connectionName}.driver");
        if (! $driver) {
            throw new Exception("Database driver not configured for connection: {$connectionName}");
        }

        $database = config("database.connections.{$connectionName}.database");
        if (! $database) {
            throw new Exception("Database name not configured for connection: {$connectionName}");
        }

        // Tables to exclude (system tables)
        $excludeTables = [
            'cache',
            'cache_locks',
            'failed_jobs',
            'jobs',
            'job_batches',
            'sessions',
        ];

        try {
            $sqlContent = "-- ServeTrack Database Backup\n";
            $sqlContent .= '-- Generated on: '
                        .now()->toDateTimeString()."\n";
            $sqlContent .= "-- Database: {$database}\n";
            // Get database version based on database type
            $version = 'Unknown';
            try {
                if ($driver === 'mysql' || $driver === 'mariadb') {
                    $version = DB::select(
                        'SELECT VERSION() as version'
                    )[0]->version ?? 'Unknown';
                } elseif ($driver === 'sqlite') {
                    $version = DB::select(
                        'SELECT sqlite_version() as version'
                    )[0]->version ?? 'Unknown';
                } elseif ($driver === 'pgsql') {
                    $version = DB::select(
                        'SELECT version()'
                    )[0]->version ?? 'Unknown';
                } else {
                    throw new Exception("Unsupported database driver: {$driver}");
                }
            } catch (Exception $e) {
                $version = 'Unknown';
            }
            $sqlContent .= '-- Database Type: '.ucfirst($driver)."\n";
            $sqlContent .= '-- Server Version: '.$version."\n\n";

            // Add database-specific compatibility settings
            if ($driver === 'mysql' || $driver === 'mariadb') {
                $sqlContent .= "SET FOREIGN_KEY_CHECKS=0;\n";
                $sqlContent .= 'SET SQL_MODE='
                            ."'NO_AUTO_VALUE_ON_ZERO';\n";
                $sqlContent .= "SET AUTOCOMMIT=0;\n";
                $sqlContent .= "START TRANSACTION;\n\n";
            } elseif ($driver === 'sqlite') {
                $sqlContent .= "PRAGMA foreign_keys = OFF;\n";
                // Note: Don't actually start transaction here, just include in SQL
                $sqlContent .= "BEGIN TRANSACTION;\n\n";
            } elseif ($driver === 'pgsql') {
                $sqlContent .= 'SET '
                            ."session_replication_role = replica;\n";
                $sqlContent .= "BEGIN;\n\n";
            }

            // Get all tables except excluded ones
            $tables = [];
            if ($driver === 'mysql' || $driver === 'mariadb') {
                $tables = DB::select('SHOW TABLES');
                $tableField = 'Tables_in_'
                            .$database;
            } elseif ($driver === 'sqlite') {
                $tables = DB::select(
                    'SELECT name FROM sqlite_master '
                    ."WHERE type='table'"
                );
                $tableField = 'name';
            } elseif ($driver === 'pgsql') {
                $tables = DB::select(
                    'SELECT tablename FROM pg_tables '
                    ."WHERE schemaname = 'public'"
                );
                $tableField = 'tablename';
            }

            foreach ($tables as $table) {
                $tableName = $table->$tableField;

                if (in_array($tableName, $excludeTables)) {
                    continue;
                }

                // Get table structure
                if ($driver === 'mysql' || $driver === 'mariadb') {
                    $createTable = DB::select(
                        "SHOW CREATE TABLE `{$tableName}`"
                    );
                    if (! empty($createTable)) {
                        $sqlContent .= "-- Table structure for `{$tableName}`\n";
                        $sqlContent .= "DROP TABLE IF EXISTS `{$tableName}`;\n";
                        $sqlContent .= $createTable[0]->{'Create Table'}
                                      .";\n\n";
                    }
                } elseif ($driver === 'sqlite') {
                    $createTable = DB::select(
                        'SELECT sql FROM sqlite_master '
                        ."WHERE type='table' AND name=?",
                        [$tableName]
                    );
                    if (! empty($createTable) && ! empty($createTable[0]->sql)) {
                        $sqlContent .= "-- Table structure for `{$tableName}`\n";
                        $sqlContent .= "DROP TABLE IF EXISTS `{$tableName}`;\n";
                        $sqlContent .= $createTable[0]->sql
                                      .";\n\n";
                    }
                } elseif ($driver === 'pgsql') {
                    // For PostgreSQL, get comprehensive table structure including constraints and indexes
                    $createTable = DB::select(
                        'SELECT column_name, data_type, '
                        .'is_nullable, column_default '
                        .'FROM information_schema.columns '
                        .'WHERE table_name = ? '
                        ."AND table_schema = 'public' "
                        .'ORDER BY ordinal_position',
                        [$tableName]
                    );

                    if (! empty($createTable)) {
                        $sqlContent .= "-- Table structure for \"{$tableName}\"\n";
                        $sqlContent .= "DROP TABLE IF EXISTS \"{$tableName}\";\n";
                        $sqlContent .= "CREATE TABLE \"{$tableName}\" (\n";

                        // Build column definitions
                        $columns = [];
                        foreach ($createTable as $column) {
                            $colDef = "\"{$column->column_name}\" "
                                      ."{$column->data_type}";
                            if ($column->is_nullable === 'NO') {
                                $colDef .= ' NOT NULL';
                            }
                            if ($column->column_default) {
                                $colDef .= ' DEFAULT '
                                          .$column->column_default;
                            }
                            $columns[] = $colDef;
                        }

                        // Get primary key constraints
                        $primaryKeys = DB::select(
                            'SELECT kcu.column_name '
                            .'FROM information_schema.table_constraints tc '
                            .'JOIN information_schema.key_column_usage kcu '
                            .'ON tc.constraint_name = kcu.constraint_name '
                            .'WHERE tc.table_name = ? '
                            ."AND tc.table_schema = 'public' "
                            ."AND tc.constraint_type = 'PRIMARY KEY' "
                            .'ORDER BY kcu.ordinal_position',
                            [$tableName]
                        );

                        if (! empty($primaryKeys)) {
                            $pkColumns = array_map(fn ($pk) => "\"{$pk->column_name}\"", $primaryKeys);
                            $columns[] = 'PRIMARY KEY ('.implode(', ', $pkColumns).')';
                        }

                        // Get unique constraints
                        $uniqueConstraints = DB::select(
                            'SELECT tc.constraint_name, kcu.column_name '
                            .'FROM information_schema.table_constraints tc '
                            .'JOIN information_schema.key_column_usage kcu '
                            .'ON tc.constraint_name = kcu.constraint_name '
                            .'WHERE tc.table_name = ? '
                            ."AND tc.table_schema = 'public' "
                            ."AND tc.constraint_type = 'UNIQUE' "
                            .'ORDER BY tc.constraint_name, kcu.ordinal_position',
                            [$tableName]
                        );

                        if (! empty($uniqueConstraints)) {
                            $constraintsByName = [];
                            foreach ($uniqueConstraints as $constraint) {
                                $constraintsByName[$constraint->constraint_name][] = "\"{$constraint->column_name}\"";
                            }
                            foreach ($constraintsByName as $constraintName => $columns) {
                                $columns[] = "CONSTRAINT \"{$constraintName}\" UNIQUE (".implode(', ', $columns).')';
                            }
                        }

                        // Get foreign key constraints
                        $foreignKeys = DB::select(
                            'SELECT tc.constraint_name, kcu.column_name, '
                            .'ccu.table_name AS foreign_table_name, '
                            .'ccu.column_name AS foreign_column_name, '
                            .'rc.delete_rule, rc.update_rule '
                            .'FROM information_schema.table_constraints tc '
                            .'JOIN information_schema.key_column_usage kcu '
                            .'ON tc.constraint_name = kcu.constraint_name '
                            .'JOIN information_schema.referential_constraints rc '
                            .'ON tc.constraint_name = rc.constraint_name '
                            .'JOIN information_schema.constraint_column_usage ccu '
                            .'ON rc.unique_constraint_name = ccu.constraint_name '
                            .'WHERE tc.table_name = ? '
                            ."AND tc.table_schema = 'public' "
                            ."AND tc.constraint_type = 'FOREIGN KEY' "
                            .'ORDER BY tc.constraint_name, kcu.ordinal_position',
                            [$tableName]
                        );

                        if (! empty($foreignKeys)) {
                            $constraintsByName = [];
                            foreach ($foreignKeys as $fk) {
                                if (! isset($constraintsByName[$fk->constraint_name])) {
                                    $constraintsByName[$fk->constraint_name] = [
                                        'columns' => [],
                                        'foreign_table' => $fk->foreign_table_name,
                                        'foreign_columns' => [],
                                        'delete_rule' => $fk->delete_rule,
                                        'update_rule' => $fk->update_rule,
                                    ];
                                }
                                $constraintsByName[$fk->constraint_name]['columns'][] = "\"{$fk->column_name}\"";
                                $constraintsByName[$fk->constraint_name]['foreign_columns'][] = "\"{$fk->foreign_column_name}\"";
                            }
                            foreach ($constraintsByName as $constraintName => $fk) {
                                $fkDef = "CONSTRAINT \"{$constraintName}\" FOREIGN KEY ("
                                        .implode(', ', $fk['columns']).') '
                                        ."REFERENCES \"{$fk['foreign_table']}\" ("
                                        .implode(', ', $fk['foreign_columns']).')';
                                if ($fk['delete_rule']) {
                                    $fkDef .= ' ON DELETE '.$fk['delete_rule'];
                                }
                                if ($fk['update_rule']) {
                                    $fkDef .= ' ON UPDATE '.$fk['update_rule'];
                                }
                                $columns[] = $fkDef;
                            }
                        }

                        $sqlContent .= implode(",\n", $columns)."\n);\n";

                        // Get indexes (excluding those that are already constraints)
                        $indexes = DB::select(
                            'SELECT indexname, indexdef '
                            .'FROM pg_indexes '
                            .'WHERE tablename = ? '
                            ."AND schemaname = 'public' "
                            .'AND indexname NOT LIKE \'%_pkey\' '
                            .'AND indexname NOT IN ('
                            .'SELECT constraint_name '
                            .'FROM information_schema.table_constraints '
                            .'WHERE table_name = ? '
                            ."AND table_schema = 'public'"
                            .')',
                            [$tableName, $tableName]
                        );

                        foreach ($indexes as $index) {
                            $sqlContent .= $index->indexdef.";\n";
                        }

                        $sqlContent .= "\n";
                    }
                }

                // Get table data
                $rows = DB::table($tableName)->get();
                if ($rows->isNotEmpty()) {
                    // Use appropriate quoting based on database driver
                    $quoteChar = ($driver === 'pgsql') ? '"' : '`';
                    $sqlContent .= "-- Data for table {$quoteChar}{$tableName}{$quoteChar}\n";

                    foreach ($rows as $row) {
                        $values = [];
                        $columns = [];

                        foreach ((array) $row as $key => $value) {
                            $columns[] = "{$quoteChar}{$key}{$quoteChar}";
                            if ($value === null) {
                                $values[] = 'NULL';
                            } else {
                                $quoted = DB::getPdo()->quote($value);
                                if ($quoted === false) {
                                    throw new \RuntimeException(
                                        'PDO::quote() failed for value: '.substr((string) $value, 0, 100)
                                    );
                                }
                                $values[] = $quoted;
                            }
                        }

                        $sqlContent .= "INSERT INTO {$quoteChar}{$tableName}{$quoteChar} ("
                                      .implode(', ', $columns)
                                      .') VALUES ('
                                      .implode(', ', $values)
                                      .");\n";
                    }

                    $sqlContent .= "\n";
                }
            }

            // Add database-specific completion statements
            $sqlContent .= "\n-- Transaction completion\n";
            if ($driver === 'mysql' || $driver === 'mariadb') {
                $sqlContent .= "COMMIT;\n";
                $sqlContent .= "SET FOREIGN_KEY_CHECKS=1;\n";
            } elseif ($driver === 'sqlite') {
                $sqlContent .= "COMMIT;\n";
                $sqlContent .= "PRAGMA foreign_keys = ON;\n";
            } elseif ($driver === 'pgsql') {
                $sqlContent .= "COMMIT;\n";
                $sqlContent .= "SET session_replication_role = DEFAULT;\n";
            }
            $sqlContent .= "\n-- Backup completed successfully\n";

            // Write to file
            file_put_contents($outputFile, $sqlContent);

            if (! file_exists($outputFile) || filesize($outputFile) === 0) {
                throw new Exception('Database dump file is empty or missing');
            }

        } catch (Exception $e) {
            throw new Exception(
                'Database dump creation failed: '
                .$e->getMessage()
            );
        }
    }

    /**
     * Add backup metadata to the SQL file
     */
    private function addBackupMetadata(string $sqlFile, Backup $backup): void
    {
        $metadata = "-- Backup Metadata\n";
        $metadata .= "-- Backup Name: {$backup->name}\n";
        $metadata .= "-- Created At: {$backup->created_at->toISOString()}\n";
        $metadata .= "-- Type: {$backup->type}\n";
        $metadata .= '-- Description: '.($backup->description ?? 'N/A')."\n";
        $metadata .= '-- Laravel Version: '.app()->version()."\n";
        $metadata .= '-- PHP Version: '.PHP_VERSION."\n";
        $metadata .= "-- End Metadata\n\n";

        $existingContent = file_get_contents($sqlFile);
        file_put_contents($sqlFile, $metadata.$existingContent);
    }

    /**
     * Restore database from backup
     */
    public function restoreBackup(Backup $backup): void
    {
        if (! $backup->isCompleted()) {
            throw new Exception('Cannot restore from incomplete backup');
        }

        if (! Storage::disk($this->backupDisk)->exists($backup->file_path)) {
            throw new Exception('Backup file not found');
        }

        try {
            $tempDir = storage_path('app/temp/'.Str::uuid());
            $sqlFile = $tempDir.'/database.sql';

            // Ensure temp directory exists
            if (! is_dir($tempDir)) {
                mkdir($tempDir, 0755, true);
            }

            // Get backup content
            $backupContent = Storage::disk($this->backupDisk)->get($backup->file_path);
            file_put_contents($sqlFile, $backupContent);

            if (! file_exists($sqlFile)) {
                throw new Exception('Database dump not found in backup');
            }

            // Restore database
            $this->restoreDatabase($sqlFile);

            Log::info("Database restored successfully from backup: {$backup->name}");

        } finally {
            if (isset($tempDir)) {
                $this->cleanupTempFiles($tempDir);
            }
        }
    }

    /**
     * Restore database from SQL dump
     */
    private function restoreDatabase(string $sqlFile): void
    {
        $sqlContent = file_get_contents($sqlFile);

        $statements = [];
        $lines = explode("\n", $sqlContent);
        $currentStatement = '';
        $inMetadata = false;

        foreach ($lines as $line) {
            $trimmedLine = trim($line);

            // Skip metadata section
            if (str_starts_with($trimmedLine, '-- Backup Metadata')) {
                $inMetadata = true;

                continue;
            }
            if ($inMetadata && str_starts_with($trimmedLine, '-- End Metadata')) {
                $inMetadata = false;

                continue;
            }
            if ($inMetadata) {
                continue;
            }

            // Skip other comments
            if (str_starts_with($trimmedLine, '--') || empty($trimmedLine)) {
                continue;
            }

            $currentStatement .= $line."\n";

            // Check if statement ends with semicolon
            if (str_ends_with($trimmedLine, ';')) {
                $statements[] = trim($currentStatement);
                $currentStatement = '';
            }
        }

        // Execute all statements inside a single transaction so a failure
        // rolls back every change, preventing a partially-restored state.
        DB::transaction(function () use ($statements): void {
            foreach ($statements as $statement) {
                if (! empty($statement)) {
                    // Skip transaction statements
                    if (preg_match('/^(BEGIN|START TRANSACTION|COMMIT|ROLLBACK)/i', trim($statement))) {
                        continue;
                    }

                    // Skip SQLite system table operations
                    if (preg_match('/sqlite_sequence/i', $statement)) {
                        continue;
                    }

                    if (stripos($statement, 'backups') !== false &&
                        (stripos($statement, 'DROP TABLE') !== false ||
                         stripos($statement, 'CREATE TABLE') !== false ||
                         stripos($statement, 'INSERT INTO') !== false)) {
                        Log::info('Skipping backups table statement during restore: '.substr($statement, 0, 100).'...');

                        continue;
                    }
                    DB::statement($statement);
                }
            }
        });
    }

    /**
     * Delete backup file and record
     */
    public function deleteBackup(Backup $backup): void
    {
        if ($backup->file_path && Storage::disk($this->backupDisk)->exists($backup->file_path)) {
            Storage::disk($this->backupDisk)->delete($backup->file_path);
        }

        $backup->delete();
        Log::info("Backup deleted: {$backup->name}");
    }

    /**
     * Get backup file contents for download
     */
    public function getBackupFile(Backup $backup): string
    {
        if (! $backup->isCompleted()) {
            throw new Exception('Backup not ready for download');
        }

        if (! Storage::disk($this->backupDisk)->exists($backup->file_path)) {
            throw new Exception('Backup file not found');
        }

        return Storage::disk($this->backupDisk)->get($backup->file_path);
    }

    /**
     * Generate unique backup name
     */
    private function generateBackupName(): string
    {
        return 'servetrack_backup_'.now()->format('Y_m_d_His').'_'.Str::random(6);
    }

    /**
     * Clean up temporary files
     */
    private function cleanupTempFiles(string $tempDir): void
    {
        if (is_dir($tempDir)) {
            $files = array_diff(scandir($tempDir), ['.', '..']);
            foreach ($files as $file) {
                $filePath = $tempDir.'/'.$file;
                if (is_file($filePath)) {
                    unlink($filePath);
                }
            }
            rmdir($tempDir);
        }
    }

    /**
     * Clean up old backups based on retention policy
     */
    public function cleanupOldBackups(int $keepCount = 10): void
    {
        $oldBackups = Backup::completed()
            ->latest()
            ->skip($keepCount)
            ->take(1000) // Add limit to avoid memory issues
            ->get();

        foreach ($oldBackups as $backup) {
            if ($backup instanceof Backup) {
                $this->deleteBackup($backup);
            }
        }

        Log::info("Cleaned up {$oldBackups->count()} old backups");
    }
}
