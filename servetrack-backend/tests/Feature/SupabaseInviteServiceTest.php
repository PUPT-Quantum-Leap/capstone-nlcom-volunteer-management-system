<?php

use App\Services\SupabaseService;
use Illuminate\Http\Client\Request;
use Illuminate\Support\Facades\Http;

describe('Supabase invite payload', function (): void {
    it('sends invite metadata and redirects back to the frontend auth callback', function (): void {
        config([
            'services.supabase.url' => 'https://example.supabase.co',
            'services.supabase.service_role_key' => 'service-role-key',
            'app.frontend_url' => 'http://localhost:4200',
        ]);

        Http::fake([
            'https://example.supabase.co/auth/v1/admin/invite' => Http::response([
                'id' => 'supabase-user-id',
            ], 200),
        ]);

        $result = app(SupabaseService::class)->sendInviteEmail(
            'invitee@example.com',
            'http://localhost:4200/admin-auth?tab=signup&token=test-invite-token',
            'admin'
        );

        expect($result['success'])->toBeTrue();

        Http::assertSent(function (Request $request): bool {
            $requestData = $request->data();

            return $request->url() === 'https://example.supabase.co/auth/v1/admin/invite'
                && $request->hasHeader('Authorization', 'Bearer service-role-key')
                && $request->hasHeader('apikey', 'service-role-key')
                && $requestData['email'] === 'invitee@example.com'
                && $requestData['redirect_to'] === 'http://localhost:4200/auth/callback?token=test-invite-token&role=admin'
                && $requestData['data']['role'] === 'admin'
                && $requestData['data']['invite_token'] === 'test-invite-token'
                && $requestData['data']['app_source'] === 'servetrack';
        });
    });

    it('generates auth link for copying without sending email', function (): void {
        config([
            'services.supabase.url' => 'https://example.supabase.co',
            'services.supabase.service_role_key' => 'service-role-key',
            'app.frontend_url' => 'http://localhost:4200',
        ]);

        Http::fake([
            'https://example.supabase.co/auth/v1/admin/generate_link' => Http::response([
                'properties' => [
                    'action_link' => 'https://example.supabase.co/auth/v1/verify?token=magic-link-token&type=magiclink',
                ],
            ], 200),
        ]);

        $result = app(SupabaseService::class)->generateInviteLink(
            'invitee@example.com',
            'http://localhost:4200/admin-auth?tab=signup&token=test-invite-token',
            'admin'
        );

        expect($result['success'])->toBeTrue();
        expect($result['data']['auth_link'])->toBe('https://example.supabase.co/auth/v1/verify?token=magic-link-token&type=magiclink');

        Http::assertSent(function (Request $request): bool {
            $requestData = $request->data();

            return $request->url() === 'https://example.supabase.co/auth/v1/admin/generate_link'
                && $request->hasHeader('Authorization', 'Bearer service-role-key')
                && $request->hasHeader('apikey', 'service-role-key')
                && $requestData['type'] === 'magiclink'
                && $requestData['email'] === 'invitee@example.com'
                && $requestData['redirect_to'] === 'http://localhost:4200/auth/callback?token=test-invite-token&role=admin'
                && $requestData['data']['role'] === 'admin'
                && $requestData['data']['invite_token'] === 'test-invite-token'
                && $requestData['data']['app_source'] === 'servetrack';
        });
    });
});
