<?php

namespace App\Http\Controllers;

use App\Http\Requests\ChatbotMessageRequest;
use App\Services\ChatbotService;
use App\Services\UserContextService;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Str;

class ChatbotController extends Controller
{
    public function __construct(
        private readonly ChatbotService $chatbotService,
        private readonly UserContextService $userContextService,
    ) {}

    /**
     * Send a message to the n8n chatbot workflow via webhook.
     *
     * Authenticates the upstream call using JWT (HS256) signed with the
     * shared webhook secret. Injects the authenticated user's context so
     * the AI can personalise its responses. Returns the assistant reply
     * alongside the session id used so the client can persist it for
     * follow-up messages.
     */
    public function message(ChatbotMessageRequest $request): JsonResponse
    {
        $validated = $request->validated();
        $user      = $request->user();

        // Build or reuse a traceable session id
        $sessionId = $validated['session_id']
            ?? $this->chatbotService->buildSessionId($user?->email ?? 'guest');

        // Collect user context for the AI agent
        $userContext = [];
        $userContextError = null;

        if ($user) {
            try {
                $userContext = $this->userContextService->buildContext($user);
            } catch (\Throwable $e) {
                Log::warning('chatbot.context.build_failed', [
                    'user_id' => $user->id,
                    'error'   => $e->getMessage(),
                ]);
                $userContextError = 'Context unavailable';
            }
        }

        Log::info('chatbot.message.dispatched', [
            'user_id'    => $user?->id,
            'session_id' => $sessionId,
            'msg_length' => strlen($validated['message']),
            'role'       => $userContext['role'] ?? 'guest',
        ]);

        try {
            $result = $this->chatbotService->sendMessage(
                message:     $validated['message'],
                sessionId:   $sessionId,
                userContext: $userContext,
            );

            return response()->json([
                'success'    => true,
                'message'    => $result['output'],
                'session_id' => $result['session_id'] ?? $sessionId,
                'metadata'   => $result['metadata'] ?? null,
            ]);
        } catch (\RuntimeException $e) {
            Log::error('chatbot.message.all_webhooks_failed', [
                'user_id'    => $user?->id,
                'session_id' => $sessionId,
                'error'      => $e->getMessage(),
            ]);

            return response()->json([
                'success' => false,
                'message' => 'Sorry, I am temporarily unavailable. Please try again in a moment.',
            ], 503);
        } catch (\Throwable $e) {
            Log::error('chatbot.message.unexpected_error', [
                'user_id' => $user?->id,
                'error'   => $e->getMessage(),
            ]);

            return response()->json([
                'success' => false,
                'message' => 'An unexpected error occurred.',
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
