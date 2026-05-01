<?php

namespace App\Console\Commands;

use Illuminate\Console\Command;
use Illuminate\Support\Facades\Http;

class TestSupabaseConfig extends Command
{
    protected $signature = 'supabase:test-config';

    protected $description = 'Test Supabase configuration for invite system';

    public function handle(): int
    {
        $this->info('Testing Supabase Configuration...');
        $this->newLine();

        // Check configuration
        $baseUrl = config('services.supabase.url', '');
        $serviceRoleKey = config('services.supabase.service_role_key', '');
        $frontendUrl = config('app.frontend_url', '');

        $this->info('Configuration Values:');
        $this->table(
            ['Setting', 'Value', 'Status'],
            [
                ['SUPABASE_URL', $this->maskUrl($baseUrl), empty($baseUrl) ? '<fg=red>MISSING</>' : '<fg=green>OK</>'],
                ['SUPABASE_SERVICE_ROLE_KEY', $this->maskKey($serviceRoleKey), empty($serviceRoleKey) ? '<fg=red>MISSING</>' : '<fg=green>OK</>'],
                ['FRONTEND_URL', $frontendUrl, empty($frontendUrl) ? '<fg=red>MISSING</>' : '<fg=green>OK</>'],
            ]
        );

        if (empty($baseUrl) || empty($serviceRoleKey)) {
            $this->newLine();
            $this->error('Configuration incomplete! Please set the missing values in your .env file.');

            return 1;
        }

        // Test API connectivity
        $this->newLine();
        $this->info('Testing Supabase API connectivity...');

        try {
            $apiUrl = rtrim($baseUrl, '/').'/auth/v1/admin/users';
            $response = Http::withHeaders([
                'Authorization' => 'Bearer '.$serviceRoleKey,
                'apikey' => $serviceRoleKey,
            ])->get($apiUrl);

            if ($response->successful()) {
                $this->info('✓ Supabase API connection successful!');
            } else {
                $this->error('✗ Supabase API connection failed!');
                $this->error('Status: '.$response->status());
                $this->error('Response: '.$response->body());

                if ($response->status() === 401 || $response->status() === 403) {
                    $this->newLine();
                    $this->warn('Your SUPABASE_SERVICE_ROLE_KEY may be invalid.');
                }

                return 1;
            }
        } catch (\Exception $e) {
            $this->error('✗ Supabase API connection error: '.$e->getMessage());

            return 1;
        }

        // Check redirect URL configuration
        $this->newLine();
        $this->info('Redirect URL Configuration:');
        $this->warn('Add this URL to Supabase Dashboard > Authentication > URL Configuration > Redirect URLs:');
        $this->newLine();
        $this->line('  '.$frontendUrl.'/auth/callback');
        $this->newLine();
        $this->line('  Supabase Dashboard: Authentication > URL Configuration > Redirect URLs');

        // Summary
        $this->newLine();
        $this->info('Configuration test complete!');
        $this->newLine();
        $this->warn('If invite emails are not working:');
        $this->line('  1. Verify SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env');
        $this->line('  2. Add the above URLs to Supabase Redirect URLs');
        $this->line('  3. Enable Email provider in Supabase: Authentication > Providers > Email');
        $this->line('  4. Check Supabase logs for any email sending errors');

        return 0;
    }

    private function maskUrl(string $url): string
    {
        if (empty($url)) {
            return '(not set)';
        }

        return $url;
    }

    private function maskKey(string $key): string
    {
        if (empty($key)) {
            return '(not set)';
        }

        return substr($key, 0, 10).'...'.substr($key, -5);
    }
}
