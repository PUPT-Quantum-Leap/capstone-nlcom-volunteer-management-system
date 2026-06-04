<?php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;

class UpdateIcsTeamRequest extends FormRequest
{
    public function authorize(): bool
    {
        return $this->user()?->role === 'admin';
    }

    public function rules(): array
    {
        return [
            'team' => ['sometimes', 'required', 'string'],
            'departure_note' => ['nullable', 'string'],
            'location' => ['nullable', 'string'],
            'time' => ['nullable', 'string'],
            'no_of_pax' => ['nullable', 'integer'],
            'details' => ['nullable', 'string'],
        ];
    }
}
