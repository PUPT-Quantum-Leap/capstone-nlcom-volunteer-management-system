<?php

namespace App\Http\Controllers;

use App\Services\FacebookService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Response;

class FacebookWebhookController extends Controller
{
    public function verify(Request $request): Response
    {
        $mode = $request->query('hub_mode') ?? $request->query('hub.mode');
        $token = $request->query('hub_verify_token') ?? $request->query('hub.verify_token');
        $challenge = $request->query('hub_challenge') ?? $request->query('hub.challenge');
        $expectedToken = config('services.facebook.webhook_verify_token');

        if ($mode === 'subscribe' && is_string($token) && hash_equals((string) $expectedToken, $token)) {
            return response((string) $challenge, 200);
        }

        return response('Forbidden', 403);
    }

    public function handle(Request $request, FacebookService $facebookService): JsonResponse
    {
        $payload = $request->all();
        $synced = $facebookService->syncMessengerPsidFromWebhook($payload);

        return response()->json([
            'success' => true,
            'synced' => $synced,
        ]);
    }
}
