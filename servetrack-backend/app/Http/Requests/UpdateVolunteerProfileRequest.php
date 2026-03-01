<?php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class UpdateVolunteerProfileRequest extends FormRequest
{
    /**
     * Determine if the user is authorized to make this request.
     * Only authenticated volunteers may update their own profile.
     */
    public function authorize(): bool
    {
        return $this->user() !== null;
    }

    /**
     * Get the validation rules that apply to the request.
     *
     * @return array<string, \Illuminate\Contracts\Validation\ValidationRule|array<mixed>|string>
     */
    public function rules(): array
    {
        $volunteer = $this->user()->volunteer;

        return [
            'firstName' => ['required', 'string', 'min:2', 'max:50'],
            'lastName' => ['required', 'string', 'min:2', 'max:50'],
            'facebookName' => ['nullable', 'string', 'max:100'],
            'email' => ['required', 'email', Rule::unique('volunteer', 'email')->ignore($volunteer?->volunteer_id, 'volunteer_id')],
            'mobileNumber' => ['required', 'string', 'min:10', 'max:15'],
            'birthdate' => ['required', 'date', 'before:today'],
            'completeAddress' => ['required', 'string', 'min:10', 'max:255'],
            'lastMedicalExam' => ['required', 'date', 'before_or_equal:today'],
            'educationalAttainment' => ['required', 'string', 'max:100'],
            'trainingExperience' => ['nullable', 'string'],
            'skillsHobbies' => ['nullable', 'string'],
            'classesTraining' => ['nullable', 'string'],
            'volunteerPreference' => ['required', 'string'],
            'otherPreference' => ['nullable', 'string'],
        ];
    }

    /**
     * @return array<string, string>
     */
    public function messages(): array
    {
        return [
            'firstName.required' => 'First name is required.',
            'lastName.required' => 'Last name is required.',
            'email.required' => 'Email address is required.',
            'email.email' => 'Please enter a valid email address.',
            'email.unique' => 'This email is already taken by another volunteer.',
            'mobileNumber.required' => 'Mobile number is required.',
            'birthdate.required' => 'Birthdate is required.',
            'birthdate.before' => 'Birthdate must be in the past.',
            'completeAddress.required' => 'Complete address is required.',
            'lastMedicalExam.required' => 'Last medical exam date is required.',
            'lastMedicalExam.before_or_equal' => 'Last medical exam date cannot be in the future.',
            'educationalAttainment.required' => 'Educational attainment is required.',
            'volunteerPreference.required' => 'Volunteer preference is required.',
        ];
    }
}
