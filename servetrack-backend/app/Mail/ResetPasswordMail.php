<?php

namespace App\Mail;

use App\Models\User;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Mail\Mailable;
use Illuminate\Mail\Mailables\Content;
use Illuminate\Mail\Mailables\Envelope;
use Illuminate\Mail\Mailables\Headers;
use Illuminate\Queue\SerializesModels;

class ResetPasswordMail extends Mailable implements ShouldQueue
{
    use Queueable, SerializesModels;

    public function __construct(public User $user, public string $token) {}

    public function envelope(): Envelope
    {
        return new Envelope(
            subject: 'Reset Your Password',
            replyTo: $this->user->email,
            tags: ['password-reset'],
        );
    }

    public function headers(): Headers
    {
        return new Headers(
            text: [
                'X-Auto-Response-Suppress' => 'OOF, AutoReply, DR, NDR, RN, NRN',
                'Auto-Submitted' => 'auto-generated',
                'Precedence' => 'bulk',
            ],
        );
    }

    public function content(): Content
    {
        $frontendUrl = config('app.frontend_url');
        if (! is_string($frontendUrl) || $frontendUrl === '') {
            throw new \RuntimeException('Missing required configuration: app.frontend_url');
        }
        if (filter_var($frontendUrl, FILTER_VALIDATE_URL) === false) {
            throw new \RuntimeException('Invalid app.frontend_url: must be a valid URL');
        }
        $parsed = parse_url($frontendUrl);
        $host = $parsed['host'] ?? '';
        $isLocalhost = in_array($host, ['localhost', '127.0.0.1', '::1'], true);
        if (app()->environment('production') && ! $isLocalhost && ($parsed['scheme'] ?? '') !== 'https') {
            throw new \RuntimeException('app.frontend_url must use HTTPS scheme in production');
        }
        $frontendUrl = rtrim($frontendUrl, '/');

        $resetUrl = $frontendUrl.'/reset-password?token='.$this->token.'&email='.urlencode($this->user->email).'&role='.$this->user->role;

        return new Content(
            view: 'emails.auth.reset-password',
            text: 'emails.auth.reset-password-text',
            with: [
                'user' => $this->user,
                'resetUrl' => $resetUrl,
                'expireMinutes' => config('auth.passwords.users.expire', 60),
            ],
        );
    }

    public function attachments(): array
    {
        return [];
    }
}
