<?php

namespace App\Mail;

use App\Models\Rsvp;
use App\Models\Volunteer;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Mail\Mailable;
use Illuminate\Mail\Mailables\Content;
use Illuminate\Mail\Mailables\Envelope;
use Illuminate\Queue\SerializesModels;

class RsvpAutoClosedVolunteerMail extends Mailable implements ShouldQueue
{
    use Queueable, SerializesModels;

    public function __construct(public Rsvp $rsvp, public Volunteer $volunteer) {}

    public function envelope(): Envelope
    {
        return new Envelope(
            subject: "RSVP Closed: {$this->rsvp->title}",
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
        if (app()->environment('production') && ($parsed['scheme'] ?? '') !== 'https') {
            throw new \RuntimeException('app.frontend_url must use HTTPS scheme in production');
        }
        $frontendUrl = rtrim($frontendUrl, '/');

        return new Content(
            view: 'emails.rsvp.auto-closed-volunteer',
            with: [
                'rsvp' => $this->rsvp,
                'volunteer' => $this->volunteer,
                'rsvpUrl' => $frontendUrl.'/rsvp/'.(string) $this->rsvp->slug,
            ],
        );
    }

    public function attachments(): array
    {
        return [];
    }
}
