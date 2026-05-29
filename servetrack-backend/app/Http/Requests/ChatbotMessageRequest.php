<?php

namespace App\Http\Requests;

use App\Rules\NoMaliciousContent;
use Illuminate\Contracts\Validation\Validator;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Support\Facades\Log;

class ChatbotMessageRequest extends FormRequest
{
    public function authorize(): bool
    {
        return $this->user() !== null;
    }

    /**
     * Pre-validation hook: trim leading/trailing whitespace so a message
     * that's only spaces/newlines will be caught by the `min:1` rule
     * instead of being silently accepted.
     */
    protected function prepareForValidation(): void
    {
        if (is_string($this->input('message'))) {
            $this->merge([
                'message' => trim($this->input('message')),
            ]);
        }
    }

    /**
     * @return array<string, array<int, string|object>>
     */
    public function rules(): array
    {
        return [
            'message' => ['required', 'string', 'min:1', 'max:2000', new NoMaliciousContent],
            'session_id' => ['nullable', 'string', 'uuid'],
            'context' => ['nullable', 'array'],
            'context.user_name' => ['nullable', 'string', 'max:100'],
            'context.user_role' => ['nullable', 'string', 'max:50'],
            'context.app_description' => ['nullable', 'string', 'max:500'],
        ];
    }

    /**
     * @return array<string, string>
     */
    public function messages(): array
    {
        return [
            'message.required' => 'Please enter a message.',
            'message.min' => 'Message cannot be empty.',
            'message.max' => 'Message cannot exceed 2000 characters.',
            'session_id.uuid' => 'Session ID must be a valid UUID.',
        ];
    }

    /**
     * Audit-log suspicious payloads before the framework returns 422.
     *
     * We only log when the rejected payload actually contained a known
     * injection marker — ordinary "field required" failures are noise.
     */
    protected function failedValidation(Validator $validator): void
    {
        $message = $this->input('message');

        if (is_string($message) && NoMaliciousContent::matches($message)) {
            Log::warning('chatbot.suspicious_payload', [
                'user_id' => $this->user()?->id,
                'ip' => $this->ip(),
                'session_id' => $this->input('session_id'),
                // Store a preview only, capped, so logs aren't flooded
                // with attacker-supplied data.
                'message_preview' => mb_substr($message, 0, 200),
            ]);
        }

        parent::failedValidation($validator);
    }
}
