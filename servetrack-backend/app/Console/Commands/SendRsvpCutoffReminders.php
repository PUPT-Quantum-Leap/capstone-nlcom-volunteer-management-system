<?php

namespace App\Console\Commands;

use App\Services\RsvpCutoffReminderService;
use Illuminate\Console\Command;

class SendRsvpCutoffReminders extends Command
{
    /**
     * The name and signature of the console command.
     */
    protected $signature = 'rsvp:send-cutoff-reminders '.
        '{--dry-run : Show what would be sent without actually sending}';

    /**
     * The console command description.
     */
    protected $description = 'Send RSVP cutoff reminder emails to volunteers';

    /**
     * Execute the console command.
     */
    public function handle(RsvpCutoffReminderService $service): int
    {
        $this->info('🔍 Checking for RSVP events that need cutoff reminders...');

        if ($this->option('dry-run')) {
            return $this->handleDryRun($service);
        }

        $results = $service->sendCutoffReminders();

        $this->displayResults($results);

        return $this->determineExitCode($results);
    }

    /**
     * Handle dry run mode - show what would be sent.
     */
    protected function handleDryRun(RsvpCutoffReminderService $service): int
    {
        $this->warn('🔍 DRY RUN MODE - No emails will be sent');

        $rsvpsNeedingReminders = $service->getRsvpsNeedingReminders();

        if ($rsvpsNeedingReminders->isEmpty()) {
            $this->info('✅ No RSVP events need cutoff reminders at this time.');

            return self::SUCCESS;
        }

        $this->info("📋 Found {$rsvpsNeedingReminders->count()} RSVP event(s) that need reminders:");

        foreach ($rsvpsNeedingReminders as $rsvp) {
            $volunteersToRemind = $rsvp->responses()
                ->whereNull('cutoff_reminder_sent_at')
                ->with('volunteer')
                ->get();

            $this->line("  📅 {$rsvp->title}");
            $this->line(
                '     📍 Location: '.
                ($rsvp->event_location ?? $rsvp->location?->name ?? 'Not specified')
            );
            $this->line(
                "     ⏰ Cutoff: {$rsvp->cutoff_day->format('M j, Y')} at ".
                "{$rsvp->cutoff_time}"
            );
            $this->line(
                "     👥 Volunteers to remind: {$volunteersToRemind->count()}"
            );

            foreach ($volunteersToRemind as $response) {
                $this->line(
                    "       - {$response->volunteer->first_name} ".
                    "{$response->volunteer->last_name} ({$response->volunteer->email})"
                );
            }
            $this->newLine();
        }

        $totalVolunteers = $rsvpsNeedingReminders->sum(function ($rsvp) {
            return $rsvp->responses()->whereNull('cutoff_reminder_sent_at')->count();
        });

        $this->info(
            "📊 Summary: {$rsvpsNeedingReminders->count()} events, ".
            "{$totalVolunteers} volunteers would receive reminder emails"
        );

        return self::SUCCESS;
    }

    /**
     * Display the results of the reminder sending process.
     */
    protected function displayResults(array $results): void
    {
        $this->newLine();

        if ($results['rsvps_processed'] === 0) {
            $this->info('✅ No RSVP events needed cutoff reminders at this time.');

            return;
        }

        $this->info('📊 Reminder Results:');
        $this->line("  📅 Events processed: {$results['rsvps_processed']}");
        $this->line("  👥 Volunteers notified: {$results['volunteers_notified']}");
        $this->line("  📧 Jobs queued: {$results['jobs_queued']}");

        if (! empty($results['errors'])) {
            $this->newLine();
            $this->warn('⚠️  Errors occurred:');

            foreach ($results['errors'] as $error) {
                $this->error("  ❌ {$error['title']}: {$error['error']}");
            }
        }

        $this->newLine();
        $this->info('✅ RSVP cutoff reminder process completed.');
    }

    /**
     * Determine the appropriate exit code based on results.
     */
    protected function determineExitCode(array $results): int
    {
        // If there were errors but some successes, return success but warn
        if (! empty($results['errors']) && $results['rsvps_processed'] > 0) {
            $this->warn('⚠️  Process completed with some errors. Check logs for details.');

            return self::SUCCESS;
        }

        // If there were only errors, return failure
        if (! empty($results['errors']) && $results['rsvps_processed'] === 0) {
            $this->error('❌ Process failed due to errors.');

            return self::FAILURE;
        }

        // All good
        return self::SUCCESS;
    }
}
