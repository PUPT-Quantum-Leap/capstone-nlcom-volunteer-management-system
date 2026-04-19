<?php

namespace App\Services;

use App\Jobs\SendRsvpFacebookNotificationJob;
use App\Models\Rsvp;
use App\Models\Volunteer;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;

class FacebookService
{
    protected ?string $pageId;

    protected ?string $accessToken;

    public function __construct()
    {
        $configuredPageId = config('services.facebook.page_id');
        $configuredToken = config('services.facebook.page_access_token');

        $this->pageId = is_string($configuredPageId) && $configuredPageId !== ''
            ? $configuredPageId
            : null;
        $this->accessToken = is_string($configuredToken) && $configuredToken !== ''
            ? $configuredToken
            : null;
    }

    public function sendDirectMessage(string $recipientId, string $message): array
    {
        if (! $this->pageId || ! $this->accessToken) {
            throw new \RuntimeException('Facebook messaging is not configured.');
        }

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
        if (! $volunteer->messenger_psid) {
            return false;
        }

        $message = $this->formatRsvpMessage($rsvp);

        try {
            $this->sendDirectMessage($volunteer->messenger_psid, $message);

            return true;
        } catch (\Exception $e) {
            Log::error("Failed to send FB message to volunteer {$volunteer->volunteer_id}: ".$e->getMessage());

            return false;
        }
    }

    public function broadcastRsvpNotification(Rsvp $rsvp): array
    {
        $volunteers = Volunteer::whereNotNull('messenger_psid')->get();

        foreach ($volunteers as $volunteer) {
            SendRsvpFacebookNotificationJob::dispatch($volunteer->volunteer_id, $rsvp->rsvp_id);
        }

        return [
            'total' => $volunteers->count(),
            'sent' => 0,
            'failed' => 0,
        ];
    }

    /**
     * @param  array<string, mixed>  $payload
     */
    public function syncMessengerPsidFromWebhook(array $payload): bool
    {
        $psid = data_get($payload, 'entry.0.messaging.0.sender.id');
        $postbackPayload = data_get($payload, 'entry.0.messaging.0.postback.payload');

        if (! is_string($psid) || $psid === '') {
            return false;
        }

        if (! is_string($postbackPayload) || $postbackPayload === '') {
            return false;
        }

        preg_match('/VOLUNTEER:(\d+)/', $postbackPayload, $matches);
        $volunteerId = isset($matches[1]) ? (int) $matches[1] : null;

        if (! $volunteerId) {
            return false;
        }

        $volunteer = Volunteer::query()->find($volunteerId);

        if (! $volunteer) {
            return false;
        }

        $volunteer->messenger_psid = $psid;
        $volunteer->save();

        return true;
    }

    protected function formatRsvpMessage(Rsvp $rsvp): string
    {
        $deadline = $rsvp->cutoff_day.' '.$rsvp->cutoff_time;
        $frontend = rtrim((string) config('app.frontend_url', 'http://localhost:4200'), '/');
        $link = $frontend.'/rsvp?id='.$rsvp->rsvp_id;

        $message = "📢 *New RSVP Event!*\n\n";
        $message .= "*{$rsvp->title}*\n";
        $message .= "📅 Date: {$rsvp->date}\n";

        if ($rsvp->event_location) {
            $message .= "📍 Location: {$rsvp->event_location}\n";
        }

        $message .= "⏰ Deadline: {$deadline}\n\n";
        $message .= "👉 Click here to RSVP: {$link}";

        return $message;
    }
}
