<?php

namespace App\Console\Commands;

use App\Services\RsvpAutoCloseService;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\Log;

class CloseExpiredRsvp extends Command
{
    protected $signature = 'rsvp:close-expired';

    protected $description = 'Automatically close RSVP events that have passed their cutoff deadline';

    public function __construct(public RsvpAutoCloseService $service)
    {
        parent::__construct();
    }

    public function handle(): int
    {
        $this->info('Checking for RSVP events that need to be auto-closed...');

        $results = $this->service->closeExpiredRsvps();

        if (! empty($results['errors'])) {
            $this->warn('Errors occurred while auto-closing:');

            foreach ($results['errors'] as $error) {
                $this->error("  - {$error['title']}: {$error['error']}");
            }

            Log::error('RSVP auto-close errors', [
                'errors' => $results['errors'],
            ]);
        }

        if ($results['closed_count'] === 0) {
            $this->info('No RSVP events needed to be auto-closed.');

            return empty($results['errors']) ? self::SUCCESS : self::FAILURE;
        }

        $this->info("Auto-closed {$results['closed_count']} RSVP event(s).");

        foreach ($results['rsvps'] as $rsvp) {
            $this->line("  - {$rsvp['title']} (ID: {$rsvp['rsvp_id']}) - {$rsvp['volunteer_count']} volunteer(s) registered");
        }

        Log::info('RSVP auto-close command completed', [
            'closed_count' => $results['closed_count'],
            'error_count' => count($results['errors']),
        ]);

        return self::SUCCESS;
    }
}
