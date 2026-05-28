<?php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;

class UpdateIcsRequest extends FormRequest
{
    public function authorize(): bool
    {
        return $this->user()?->role === 'admin';
    }

    protected function prepareForValidation(): void
    {
        $this->merge([
            'name' => is_string($this->input('name')) ? trim($this->input('name')) : $this->input('name'),
            'description' => is_string($this->input('description')) ? trim($this->input('description')) : $this->input('description'),
            'location' => is_string($this->input('location')) ? trim($this->input('location')) : $this->input('location'),
        ]);
    }

    public function rules(): array
    {
        return [
            'name' => ['nullable', 'string', 'max:255'],
            'description' => ['nullable', 'string'],
            'location' => ['nullable', 'string', 'max:255'],
            'status' => ['nullable', 'in:draft,active,completed'],
            'team_ids' => ['nullable', 'array'],
            'team_ids.*' => ['exists:teams,id'],
            'ai_suggestions' => ['nullable', 'array'],
            'objective' => ['nullable', 'integer', 'min:0'],
            'menu' => ['nullable', 'string', 'max:255'],
            'meal_breakfast' => ['nullable', 'integer', 'min:0'],
            'meal_lunch' => ['nullable', 'integer', 'min:0'],
            'meal_snacks' => ['nullable', 'integer', 'min:0'],
            'ai_suggestions.*.volunteer_id' => ['required_with:ai_suggestions', 'integer', 'exists:volunteer,volunteer_id'],
            'ai_suggestions.*.volunteer_name' => ['nullable', 'string', 'max:255'],
            'ai_suggestions.*.team_id' => ['required_with:ai_suggestions', 'integer', 'exists:teams,id'],
            'ai_suggestions.*.team_name' => ['nullable', 'string', 'max:255'],
            'ai_suggestions.*.role' => ['nullable', 'string', 'max:255'],
            'ai_suggestions.*.skills' => ['nullable', 'array'],
            'ai_suggestions.*.skills.*' => ['string', 'max:255'],
            'ai_suggestions.*.confidence' => ['nullable', 'numeric', 'min:0', 'max:100'],
        ];
    }
}
