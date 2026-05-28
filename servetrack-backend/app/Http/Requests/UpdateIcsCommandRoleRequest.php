<?php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;

class UpdateIcsCommandRoleRequest extends FormRequest
{
    public function authorize(): bool
    {
        return $this->user()?->role === 'admin';
    }

    protected function prepareForValidation(): void
    {
        $this->merge([
            'assigned_name' => is_string($this->input('assigned_name')) ? trim($this->input('assigned_name')) : $this->input('assigned_name'),
        ]);
    }

    public function rules(): array
    {
        return [
            'assigned_name' => ['nullable', 'string', 'max:255'],
            'volunteer_id' => ['nullable', 'integer', 'exists:volunteer,volunteer_id'],
        ];
    }
}
