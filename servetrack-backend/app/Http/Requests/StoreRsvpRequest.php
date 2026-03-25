<?php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;

class StoreRsvpRequest extends FormRequest
{
    public function authorize(): bool
    {
        return $this->user() !== null && $this->user()->role === 'admin';
    }

    public function rules(): array
    {
        return [
            'title' => ['required', 'string', 'max:100', 'min:3'],
            'description' => ['required', 'string', 'min:10'],
            'date' => ['required', 'date', 'after_or_equal:today'],
            'event_location' => ['nullable', 'string', 'max:255'],
            'cutoff_day' => ['required', 'date', 'before_or_equal:date'],
            'cutoff_time' => ['required', 'regex:/^([01]?[0-9]|1[0-9]|2[0-3]):[0-5][0-9](:[0-5][0-9])?$/', 'max:20'],
            'status' => ['sometimes', 'in:draft,active,closed'],
            'share_url' => ['nullable', 'string', 'max:500'],
            'shifts' => ['required', 'array', 'min:1'],
            'shifts.*.text' => ['required', 'string', 'max:255'],
            'shifts.*.time_slot' => ['required', 'string', 'max:100'],
            'shifts.*.capacity' => ['required', 'integer', 'min:1', 'max:2147483647'],
        ];
    }

    public function messages(): array
    {
        return [
            'title.required' => 'RSVP title is required.',
            'title.max' => 'RSVP title may not exceed 100 characters.',
            'date.required' => 'Event date is required.',
            'date.date' => 'Event date must be a valid date.',
            'cutoff_day.required' => 'Cut-off day is required.',
            'cutoff_day.before_or_equal' => 'Cut-off day must not be after the event date.',
            'cutoff_time.required' => 'Cut-off time is required.',
            'status.in' => 'Status must be draft, active, or closed.',
            'shifts.required' => 'At least one shift is required.',
            'shifts.min' => 'At least one shift is required.',
            'shifts.*.text.required' => 'Each shift must have text.',
            'shifts.*.time_slot.required' => 'Each shift must have a time slot.',
            'shifts.*.capacity.required' => 'Each shift must have a capacity.',
            'shifts.*.capacity.min' => 'Each shift capacity must be at least 1.',
        ];
    }
}
