<?php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;

class UpdatePollRequest extends FormRequest
{
    /**
     * Determine if the user is authorized to make this request.
     */
    public function authorize(): bool
    {
        return $this->user() !== null && $this->user()->role === 'admin';
    }

    /**
     * Get the validation rules that apply to the request.
     *
     * @return array<string, \Illuminate\Contracts\Validation\ValidationRule|array<mixed>|string>
     */
    public function rules(): array
    {
        return [
            'title' => ['sometimes', 'string', 'max:100'],
            'description' => ['nullable', 'string'],
            'date' => ['sometimes', 'date'],
            'cutoff_day' => ['sometimes', 'string', 'max:20'],
            'cutoff_time' => ['sometimes', 'regex:/^([01]?[0-9]|1[0-9]|2[0-3]):[0-5][0-9](:[0-5][0-9])?$/', 'max:20'],
            'status' => ['sometimes', 'in:draft,active,closed'],
            'share_url' => ['nullable', 'string', 'max:500'],
            'options' => ['sometimes', 'array', 'min:1'],
            'options.*.text' => ['required_with:options', 'string', 'max:255'],
            'options.*.time_slot' => ['required_with:options', 'string', 'max:100'],
            'options.*.capacity' => ['required_with:options', 'integer', 'min:1'],
        ];
    }

    /**
     * @return array<string, string>
     */
    public function messages(): array
    {
        return [
            'title.max' => 'Poll title may not exceed 100 characters.',
            'date.date' => 'Poll date must be a valid date.',
            'status.in' => 'Status must be draft, active, or closed.',
            'options.min' => 'At least one option is required.',
            'options.*.text.required_with' => 'Each option must have text.',
            'options.*.time_slot.required_with' => 'Each option must have a time slot.',
            'options.*.capacity.required_with' => 'Each option must have a capacity.',
            'options.*.capacity.min' => 'Each option capacity must be at least 1.',
        ];
    }
}
