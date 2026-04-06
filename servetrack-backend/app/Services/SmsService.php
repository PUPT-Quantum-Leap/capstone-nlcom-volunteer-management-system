<?php

namespace App\Services;

use App\Jobs\SendRsvpSmsJob;
use App\Models\Rsvp;
use App\Models\Volunteer;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Log;
use Twilio\Rest\Client;

class SmsService
{
    protected ?Client $twilio = null;

    protected ?string $fromNumber = null;

    public function __construct()
    {
        $sid = config('services.twilio.sid');
        $token = config('services.twilio.token');
        $configuredFromNumber = config('services.twilio.phone_number');
        $this->fromNumber = is_string($configuredFromNumber) && $configuredFromNumber !== ''
            ? $configuredFromNumber
            : null;

        if ($sid && $token) {
            $this->twilio = new Client($sid, $token);
        }
    }

    public function isConfigured(): bool
    {
        return $this->twilio !== null && $this->fromNumber !== null;
    }

    public function sendSms(string $toNumber, string $message): array
    {
        if (! $this->twilio) {
            throw new \Exception('Twilio is not configured.');
        }

        try {
            $twilioMessage = $this->twilio->messages->create($toNumber, [
                'from' => $this->fromNumber,
                'body' => $message,
            ]);

            return [
                'success' => true,
                'sid' => $twilioMessage->sid,
                'status' => $twilioMessage->status,
            ];
        } catch (\Exception $e) {
            Log::error('Twilio SMS Error: '.$e->getMessage());
            throw $e;
        }
    }

    public function sendRsvpNotification(Volunteer $volunteer, Rsvp $rsvp): bool
    {
        if (! $volunteer->mobile_number) {
            return false;
        }

        $message = $this->formatRsvpMessage($rsvp);

        try {
            $this->sendSms($volunteer->mobile_number, $message);

            return true;
        } catch (\Exception $e) {
            Log::error("SMS failed for volunteer {$volunteer->volunteer_id}: ".$e->getMessage());

            return false;
        }
    }

    public function broadcastRsvpNotification(Rsvp $rsvp, int $ttl = 60): array
    {
        $batchId = 'sms_broadcast_'.$rsvp->rsvp_id;

        $volunteers = Volunteer::whereNotNull('mobile_number')->get();

        Cache::put("{$batchId}_total", $volunteers->count(), $ttl);
        Cache::put("{$batchId}_sent", 0, $ttl);
        Cache::put("{$batchId}_failed", 0, $ttl);

        foreach ($volunteers as $volunteer) {
            SendRsvpSmsJob::dispatch($volunteer->volunteer_id, $rsvp->rsvp_id, $batchId);
        }

        return [
            'total' => $volunteers->count(),
            'sent' => 0,
            'failed' => 0,
        ];
    }

    public static function getBroadcastProgress(string $batchId): array
    {
        return [
            'total' => Cache::get("{$batchId}_total", 0),
            'sent' => Cache::get("{$batchId}_sent", 0),
            'failed' => Cache::get("{$batchId}_failed", 0),
        ];
    }

    protected function formatRsvpMessage(Rsvp $rsvp): string
    {
        $deadline = $rsvp->cutoff_day.' '.$rsvp->cutoff_time;
        $link = config('app.frontend_url', 'http://localhost:4200').'/rsvp?id='.$rsvp->rsvp_id;

        $message = "NLCOM RSVP Event\n";
        $message .= "{$rsvp->title}\n";
        $message .= "Date: {$rsvp->date}\n";

        if ($rsvp->event_location) {
            $message .= "Location: {$rsvp->event_location}\n";
        }

        $message .= "Deadline: {$deadline}\n";
        $message .= "RSVP: {$link}";

        return $message;
    }
}
