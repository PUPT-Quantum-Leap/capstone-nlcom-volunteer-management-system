<?php

namespace App\Http\Controllers;

use App\Http\Requests\ChatbotMessageRequest;
use App\Services\SupabaseService;
use Firebase\JWT\JWT;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Str;

class ChatbotController extends Controller
{
    /**
     * Send a message to the n8n chatbot workflow via webhook.
     *
     * Authenticates the upstream call using JWT (HS256) signed with the
     * shared webhook secret. Returns the assistant reply alongside the
     * session id used (generated server-side if the client did not supply
     * one) so the client can persist it for follow-up messages.
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

        $sessionId = $validated['session_id'] ?? (string) Str::uuid();

        Log::info('chatbot.message.dispatched', [
            'user_id' => $request->user()?->id,
            'session_id' => $sessionId,
            'message_length' => strlen($validated['message']),
        ]);

        $jwt = JWT::encode([
            'iss' => 'servetrack-backend',
            'exp' => time() + 300,
        ], $jwtSecret, 'HS256');

        try {
            $response = Http::withToken($jwt)
                ->timeout(30)
                ->post($webhookUrl, [
                    'message' => $validated['message'],
                    'sessionId' => $sessionId,
                ]);

            if (! $response->successful()) {
                Log::warning('chatbot.webhook.unsuccessful', [
                    'user_id' => $request->user()?->id,
                    'status' => $response->status(),
                ]);

                return response()->json([
                    'error' => 'Chatbot service unavailable',
                ], 503);
            }

            $n8nData = $response->json();

            return response()->json([
                'success' => true,
                'message' => $n8nData['output'] ?? $n8nData['response'] ?? '',
                'session_id' => $sessionId,
            ]);
        } catch (\Exception $e) {
            Log::error('chatbot.webhook.error', [
                'user_id' => $request->user()?->id,
                'error' => $e->getMessage(),
            ]);

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
        $sessionId = (string) $request->query('session_id', '');
        $userId = $request->user()->id;

        if ($sessionId === '') {
            return response()->json(['success' => true, 'data' => []]);
        }

        $messages = app(SupabaseService::class)->getHistory($userId, $sessionId);

        return response()->json(['success' => true, 'data' => $messages]);
    }

    /**
     * Clear conversation history for the authenticated user.
     */
    public function clear(Request $request): JsonResponse
    {
        $sessionId = (string) $request->input('session_id', '');
        $userId = $request->user()->id;

        if ($sessionId !== '') {
            app(SupabaseService::class)->clearHistory($userId, $sessionId);
        }

        return response()->json(['success' => true, 'message' => 'Conversation history cleared']);
    }
}
