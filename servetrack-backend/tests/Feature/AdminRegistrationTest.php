<?php

use App\Models\User;

/**
 * Shared valid payload for admin registration tests.
 *
 * @return array<string, string>
 */
function validAdminPayload(): array
{
    return [
        'firstName' => 'Test',
        'lastName' => 'Admin',
        'email' => 'testadmin@example.com',
        'contactNumber' => '+639123456789',
        'password' => 'SecurePass1!XY',
        'confirmPassword' => 'SecurePass1!XY',
        'inviteCode' => 'ChangeMe123!',
    ];
}

describe('Admin Registration Security', function (): void {
    beforeEach(function (): void {
        config(['services.admin.invite_code' => 'ChangeMe123!']);
        config(['services.admin.allowed_domains' => 'example.com']);
    });

    it('registers successfully with correct invite code and allowed domain', function (): void {
        $this->postJson('/api/admin/register', validAdminPayload())
            ->assertCreated()
            ->assertJsonPath('success', true);
    });

    it('rejects registration when invite code is wrong', function (): void {
        $payload = validAdminPayload();
        $payload['inviteCode'] = 'WrongCode!';

        $this->postJson('/api/admin/register', $payload)
            ->assertUnprocessable()
            ->assertJsonPath('message', 'Registration failed. Please contact your administrator.');
    });

    it('rejects registration when invite code is missing', function (): void {
        $payload = validAdminPayload();
        unset($payload['inviteCode']);

        $this->postJson('/api/admin/register', $payload)
            ->assertUnprocessable()
            ->assertJsonPath('message', 'Registration failed. Please contact your administrator.');
    });

    it('rejects registration when email domain is not in allowed list', function (): void {
        $payload = validAdminPayload();
        $payload['email'] = 'hacker@notallowed.com';

        $this->postJson('/api/admin/register', $payload)
            ->assertUnprocessable()
            ->assertJsonPath('message', 'Registration failed. Please contact your administrator.');
    });

    it('rejects registration when ADMIN_INVITE_CODE config is empty', function (): void {
        config(['services.admin.invite_code' => null]);

        $this->postJson('/api/admin/register', validAdminPayload())
            ->assertUnprocessable()
            ->assertJsonPath('message', 'Registration failed. Please contact your administrator.');
    });

    it('rejects registration when ADMIN_ALLOWED_DOMAINS config is empty', function (): void {
        config(['services.admin.allowed_domains' => null]);

        $this->postJson('/api/admin/register', validAdminPayload())
            ->assertUnprocessable()
            ->assertJsonPath('message', 'Registration failed. Please contact your administrator.');
    });

    it('accepts email domain case-insensitively', function (): void {
        $payload = validAdminPayload();
        $payload['email'] = 'testadmin@EXAMPLE.COM';

        $this->postJson('/api/admin/register', $payload)
            ->assertCreated()
            ->assertJsonPath('success', true);
    });

    it('accepts when multiple domains configured and email matches second domain', function (): void {
        config(['services.admin.allowed_domains' => 'other.org,example.com']);

        $this->postJson('/api/admin/register', validAdminPayload())
            ->assertCreated()
            ->assertJsonPath('success', true);
    });

    it('does not reveal which check failed in the error message', function (): void {
        $payload = validAdminPayload();
        $payload['inviteCode'] = 'wrong';
        $payload['email'] = 'hacker@notallowed.com';

        $response = $this->postJson('/api/admin/register', $payload)
            ->assertUnprocessable();

        $message = $response->json('message');
        expect($message)->not->toContain('invite');
        expect($message)->not->toContain('domain');
        expect($message)->toBe('Registration failed. Please contact your administrator.');
    });

    it('still validates required fields after passing security checks', function (): void {
        $this->postJson('/api/admin/register', [
            'inviteCode' => 'ChangeMe123!',
            'email' => 'testadmin@example.com',
            // missing firstName, lastName, password, confirmPassword
        ])
            ->assertUnprocessable()
            ->assertJsonPath('success', false);
    });

    it('prevents duplicate email registration', function (): void {
        User::factory()->create(['email' => 'testadmin@example.com']);

        $this->postJson('/api/admin/register', validAdminPayload())
            ->assertUnprocessable();
    });
});
