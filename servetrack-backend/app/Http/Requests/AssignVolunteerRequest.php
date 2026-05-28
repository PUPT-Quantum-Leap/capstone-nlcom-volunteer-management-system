<?php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;

class AssignVolunteerRequest extends FormRequest
{
    public function authorize(): bool
    {
        return $this->user()?->role === 'admin';
    }

    protected function prepareForValidation(): void
    {
        $this->merge([
            'role' => is_string($this->input('role')) ? trim($this->input('role')) : $this->input('role'),
        ]);
    }

    public function rules(): array
    {
        return [
            'volunteer_id' => ['required', 'exists:volunteer,volunteer_id'],
            'team_id' => ['required', 'exists:teams,id'],
            'role' => ['nullable', 'string', 'max:255'],
            'is_driver' => ['nullable', 'boolean'],
            'is_leader' => ['nullable', 'boolean'],
        ];
    }

    public function messages(): array
    {
        return [
            'volunteer_id.required' => 'Volunteer ID is required.',
            'volunteer_id.exists' => 'The specified volunteer does not exist.',
            'team_id.exists' => 'The specified team does not exist.',
            'role.string' => 'Role must be a string.',
            'role.max' => 'Role must not exceed 255 characters.',
        ];
    }
}
