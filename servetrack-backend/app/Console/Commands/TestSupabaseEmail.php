<?php

namespace App\Console\Commands;

use Illuminate\Console\Command;
use Illuminate\Support\Facades\Http;

class TestSupabaseEmail extends Command
{
    protected $signature = 'supabase:test-email {email : The test email address}';

    protected $description = 'Test Supabase email configuration and invite delivery';

    public function handle(): int
    {
        $email = $this->argument('email');
        $baseUrl = config('services.supabase.url');
        $serviceRoleKey = config('services.supabase.service_role_key');
        $frontendUrl = config('app.frontend_url');

        $this->info('=== Supabase Email Configuration Test ===');
        $this->newLine();

        // Check configuration
        $this->info('1. Checking configuration...');
        if (empty($baseUrl)) {
            $this->error('   ❌ SUPABASE_URL is not set in .env');

            return 1;
        }
        $this->info('   ✓ SUPABASE_URL: '.$baseUrl);

        if (empty($serviceRoleKey)) {
            $this->error('   ❌ SUPABASE_SERVICE_ROLE_KEY is not set in .env');

            return 1;
        }
        $this->info('   ✓ SUPABASE_SERVICE_ROLE_KEY is set');

        if (empty($frontendUrl)) {
            $this->error('   ❌ FRONTEND_URL is not set in .env');

            return 1;
        }
        $this->info('   ✓ FRONTEND_URL: '.$frontendUrl);
        $this->newLine();

        // Test API connectivity
        $this->info('2. Testing Supabase API connectivity...');
        $usersUrl = rtrim($baseUrl, '/').'/auth/v1/admin/users';
        $response = Http::withHeaders([
            'Authorization' => 'Bearer '.$serviceRoleKey,
            'apikey' => $serviceRoleKey,
        ])->get($usersUrl);

        if (! $response->successful()) {
            $this->error('   ❌ Failed to connect to Supabase API');
            $this->error('   Status: '.$response->status());
            $this->error('   Response: '.$response->body());

            return 1;
        }
        $this->info('   ✓ Supabase API is accessible');
        $this->newLine();

        // Check if user exists
        $this->info('3. Checking if test user exists...');
        $users = $response->json();
        $existingUser = collect($users['users'] ?? $users)->firstWhere('email', $email);

        if ($existingUser) {
            $this->warn('   ⚠ User already exists in Supabase: '.$email);
            $this->warn('   The invite API will return 422 for existing users.');
        } else {
            $this->info('   ✓ User does not exist (good for testing)');
        }
        $this->newLine();

        // Send test invite
        $this->info('4. Sending test invite to: '.$email);
        $inviteUrl = rtrim($baseUrl, '/').'/auth/v1/admin/invite';
        $redirectTo = $frontendUrl.'/auth/callback?token=test-token&role=volunteer';

        $inviteResponse = Http::withHeaders([
            'Authorization' => 'Bearer '.$serviceRoleKey,
            'apikey' => $serviceRoleKey,
            'Content-Type' => 'application/json',
        ])->post($inviteUrl, [
            'email' => $email,
            'data' => [
                'role' => 'volunteer',
                'invite_token' => 'test-token',
                'app_source' => 'servetrack',
            ],
            'redirect_to' => $redirectTo,
        ]);

        $this->info('   Status: '.$inviteResponse->status());
        $this->info('   Response: '.substr($inviteResponse->body(), 0, 200));
        $this->newLine();

        if ($inviteResponse->successful()) {
            $this->info('   ✓ Supabase API accepted the invite request');
            $this->warn('   ⚠ IMPORTANT: This does NOT guarantee email was sent!');
            $this->newLine();
            $this->info('5. Supabase Dashboard Configuration Checklist:');
            $this->info('   Go to: https://app.supabase.com/project/_/auth/providers');
            $this->info('   → Make sure "Email" provider is ENABLED');
            $this->info('   → Make sure "Confirm email" is turned ON');
            $this->info('   → Check "Authentication" → "URL Configuration"');
            $this->info('   → Add this redirect URL to "Redirect URLs":');
            $this->line('      '.$redirectTo);
            $this->newLine();
            $this->warn('   ⚠ FREE TIER LIMIT: ~3 emails/hour');
            $this->info('   If you exceed the limit, emails will be silently dropped.');
        } elseif ($inviteResponse->status() === 422) {
            $this->warn('   ⚠ Got 422 - User may already exist or email format issue');
            $error = $inviteResponse->json()['message'] ?? 'Unknown error';
            $this->warn('   Error: '.$error);
        } else {
            $this->error('   ❌ Invite request failed');
            $this->error('   Check your Supabase configuration.');
        }

        $this->newLine();
        $this->info('=== Troubleshooting Tips ===');
        $this->info('• Check spam/junk folders in Gmail');
        $this->info('• Supabase free tier: max 3 emails/hour per project');
        $this->info('• Wait a few minutes - emails can be delayed');
        $this->info('• Check Supabase Dashboard → Logs → Auth for errors');
        $this->info('• For production, configure Custom SMTP in Supabase');

        return 0;
    }
}
