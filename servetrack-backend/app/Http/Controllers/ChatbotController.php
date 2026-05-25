<?php

namespace App\Http\Controllers;

use App\Http\Requests\ChatbotMessageRequest;
use App\Services\SupabaseService;
use Firebase\JWT\JWT;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Http;

class ChatbotController extends Controller
{
    /**
     * Send a message to the n8n chatbot workflow via webhook.
     *
     * Authenticates the request using JWT (HS256) signed with the webhook secret.
     */
    public function message(ChatbotMessageRequest $request): JsonResponse
    {
        $validated = $request->validated();

        $webhookUrl = config('services.chatbot.webhook_url');
        $jwtSecret = config('services.chatbot.webhook_jwt_secret');

        if (! $webhookUrl || ! $jwtSecret) {
            return response()->json([
                'error' => 'Chatbot webhook not configured',
            ], 500);
        }

        $jwt = JWT::encode([
            'iss' => 'servetrack-backend',
            'exp' => time() + 300,
        ], $jwtSecret, 'HS256');

        try {
            $response = Http::withToken($jwt)
                ->timeout(30)
                ->post($webhookUrl, [
                    'body' => [
                        'message' => $validated['message'],
                        'sessionId' => $validated['session_id'] ?? null,
                    ],
                ]);

            if (! $response->successful()) {
                return response()->json([
                    'error' => 'Chatbot service unavailable',
                ], 503);
            }

            return response()->json($response->json());
        } catch (\Exception $e) {
            \Log::error('Chatbot webhook error: '.$e->getMessage());

            return response()->json([
                'error' => 'Failed to communicate with chatbot service',
            ], 500);
        }
    }

    /**
     * Get conversation history for the authenticated user.
     */
    public function history(Request $request): JsonResponse
    {
        $sessionId = $request->query('session_id', '');
        $userId = $request->user()->id;

        $messages = app(SupabaseService::class)->getHistory($userId, $sessionId);

        return response()->json(['success' => true, 'data' => $messages]);
    }

    /**
     * Clear conversation history for the authenticated user.
     */
    public function clear(Request $request): JsonResponse
    {
        $sessionId = $request->input('session_id', '');
        $userId = $request->user()->id;

        app(SupabaseService::class)->clearHistory($userId, $sessionId);

        return response()->json(['success' => true, 'message' => 'Conversation history cleared']);
    }
}
