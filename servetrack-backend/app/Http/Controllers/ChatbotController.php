<?php

namespace App\Http\Controllers;

use App\Http\Requests\ChatbotMessageRequest;
use App\Services\SupabaseService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Str;

class ChatbotController extends Controller
{
    public function __construct(
        protected SupabaseService $supabase
    ) {}

    public function message(ChatbotMessageRequest $request): JsonResponse
    {
        $user = $request->user();
        $sessionId = $request->input('session_id', (string) Str::uuid());
        $message = $request->validated('message');

        try {
            $response = Http::timeout(60)->post(config('services.chatbot.n8n_webhook_url'), [
                'message' => $message,
                'user_id' => $user->id,
                'user_role' => $user->role,
                'user_name' => $user->name,
                'session_id' => $sessionId,
            ]);

            $body = $response->json();

            if (! $response->successful()) {
                return response()->json([
                    'success' => false,
                    'message' => 'Chat service error. Please try again.',
                    'session_id' => $sessionId,
                ], 502);
            }

            return response()->json([
                'success' => true,
                'message' => $body['answer'] ?? $body['message'] ?? $body['output'] ?? 'No response.',
                'session_id' => $sessionId,
                'metadata' => $body['metadata'] ?? null,
            ]);
        } catch (\Exception $e) {
            return response()->json([
                'success' => false,
                'message' => 'Chat service unavailable. Please try again later.',
                'session_id' => $sessionId,
            ], 503);
        }
    }

    public function history(Request $request): JsonResponse
    {
        $user = $request->user();
        $sessionId = $request->query('session_id', (string) Str::uuid());

        $messages = $this->supabase->getHistory($user->id, $sessionId);

        return response()->json([
            'success' => true,
            'data' => $messages,
            'session_id' => $sessionId,
        ]);
    }

    public function clear(Request $request): JsonResponse
    {
        $user = $request->user();
        $sessionId = $request->input('session_id', (string) Str::uuid());

        $this->supabase->clearHistory($user->id, $sessionId);

        return response()->json([
            'success' => true,
            'message' => 'Conversation cleared.',
            'session_id' => $sessionId,
        ]);
    }
}
