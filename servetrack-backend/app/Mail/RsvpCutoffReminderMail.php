<?php

namespace App\Mail;

use App\Models\Rsvp;
use App\Models\Volunteer;
use Illuminate\Bus\Queueable;
use Illuminate\Mail\Mailable;
use Illuminate\Mail\Mailables\Content;
use Illuminate\Mail\Mailables\Envelope;
use Illuminate\Queue\SerializesModels;

class RsvpCutoffReminderMail extends Mailable
{
    use Queueable, SerializesModels;

    /**
     * Create a new message instance.
     */
    public function __construct(
        public Rsvp $rsvp,
        public Volunteer $volunteer,
        public string $timeRemaining
    ) {}

    /**
     * Get the message envelope.
     */
    public function envelope(): Envelope
    {
        return new Envelope(
            subject: 'Reminder: RSVP Cutoff Approaching '.
                     "for {$this->rsvp->title}",
        );
    }

    /**
     * Get the message content definition.
     */
    public function content(): Content
    {
        // Get frontend URL configuration
        $frontendUrl = config('app.frontend_url');
        if (! is_string($frontendUrl) || $frontendUrl === '') {
            throw new \RuntimeException('Missing required configuration: app.frontend_url');
        }
        if (filter_var($frontendUrl, FILTER_VALIDATE_URL) === false) {
            throw new \RuntimeException('Invalid app.frontend_url: must be a valid URL');
        }
        $parsed = parse_url($frontendUrl);
        if (! is_array($parsed) || ! isset($parsed['scheme']) ||
            ($parsed['scheme'] !== 'https' && app()->environment('production'))) {
            throw new \RuntimeException('app.frontend_url must use HTTPS scheme in production');
        }
        $frontendUrl = rtrim($frontendUrl, '/');

        return new Content(
            view: 'emails.rsvp.cutoff-reminder',
            with: [
                'rsvp' => $this->rsvp,
                'volunteer' => $this->volunteer,
                'timeRemaining' => $this->timeRemaining,
                'cutoffDateTime' => \Carbon\Carbon::parse($this->rsvp->cutoff_day)
                    ->format('F j, Y').
                                    ' at '.\Carbon\Carbon::parse($this->rsvp->cutoff_time)
                                        ->format('g:i A'),
                'eventDate' => \Carbon\Carbon::parse($this->rsvp->date)
                    ->format('F j, Y'),
                'eventLocation' => $this->rsvp->event_location ??
                                    $this->rsvp->location?->name,
                'rsvpUrl' => $frontendUrl.'/rsvp/'.(string) $this->rsvp->slug,
            ]
        );
    }

    /**
     * Get the attachments for the message.
     *
     * @return array<int, \Illuminate\Mail\Mailables\Attachment>
     */
    public function attachments(): array
    {
        return [];
    }
}
