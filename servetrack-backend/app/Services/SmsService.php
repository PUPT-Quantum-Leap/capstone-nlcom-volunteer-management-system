<?php

namespace App\Services;

use App\Jobs\SendRsvpSms;
use App\Models\Rsvp;
use App\Models\Volunteer;
use Illuminate\Support\Facades\Log;
use Twilio\Rest\Client;

class SmsService
{
    protected ?Client $twilio = null;

    protected ?string $fromNumber;

    public function __construct()
    {
        $sid = config('services.twilio.sid');
        $token = config('services.twilio.token');
        $phoneNumber = config('services.twilio.phone_number');

        if ($sid && $token) {
            $this->twilio = new Client($sid, $token);
        }

        if ($phoneNumber) {
            $this->fromNumber = $phoneNumber;
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

    public function broadcastRsvpNotification(Rsvp $rsvp): array
    {
        $volunteers = Volunteer::whereNotNull('mobile_number')->get();

        foreach ($volunteers as $volunteer) {
            SendRsvpSms::dispatch($volunteer, $rsvp);
        }

        return [
            'total' => $volunteers->count(),
            'sent' => 0,
            'failed' => 0,
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
