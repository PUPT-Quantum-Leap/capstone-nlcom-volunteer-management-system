<?php

namespace App\Services;

use Illuminate\Http\Client\RequestException;
use Illuminate\Support\Facades\Http;

class SupabaseService
{
    public function __construct(
        private string $baseUrl = '',
        private string $serviceKey = '',
    ) {
        // Resolve from config if not provided
        if (! $this->baseUrl) {
            $this->baseUrl = config('services.supabase.url');
        }
        if (! $this->serviceKey) {
            $this->serviceKey = config('services.supabase.service_key');
        }
    }

    public function getHistory(int $userId, string $sessionId, int $limit = 50): array
    {
        if (! $this->baseUrl || ! $this->serviceKey) {
            return [];
        }

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
        if (! $this->baseUrl || ! $this->serviceKey) {
            return;
        }

        try {
            Http::withHeaders([
                'apikey' => $this->serviceKey,
                'Authorization' => "Bearer {$this->serviceKey}",
            ])->withQueryParameters([
                'user_id' => "eq.{$userId}",
                'session_id' => "eq.{$sessionId}",
            ])->delete("{$this->baseUrl}/rest/v1/chatbot_conversations");
        } catch (RequestException) {
            // Silently fail — history clear is non-critical
        }
    }
}
