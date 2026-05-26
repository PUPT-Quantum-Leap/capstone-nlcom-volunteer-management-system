<?php

use App\Models\User;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Str;

const TEST_WEBHOOK_URL = 'https://ai.quantumapp.tech/webhook-test/chatbot';
const TEST_WEBHOOK_SECRET = 'test-webhook-secret-that-is-long-enough-for-hs256-sha256-minimum-32-bytes';

beforeEach(function (): void {
    config([
        'services.chatbot.webhook_url' => TEST_WEBHOOK_URL,
        'services.chatbot.webhook_jwt_secret' => TEST_WEBHOOK_SECRET,
    ]);
    $this->actingAs(User::factory()->create());
});

it('sends a message to the n8n chatbot webhook with jwt auth', function (): void {
    Http::fake([
        TEST_WEBHOOK_URL => Http::response([
            'output' => 'Hello! How can I help you?',
        ]),
    ]);

    $response = $this->postJson('/api/chatbot/message', [
        'message' => 'What are volunteer opportunities?',
        'session_id' => null,
    ]);

    $response->assertSuccessful()
        ->assertJsonPath('success', true)
        ->assertJsonPath('message', 'Hello! How can I help you?');
    Http::assertSent(function ($request) {
        $body = $request->data();

        return $request->hasHeader('Authorization')
            && isset($body['message'])
            && $body['message'] === 'What are volunteer opportunities?';
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
        TEST_WEBHOOK_URL => Http::response([
            'output' => 'Response',
        ]),
    ]);

    $response = $this->postJson('/api/chatbot/message', [
        'message' => 'Hello',
        'session_id' => $sessionId,
    ]);

    $response->assertSuccessful()
        ->assertJsonPath('success', true)
        ->assertJsonPath('session_id', $sessionId);
    Http::assertSent(function ($request) use ($sessionId) {
        $body = $request->data();

        return isset($body['sessionId'])
            && $body['sessionId'] === $sessionId;
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
        TEST_WEBHOOK_URL => Http::response(null, 503),
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

it('rejects messages that are only whitespace', function (): void {
    $response = $this->postJson('/api/chatbot/message', [
        'message' => "   \n\t  ",
    ]);

    $response->assertUnprocessable()
        ->assertJsonValidationErrors('message');
});

it('strips <script> tags from messages before they reach the webhook', function (): void {
    Http::fake([
        TEST_WEBHOOK_URL => Http::response(['output' => 'ok']),
    ]);

    $response = $this->postJson('/api/chatbot/message', [
        'message' => 'hello <script>alert(1)</script>',
    ]);

    $response->assertSuccessful();
    Http::assertSent(function ($request) {
        $body = $request->data();

        return is_string($body['message'])
            && ! str_contains($body['message'], '<script')
            && ! str_contains($body['message'], '</script>');
    });
});

it('rejects messages containing <iframe> tags', function (): void {
    $response = $this->postJson('/api/chatbot/message', [
        'message' => '<iframe src="https://evil.example"></iframe>',
    ]);

    $response->assertUnprocessable()
        ->assertJsonValidationErrors('message');
});

it('rejects messages containing javascript: URIs', function (): void {
    $response = $this->postJson('/api/chatbot/message', [
        'message' => 'click here javascript:alert(1)',
    ]);

    $response->assertUnprocessable()
        ->assertJsonValidationErrors('message');
});

it('rejects messages containing inline event handlers', function (): void {
    $response = $this->postJson('/api/chatbot/message', [
        'message' => '<img src=x onerror="alert(1)">',
    ]);

    $response->assertUnprocessable()
        ->assertJsonValidationErrors('message');
});

it('rejects an invalid uuid session id', function (): void {
    $response = $this->postJson('/api/chatbot/message', [
        'message' => 'hello',
        'session_id' => 'not-a-uuid',
    ]);

    $response->assertUnprocessable()
        ->assertJsonValidationErrors('session_id');
});

it('returns the same uuid the client supplied', function (): void {
    $sessionId = (string) Str::uuid();
    Http::fake([
        TEST_WEBHOOK_URL => Http::response(['output' => 'hi']),
    ]);

    $response = $this->postJson('/api/chatbot/message', [
        'message' => 'hello',
        'session_id' => $sessionId,
    ]);

    $response->assertSuccessful()
        ->assertJsonPath('session_id', $sessionId);
});

it('generates a uuid when the client omits session id', function (): void {
    Http::fake([
        TEST_WEBHOOK_URL => Http::response(['output' => 'hi']),
    ]);

    $response = $this->postJson('/api/chatbot/message', [
        'message' => 'hello',
    ]);

    $response->assertSuccessful();
    $returned = $response->json('session_id');
    expect($returned)->toBeString();
    expect(Str::isUuid($returned))->toBeTrue();
});

it('requires authentication', function (): void {
    auth()->logout();
    config([
        'services.chatbot.webhook_url' => TEST_WEBHOOK_URL,
        'services.chatbot.webhook_jwt_secret' => TEST_WEBHOOK_SECRET,
    ]);

    $response = $this->postJson('/api/chatbot/message', [
        'message' => 'hello',
    ]);

    $response->assertUnauthorized();
});
