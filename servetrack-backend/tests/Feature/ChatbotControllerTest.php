<?php

use Illuminate\Support\Facades\Http;
use Illuminate\Support\Str;

it('sends a message to the n8n chatbot webhook with jwt auth', function (): void {
    Http::fake([
        'https://ai.quantumapp.tech/webhook-test/*' => Http::response([
            'response' => 'Hello! How can I help you?',
            'session_id' => Str::uuid(),
        ]),
    ]);

    $response = $this->postJson('/api/chatbot/message', [
        'message' => 'What are volunteer opportunities?',
        'session_id' => null,
    ]);

    $response->assertSuccessful();
    Http::assertSent(function ($request) {
        $body = $request->data();

        return $request->hasHeader('Authorization')
            && isset($body['body']['message'])
            && $body['body']['message'] === 'What are volunteer opportunities?';
    });
});

it('validates required message field', function (): void {
    $response = $this->postJson('/api/chatbot/message', [
        'message' => '',
    ]);

    $response->assertUnprocessable()
        ->assertJsonValidationErrors('message');
});

it('accepts optional session_id with uuid format', function (): void {
    $sessionId = (string) Str::uuid();
    Http::fake([
        'https://ai.quantumapp.tech/webhook-test/*' => Http::response([
            'response' => 'Response',
            'session_id' => $sessionId,
        ]),
    ]);

    $response = $this->postJson('/api/chatbot/message', [
        'message' => 'Hello',
        'session_id' => $sessionId,
    ]);

    $response->assertSuccessful();
    Http::assertSent(function ($request) use ($sessionId) {
        $body = $request->data();

        return isset($body['body']['sessionId'])
            && $body['body']['sessionId'] === $sessionId;
    });
});

it('returns 500 when webhook is not configured', function (): void {
    config(['services.chatbot.webhook_url' => null]);

    $response = $this->postJson('/api/chatbot/message', [
        'message' => 'Test message',
    ]);

    $response->assertServerError()
        ->assertJsonPath('error', 'Chatbot webhook not configured');
});

it('returns 503 when webhook service is unavailable', function (): void {
    Http::fake([
        'https://ai.quantumapp.tech/webhook-test/*' => Http::response(null, 503),
    ]);

    $response = $this->postJson('/api/chatbot/message', [
        'message' => 'Test message',
    ]);

    $response->assertStatus(503)
        ->assertJsonPath('error', 'Chatbot service unavailable');
});

it('limits message length to 2000 characters', function (): void {
    $response = $this->postJson('/api/chatbot/message', [
        'message' => str_repeat('a', 2001),
    ]);

    $response->assertUnprocessable()
        ->assertJsonValidationErrors('message');
});
