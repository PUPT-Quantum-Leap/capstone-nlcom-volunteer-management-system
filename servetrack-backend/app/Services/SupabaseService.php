<?php

namespace App\Services;

use Illuminate\Http\Client\RequestException;
use Illuminate\Support\Facades\Http;

class SupabaseService
{
    private string $baseUrl;

    private string $serviceKey;

    public function __construct()
    {
        $this->baseUrl = config('services.supabase.url');
        $this->serviceKey = config('services.supabase.service_key');
    }

    public function getHistory(int $userId, string $sessionId, int $limit = 50): array
    {
        try {
            $response = Http::withHeaders([
                'apikey' => $this->serviceKey,
                'Authorization' => "Bearer {$this->serviceKey}",
            ])->get("{$this->baseUrl}/rest/v1/chatbot_conversations", [
                'user_id' => "eq.{$userId}",
                'session_id' => "eq.{$sessionId}",
                'order' => 'created_at.asc',
                'limit' => $limit,
            ]);

            return $response->json() ?? [];
        } catch (RequestException) {
            return [];
        }
    }

    public function clearHistory(int $userId, string $sessionId): void
    {
        try {
            Http::withHeaders([
                'apikey' => $this->serviceKey,
                'Authorization' => "Bearer {$this->serviceKey}",
            ])->delete("{$this->baseUrl}/rest/v1/chatbot_conversations", [
                'user_id' => "eq.{$userId}",
                'session_id' => "eq.{$sessionId}",
            ]);
        } catch (RequestException) {
            // Silently fail — history clear is non-critical
        }
    }
}
