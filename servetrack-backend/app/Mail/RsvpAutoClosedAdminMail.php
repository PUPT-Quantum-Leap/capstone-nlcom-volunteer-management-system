<?php

namespace App\Mail;

use App\Models\Admin;
use App\Models\Rsvp;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Mail\Mailable;
use Illuminate\Mail\Mailables\Content;
use Illuminate\Mail\Mailables\Envelope;
use Illuminate\Queue\SerializesModels;

class RsvpAutoClosedAdminMail extends Mailable implements ShouldQueue
{
    use Queueable, SerializesModels;

    public function __construct(public Rsvp $rsvp, public Admin $admin): void {}

    public function envelope(): Envelope
    {
        return new Envelope(
            subject: "[AUTO-CLOSED] RSVP Event: {$this->rsvp->title}",
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

        return new Content(
            view: 'emails.rsvp.auto-closed-admin',
            with: [
                'rsvp' => $this->rsvp,
                'admin' => $this->admin,
                'adminDashboardUrl' => rtrim($frontendUrl, '/').'/admin-dashboard/rsvps',
            ],
        );
    }

    public function attachments(): array
    {
        return [];
    }
}
