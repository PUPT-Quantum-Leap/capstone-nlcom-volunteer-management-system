<?php

namespace App\Http\Controllers;

use App\Http\Requests\ChatbotMessageRequest;
use Firebase\JWT\JWT;
use Illuminate\Http\JsonResponse;
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
     *
     * Note: Chat history is managed by n8n via Postgres chat memory.
     * This endpoint exists for frontend compatibility but returns empty
     * since the n8n workflow handles persistence internally.
     */
    public function history(): JsonResponse
    {
        return response()->json(['success' => true, 'data' => []]);
    }

    /**
     * Clear conversation history for the authenticated user.
     *
     * Note: Chat memory is managed by n8n. This is a no-op placeholder.
     */
    public function clear(): JsonResponse
    {
        return response()->json(['success' => true, 'message' => 'Conversation history cleared']);
    }
}
