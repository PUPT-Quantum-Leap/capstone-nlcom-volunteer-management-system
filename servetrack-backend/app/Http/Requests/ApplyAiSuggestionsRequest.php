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
        $suggestions = $this->input('suggestions', []);
        if (is_array($suggestions)) {
            $sanitized = array_map(static function ($suggestion): array {
                if (! is_array($suggestion)) {
                    return [
                        'volunteer_id' => null,
                        'team_id' => null,
                        'role' => null,
                        'skills' => [],
                    ];
                }

                $skills = $suggestion['skills'] ?? [];
                if (is_array($skills)) {
                    $skills = array_values(array_filter(array_map(
                        static fn ($skill) => is_string($skill) ? trim($skill) : null,
                        $skills
                    )));
                }

                return [
                    'volunteer_id' => $suggestion['volunteer_id'] ?? null,
                    'volunteer_name' => is_string($suggestion['volunteer_name'] ?? null) ? trim($suggestion['volunteer_name']) : null,
                    'team_id' => $suggestion['team_id'] ?? null,
                    'team_name' => is_string($suggestion['team_name'] ?? null) ? trim($suggestion['team_name']) : null,
                    'role' => is_string($suggestion['role'] ?? null) ? trim($suggestion['role']) : null,
                    'skills' => is_array($skills) ? $skills : [],
                    'confidence' => $suggestion['confidence'] ?? null,
                    'reasoning' => is_string($suggestion['reasoning'] ?? null) ? trim($suggestion['reasoning']) : null,
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
            'suggestions.*.volunteer_name' => ['nullable', 'string', 'max:255'],
            'suggestions.*.team_id' => ['required', 'exists:teams,id'],
            'suggestions.*.team_name' => ['nullable', 'string', 'max:255'],
            'suggestions.*.role' => ['nullable', 'string', 'max:255'],
            'suggestions.*.skills' => ['nullable', 'array'],
            'suggestions.*.skills.*' => ['string', 'max:255'],
            'suggestions.*.confidence' => ['nullable', 'numeric', 'min:0', 'max:1'],
            'suggestions.*.reasoning' => ['nullable', 'string', 'max:1000'],
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
