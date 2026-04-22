<?php

return [
    /*
    |--------------------------------------------------------------------------
    | Backup Disk
    |--------------------------------------------------------------------------
    |
    | This is the storage disk that will be used to store backup files.
    | By default, we use the local disk, but you can configure this to
    | use any disk configured in config/filesystems.php.
    |
    */
    'disk' => env('BACKUP_DISK', 'local'),

    /*
    |--------------------------------------------------------------------------
    | Backup Path
    |--------------------------------------------------------------------------
    |
    | This is the directory within the backup disk where backup files
    | will be stored. The path is relative to the disk's root.
    |
    */
    'path' => env('BACKUP_PATH', 'backups'),

    /*
    |--------------------------------------------------------------------------
    | Backup Retention
    |--------------------------------------------------------------------------
    |
    | The number of backups to keep when cleaning up old backups.
    | Set to 0 to keep all backups indefinitely.
    |
    */
    'retention' => env('BACKUP_RETENTION', 10),

    /*
    |--------------------------------------------------------------------------
    | Scheduled Backup
    |--------------------------------------------------------------------------
    |
    | Configuration for scheduled automatic backups.
    |
    */
    'schedule' => [
        'enabled' => env('BACKUP_SCHEDULE_ENABLED', false),
        'frequency' => env('BACKUP_SCHEDULE_FREQUENCY', 'weekly'), // daily, weekly, monthly
        'time' => env('BACKUP_SCHEDULE_TIME', '02:00'), // Time of day to run
        'timezone' => env('BACKUP_SCHEDULE_TIMEZONE', 'UTC'),
    ],

    /*
    |--------------------------------------------------------------------------
    | Backup Compression
    |--------------------------------------------------------------------------
    |
    | Whether to compress backup files using ZIP format.
    |
    */
    'compression' => env('BACKUP_COMPRESSION', true),

    /*
    |--------------------------------------------------------------------------
    | Database Backup Settings
    |--------------------------------------------------------------------------
    |
    | Settings specific to database backup operations.
    |
    */
    'database' => [
        /*
        |--------------------------------------------------------------------------
        | Tables to Exclude
        |--------------------------------------------------------------------------
        |
        | Array of table names to exclude from database backups.
        | These are typically cache, session, or temporary tables.
        |
        */
        'exclude_tables' => [
            'cache',
            'cache_locks',
            'failed_jobs',
            'jobs',
            'job_batches',
            'sessions',
        ],

        /*
        |--------------------------------------------------------------------------
        | Add Drop Table
        |--------------------------------------------------------------------------
        |
        | Whether to include DROP TABLE statements in the SQL dump.
        | This is useful for clean restores.
        |
        */
        'add_drop_table' => env('BACKUP_DB_ADD_DROP_TABLE', true),

        /*
        |--------------------------------------------------------------------------
        | Single Transaction
        |--------------------------------------------------------------------------
        |
        | Whether to use --single-transaction option for consistent backups.
        | This is recommended for InnoDB tables.
        |
        */
        'single_transaction' => env('BACKUP_DB_SINGLE_TRANSACTION', true),

        /*
        |--------------------------------------------------------------------------
        | Include Routines
        |--------------------------------------------------------------------------
        |
        | Whether to include stored procedures and functions in backups.
        |
        */
        'include_routines' => env('BACKUP_DB_INCLUDE_ROUTINES', true),

        /*
        |--------------------------------------------------------------------------
        | Include Triggers
        |--------------------------------------------------------------------------
        |
        | Whether to include triggers in backups.
        |
        */
        'include_triggers' => env('BACKUP_DB_INCLUDE_TRIGGERS', true),
    ],

    /*
    |--------------------------------------------------------------------------
    | File Backup Settings
    |--------------------------------------------------------------------------
    |
    | Settings for backing up additional files and directories.
    |
    */
    'files' => [
        /*
        |--------------------------------------------------------------------------
        | Include Files
        |--------------------------------------------------------------------------
        |
        | Array of directories or files to include in backups.
        | Paths are relative to the application root.
        |
        */
        'include' => [
            // 'storage/app/public',
            // 'resources/views',
        ],

        /*
        |--------------------------------------------------------------------------
        | Exclude Files
        |--------------------------------------------------------------------------
        |
        | Array of patterns to exclude from file backups.
        |
        */
        'exclude' => [
            'node_modules',
            'vendor',
            '.git',
            'storage/framework/cache',
            'storage/framework/sessions',
            'storage/framework/views',
            'storage/logs',
        ],
    ],

    /*
    |--------------------------------------------------------------------------
    | Security Settings
    |--------------------------------------------------------------------------
    |
    | Security-related configuration for backups.
    |
    */
    'security' => [
        /*
        |--------------------------------------------------------------------------
        | Encrypt Backups
        |--------------------------------------------------------------------------
        |
        | Whether to encrypt backup files using OpenSSL.
        |
        */
        'encrypt' => env('BACKUP_ENCRYPT', false),

        /*
        |--------------------------------------------------------------------------
        | Encryption Password
        |--------------------------------------------------------------------------
        |
        | Password used for encrypting/decrypting backup files.
        | If encrypt is true, this must be set.
        |
        */
        'encryption_password' => env('BACKUP_ENCRYPTION_PASSWORD'),

        /*
        |--------------------------------------------------------------------------
        | Require Admin Role
        |--------------------------------------------------------------------------
        |
        | Whether to require admin role for all backup operations.
        |
        */
        'require_admin' => env('BACKUP_REQUIRE_ADMIN', true),
    ],

    /*
    |--------------------------------------------------------------------------
    | Notifications
    |--------------------------------------------------------------------------
    |
    | Configuration for backup notifications.
    |
    */
    'notifications' => [
        /*
        |--------------------------------------------------------------------------
        | Email Notifications
        |--------------------------------------------------------------------------
        |
        | Whether to send email notifications for backup operations.
        |
        */
        'email' => [
            'enabled' => env('BACKUP_EMAIL_NOTIFICATIONS', false),
            'to' => env('BACKUP_EMAIL_TO', 'admin@example.com'),
            'on_success' => env('BACKUP_EMAIL_ON_SUCCESS', true),
            'on_failure' => env('BACKUP_EMAIL_ON_FAILURE', true),
        ],
    ],
];
