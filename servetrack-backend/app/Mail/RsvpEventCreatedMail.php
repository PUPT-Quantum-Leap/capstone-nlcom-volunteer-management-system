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

class RsvpEventCreatedMail extends Mailable implements ShouldQueue
{
    use Queueable, SerializesModels;

    public function __construct(public Rsvp $rsvp, public Volunteer $volunteer) {}

    /**
     * Get the message envelope.
     */
    public function envelope(): Envelope
    {
        return new Envelope(
            subject: "New RSVP Event: {$this->rsvp->title}",
        );
    }

    /**
     * Get the message content definition.
     */
    public function content(): Content
    {
        return new Content(
            view: 'emails.rsvp.event-created',
            with: [
                'rsvp' => $this->rsvp,
                'volunteer' => $this->volunteer,
                'rsvpUrl' => rtrim((string) config('app.frontend_url', 'http://localhost:4200'), '/').'/rsvp/'.$this->rsvp->slug,
            ],
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
