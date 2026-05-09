<?php

namespace App\Http\Requests;

use Illuminate\Contracts\Validation\ValidationRule;
use Illuminate\Foundation\Http\FormRequest;

class UpdateBackupScheduleRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    /**
     * @return array<string, ValidationRule|array<mixed>|string>
     */
    public function rules(): array
    {
        return [
            'enabled' => ['required', 'boolean'],
            'frequency' => ['required', 'in:daily,weekly,monthly'],
        ];
    }

    /**
     * Get custom error messages for validation rules.
     */
    public function messages(): array
    {
        return [
            'enabled.required' => 'The schedule enabled status is required.',
            'enabled.boolean' => 'The schedule enabled status must be true or false.',
            'frequency.required' => 'The backup frequency is required.',
            'frequency.in' => 'The backup frequency must be one of: daily, weekly, or monthly.',
        ];
    }
}
