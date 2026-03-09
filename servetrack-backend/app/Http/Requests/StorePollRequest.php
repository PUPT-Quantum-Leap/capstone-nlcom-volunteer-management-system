<?php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;

class StorePollRequest extends FormRequest
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
            'title' => ['required', 'string', 'max:100'],
            'description' => ['nullable', 'string'],
            'date' => ['required', 'date'],
            'cutoff_day' => ['required', 'string', 'max:20'],
            'cutoff_time' => ['required', 'string', 'max:20'],
            'status' => ['sometimes', 'in:draft,active,closed'],
            'share_url' => ['nullable', 'string', 'max:500'],
            'options' => ['required', 'array', 'min:1'],
            'options.*.text' => ['required', 'string', 'max:255'],
            'options.*.time_slot' => ['required', 'string', 'max:100'],
            'options.*.capacity' => ['required', 'integer', 'min:1'],
        ];
    }

    /**
     * @return array<string, string>
     */
    public function messages(): array
    {
        return [
            'title.required' => 'Poll title is required.',
            'title.max' => 'Poll title may not exceed 100 characters.',
            'date.required' => 'Poll date is required.',
            'date.date' => 'Poll date must be a valid date.',
            'cutoff_day.required' => 'Cut-off day is required.',
            'cutoff_time.required' => 'Cut-off time is required.',
            'status.in' => 'Status must be draft, active, or closed.',
            'options.required' => 'At least one option is required.',
            'options.min' => 'At least one option is required.',
            'options.*.text.required' => 'Each option must have text.',
            'options.*.time_slot.required' => 'Each option must have a time slot.',
            'options.*.capacity.required' => 'Each option must have a capacity.',
            'options.*.capacity.min' => 'Each option capacity must be at least 1.',
        ];
    }
}
