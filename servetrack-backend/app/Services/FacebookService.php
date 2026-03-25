<?php

namespace App\Services;

use App\Models\Rsvp;
use App\Models\Volunteer;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;

class FacebookService
{
    protected string $pageId;

    protected string $accessToken;

    public function __construct()
    {
        $this->pageId = config('services.facebook.page_id', '');
        $this->accessToken = config('services.facebook.page_access_token', '');
    }

    public function sendDirectMessage(string $recipientId, string $message): array
    {
        $url = "https://graph.facebook.com/v18.0/{$this->pageId}/messages";

        $response = Http::post($url, [
            'recipient' => ['id' => $recipientId],
            'message' => ['text' => $message],
            'access_token' => $this->accessToken,
        ]);

        if ($response->failed()) {
            Log::error('Facebook API Error: '.$response->body());
            throw new \Exception('Failed to send Facebook message: '.$response->body());
        }

        return $response->json();
    }

    public function sendRsvpNotification(Volunteer $volunteer, Rsvp $rsvp): bool
    {
        if (! $volunteer->facebook_id) {
            return false;
        }

        $message = $this->formatRsvpMessage($rsvp);

        try {
            $this->sendDirectMessage($volunteer->facebook_id, $message);

            return true;
        } catch (\Exception $e) {
            Log::error("Failed to send FB message to volunteer {$volunteer->volunteer_id}: ".$e->getMessage());

            return false;
        }
    }

    public function broadcastRsvpNotification(Rsvp $rsvp): array
    {
        $volunteers = Volunteer::whereNotNull('facebook_id')->get();

        $sent = 0;
        $failed = 0;

        foreach ($volunteers as $volunteer) {
            if ($this->sendRsvpNotification($volunteer, $rsvp)) {
                $sent++;
            } else {
                $failed++;
            }
        }

        return [
            'total' => $volunteers->count(),
            'sent' => $sent,
            'failed' => $failed,
        ];
    }

    protected function formatRsvpMessage(Rsvp $rsvp): string
    {
        $deadline = $rsvp->cutoff_day.' '.$rsvp->cutoff_time;
        $link = config('app.frontend_url', 'http://localhost:4200').'/rsvp?id='.$rsvp->rsvp_id;

        $message = "📢 *New RSVP Event!*\n\n";
        $message .= "*{$rsvp->title}*\n";
        $message .= "📅 Date: {$rsvp->date}\n";

        if ($rsvp->event_location) {
            $message .= "📍 Location: {$rsvp->event_location}\n";
        }

        $message .= "⏰ Deadline: {$deadline}\n\n";
        $message .= "👉 [Click here to RSVP]({$link})";

        return $message;
    }
}
