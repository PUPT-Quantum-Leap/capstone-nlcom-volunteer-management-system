<?php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;

class ApplyAiSuggestionsRequest extends FormRequest
{
    public function authorize(): bool
    {
        return $this->user()?->role === 'admin';
    }

    protected function prepareForValidation(): void
    {
        // Sanitize suggestions array
        $suggestions = $this->input('suggestions', []);
        if (is_array($suggestions)) {
            $sanitized = array_map(static function ($suggestion): array {
                if (! is_array($suggestion)) {
                    return [
                        'volunteer_id' => null,
                        'team_id' => null,
                        'role' => null,
                    ];
                }

                return [
                    'volunteer_id' => $suggestion['volunteer_id'] ?? null,
                    'team_id' => $suggestion['team_id'] ?? null,
                    'role' => is_string($suggestion['role'] ?? null) ? trim($suggestion['role']) : null,
                ];
            }, $suggestions);
            $this->merge(['suggestions' => $sanitized]);
        }
    }

    public function rules(): array
    {
        return [
            'suggestions' => ['required', 'array', 'min:1'],
            'suggestions.*.volunteer_id' => ['required', 'exists:volunteer,volunteer_id'],
            'suggestions.*.team_id' => ['required', 'exists:teams,id'],
            'suggestions.*.role' => ['nullable', 'string', 'max:255'],
        ];
    }

    public function messages(): array
    {
        return [
            'suggestions.required' => 'AI suggestions are required.',
            'suggestions.array' => 'Suggestions must be an array.',
            'suggestions.min' => 'At least one suggestion is required.',
            'suggestions.*.volunteer_id.required' => 'Volunteer ID is required for each suggestion.',
            'suggestions.*.volunteer_id.exists' => 'The specified volunteer does not exist.',
            'suggestions.*.team_id.required' => 'Team ID is required for each suggestion.',
            'suggestions.*.team_id.exists' => 'The specified team does not exist.',
            'suggestions.*.role.string' => 'Role must be a string.',
            'suggestions.*.role.max' => 'Role must not exceed 255 characters.',
        ];
    }
}
