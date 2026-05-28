<?php

namespace App\Services;

use Firebase\JWT\JWT;
use Illuminate\Http\Client\Response;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;

class ChatbotService
{
    private string $primaryUrl;

    private string $fallbackUrl;

    private string $jwtSecret;

    private int $timeout;

    public function __construct()
    {
        $this->primaryUrl  = config('services.chatbot.webhook_url', '');
        $this->fallbackUrl = config('services.chatbot.fallback_webhook_url', '');
        $this->jwtSecret   = config('services.chatbot.webhook_jwt_secret', '');
        $this->timeout     = (int) config('services.chatbot.timeout', 30);
    }

    /**
     * Send a chat message to the n8n AI agent.
     *
     * Attempts the primary webhook first with automatic retries on transient
     * failures, then falls back to the secondary webhook URL if configured.
     *
     * @param  array<string, mixed>  $userContext
     * @return array<string, mixed>  ['output' => string, 'session_id' => string]
     *
     * @throws \RuntimeException When all webhooks are exhausted.
     */
    public function sendMessage(
        string $message,
        string $sessionId,
        array $userContext = []
    ): array {
        if (! $this->primaryUrl || ! $this->jwtSecret) {
            throw new \RuntimeException('Chatbot webhook not configured.');
        }

        $payload = [
            'message'     => $message,
            'sessionId'   => $sessionId,
            'userContext' => empty($userContext) ? null : $userContext,
        ];

        // 1. Try primary webhook (with 2 automatic retries on 5xx / timeout)
        try {
            $response = $this->callWebhook($this->primaryUrl, $payload, retries: 2);

            if ($response->successful()) {
                return $this->parseResponse($response, $sessionId);
            }

            Log::warning('chatbot.primary_webhook.unsuccessful', [
                'status'     => $response->status(),
                'session_id' => $sessionId,
            ]);
        } catch (\Exception $e) {
            Log::warning('chatbot.primary_webhook.exception', [
                'error'      => $e->getMessage(),
                'session_id' => $sessionId,
            ]);
        }

        // 2. Try fallback webhook if configured
        if ($this->fallbackUrl) {
            try {
                Log::info('chatbot.fallback_webhook.attempt', ['session_id' => $sessionId]);

                $response = $this->callWebhook($this->fallbackUrl, $payload, retries: 1);

                if ($response->successful()) {
                    return $this->parseResponse($response, $sessionId);
                }
            } catch (\Exception $e) {
                Log::error('chatbot.fallback_webhook.exception', [
                    'error'      => $e->getMessage(),
                    'session_id' => $sessionId,
                ]);
            }
        }

        throw new \RuntimeException('All chatbot webhook endpoints failed.');
    }

    /**
     * Build a signed JWT bearer token for the upstream webhook.
     */
    public function buildJwt(): string
    {
        return JWT::encode([
            'iss' => 'servetrack-backend',
            'exp' => time() + 300,
        ], $this->jwtSecret, 'HS256');
    }

    /**
     * Generate a human-readable, traceable session key.
     * Format: chat-{email-prefix}-{8 random hex chars}
     */
    public function buildSessionId(string $email): string
    {
        $prefix = explode('@', $email)[0];
        $prefix = preg_replace('/[^a-z0-9]/i', '', strtolower($prefix));

        return 'chat-' . substr($prefix, 0, 16) . '-' . bin2hex(random_bytes(4));
    }

    // ──────────────────────────────────────────────────────────────────────────

    /**
     * @param  array<string, mixed>  $payload
     */
    private function callWebhook(string $url, array $payload, int $retries): Response
    {
        return Http::withToken($this->buildJwt())
            ->timeout($this->timeout)
            ->retry($retries, sleepMilliseconds: 1000, when: fn(\Exception $e) => $this->isTransient($e))
            ->post($url, $payload);
    }

    /**
     * @return array<string, mixed>
     */
    private function parseResponse(Response $response, string $sessionId): array
    {
        $data = $response->json() ?? [];

        return [
            'output'     => $data['output'] ?? $data['response'] ?? $data['message'] ?? '',
            'session_id' => $data['session_id'] ?? $sessionId,
            'metadata'   => $data['metadata'] ?? null,
        ];
    }

    private function isTransient(\Exception $e): bool
    {
        // Retry on connection timeouts and network failures
        return $e instanceof \Illuminate\Http\Client\ConnectionException;
    }
}
