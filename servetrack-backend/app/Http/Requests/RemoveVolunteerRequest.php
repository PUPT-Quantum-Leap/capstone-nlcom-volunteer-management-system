<?php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;

class RemoveVolunteerRequest extends FormRequest
{
    public function authorize(): bool
    {
        return $this->user()?->role === 'admin';
    }

    public function rules(): array
    {
        return [
            'volunteer_id' => ['required', 'exists:volunteer,volunteer_id'],
        ];
    }

    public function messages(): array
    {
        return [
            'volunteer_id.required' => 'Volunteer ID is required.',
            'volunteer_id.exists' => 'The specified volunteer does not exist.',
        ];
    }
}
