<?php

namespace App\Console\Commands;

use Illuminate\Console\Command;
use Illuminate\Support\Facades\DB;

class SetupDatabase extends Command
{
    /**
     * The name and signature of the console command.
     *
     * @var string
     */
    protected $signature = 'db:setup {--seed : Run the database seeder after migration}';

    /**
     * The console command description.
     *
     * @var string
     */
    protected $description = 'Create the database and run migrations';

    /**
     * Execute the console command.
     */
    public function handle(): int
    {
        $databaseName = config('database.connections.mysql.database');
        $charset = config('database.connections.mysql.charset', 'utf8mb4');
        $collation = config('database.connections.mysql.collation', 'utf8mb4_unicode_ci');

        $this->info('Setting up database: '.$databaseName);

        try {
            // Connect without database to create it
            config(['database.connections.mysql.database' => null]);

            DB::connection('mysql')->statement("CREATE DATABASE IF NOT EXISTS `{$databaseName}` CHARACTER SET {$charset} COLLATE {$collation}");

            $this->info('Database created successfully!');

            // Restore database config
            config(['database.connections.mysql.database' => $databaseName]);

            // Run migrations
            $this->info('Running migrations...');
            $this->call('migrate');

            if ($this->option('seed')) {
                $this->info('Running seeders...');
                $this->call('db:seed');
            }

            $this->info('Database setup completed successfully!');

            return Command::SUCCESS;

        } catch (\Exception $e) {
            $this->error('Error setting up database: '.$e->getMessage());

            return Command::FAILURE;
        }
    }
}
