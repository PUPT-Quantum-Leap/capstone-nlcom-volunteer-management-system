<?php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;

class UpdateRsvpRequest extends FormRequest
{
    public function authorize(): bool
    {
        return $this->user() !== null && $this->user()->role === 'admin';
    }

    public function rules(): array
    {
        return [
            'title' => ['sometimes', 'string', 'max:100'],
            'description' => ['nullable', 'string'],
            'date' => ['sometimes', 'date'],
            'event_location' => ['nullable', 'string', 'max:255'],
            'cutoff_day' => ['sometimes', 'date', 'before_or_equal:date'],
            'cutoff_time' => ['sometimes', 'regex:/^([01]?[0-9]|1[0-9]|2[0-3]):[0-5][0-9](:[0-5][0-9])?$/', 'max:20'],
            'status' => ['sometimes', 'in:draft,active,closed'],
            'share_url' => ['nullable', 'string', 'max:500'],
            'shifts' => ['sometimes', 'array', 'min:1'],
            'shifts.*.text' => ['required_with:shifts', 'string', 'max:255'],
            'shifts.*.time_slot' => ['required_with:shifts', 'string', 'max:100'],
            'shifts.*.capacity' => ['required_with:shifts', 'integer', 'min:1'],
        ];
    }

    public function messages(): array
    {
        return [
            'title.max' => 'RSVP title may not exceed 100 characters.',
            'date.date' => 'Event date must be a valid date.',
            'cutoff_day.before_or_equal' => 'Cut-off day must not be after the event date.',
            'status.in' => 'Status must be draft, active, or closed.',
            'shifts.min' => 'At least one shift is required.',
            'shifts.*.text.required_with' => 'Each shift must have text.',
            'shifts.*.time_slot.required_with' => 'Each shift must have a time slot.',
            'shifts.*.capacity.required_with' => 'Each shift must have a capacity.',
            'shifts.*.capacity.min' => 'Each shift capacity must be at least 1.',
        ];
    }
}
