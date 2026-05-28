<?php

namespace App\Http\Controllers;

use App\Jobs\SendEmailBroadcastJob;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class EmailBroadcastController extends Controller
{
    /**
     * Dispatch the email broadcast queue job.
     */
    public function sendBroadcast(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'audience' => ['required', 'in:all,voted,not_voted'],
            'message' => ['required', 'string', 'min:5'],
            'rsvp_id' => ['required_if:audience,voted,not_voted', 'nullable', 'integer', 'exists:rsvp,rsvp_id'],
        ]);

        $rsvpId = isset($validated['rsvp_id']) ? (int) $validated['rsvp_id'] : null;

        SendEmailBroadcastJob::dispatch(
            $validated['audience'],
            $validated['message'],
            $rsvpId
        );

        return response()->json([
            'success' => true,
            'message' => 'Email broadcast has been queued successfully.',
        ]);
    }
}
