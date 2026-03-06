<?php

use App\Models\User;
use App\Models\Volunteer;
use Illuminate\Support\Facades\Hash;

describe('Change Password', function (): void {
    beforeEach(function (): void {
        $this->user = User::factory()->create([
            'password' => Hash::make('OldPassword1!Secure'),
        ]);
        $this->volunteer = Volunteer::factory()->create(['user_id' => $this->user->id]);
        $this->actingAs($this->user);
    });

    it('changes password with valid current password', function (): void {
        $this->postJson('/api/volunteer/change-password', [
            'currentPassword' => 'OldPassword1!Secure',
            'newPassword' => 'NewPassword2!Strong',
            'newPassword_confirmation' => 'NewPassword2!Strong',
        ])
            ->assertSuccessful()
            ->assertJsonPath('success', true);

        $this->user->refresh();
        expect(Hash::check('NewPassword2!Strong', $this->user->password))->toBeTrue();
    });

    it('rejects incorrect current password', function (): void {
        $this->postJson('/api/volunteer/change-password', [
            'currentPassword' => 'WrongPassword!1234',
            'newPassword' => 'NewPassword2!Strong',
            'newPassword_confirmation' => 'NewPassword2!Strong',
        ])
            ->assertUnprocessable()
            ->assertJsonPath('success', false);
    });

    it('rejects mismatched new password confirmation', function (): void {
        $this->postJson('/api/volunteer/change-password', [
            'currentPassword' => 'OldPassword1!Secure',
            'newPassword' => 'NewPassword2!Strong',
            'newPassword_confirmation' => 'DifferentPassword!3',
        ])
            ->assertUnprocessable()
            ->assertJsonValidationErrors(['newPassword']);
    });

    it('rejects weak new password', function (): void {
        $this->postJson('/api/volunteer/change-password', [
            'currentPassword' => 'OldPassword1!Secure',
            'newPassword' => 'short',
            'newPassword_confirmation' => 'short',
        ])
            ->assertUnprocessable()
            ->assertJsonValidationErrors(['newPassword']);
    });

    it('requires all fields', function (string $field): void {
        $this->postJson('/api/volunteer/change-password', [$field => ''])
            ->assertUnprocessable()
            ->assertJsonValidationErrors([$field]);
    })->with([
        'currentPassword',
        'newPassword',
        'newPassword_confirmation',
    ]);

    it('denies access for user without volunteer record', function (): void {
        $plainUser = User::factory()->create();

        $this->actingAs($plainUser)
            ->postJson('/api/volunteer/change-password', [
                'currentPassword' => 'password',
                'newPassword' => 'NewPassword2!Strong',
                'newPassword_confirmation' => 'NewPassword2!Strong',
            ])
            ->assertForbidden();
    });

    it('denies unauthenticated access', function (): void {
        $this->app->make('auth')->forgetGuards();

        $response = $this->postJson('/api/volunteer/change-password', [
            'currentPassword' => 'password',
            'newPassword' => 'NewPassword2!Strong',
            'newPassword_confirmation' => 'NewPassword2!Strong',
        ]);

        $response->assertUnauthorized();
    });
});
