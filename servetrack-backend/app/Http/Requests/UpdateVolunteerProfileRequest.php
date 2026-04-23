<?php

namespace App\Http\Requests;

use Illuminate\Contracts\Validation\ValidationRule;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class UpdateVolunteerProfileRequest extends FormRequest
{
    protected function prepareForValidation(): void
    {
        if ($this->has('email')) {
            $this->merge([
                'email' => strtolower(trim((string) $this->input('email'))),
            ]);
        }
    }

    /**
     * Determine if the user is authorized to make this request.
     * Only authenticated volunteers may update their own profile.
     */
    public function authorize(): bool
    {
        return $this->user()?->volunteer !== null;
    }

    /**
     * Get the validation rules that apply to the request.
     *
     * @return array<string, ValidationRule|array<mixed>|string>
     */
    public function rules(): array
    {
        $volunteer = $this->user()->volunteer;

        return [
            'firstName' => ['required', 'string', 'min:2', 'max:50'],
            'lastName' => ['required', 'string', 'min:2', 'max:50'],
            'facebookName' => ['required', 'string', 'max:100'],
            'email' => ['required', 'email', Rule::unique('volunteer', 'email')->ignore($volunteer?->volunteer_id, 'volunteer_id')],
            'mobileNumber' => ['required', 'string', 'min:10', 'max:15'],
            'birthdate' => ['required', 'date', 'before:today'],
            'completeAddress' => ['required', 'string', 'min:10', 'max:255'],
            'lastMedicalExam' => ['required', 'date', 'before_or_equal:today'],
            'educationalAttainment' => ['required', 'string', 'max:100'],
            'trainingExperience' => ['nullable', 'string'],
            'skillsHobbies' => ['nullable', 'string'],
            'classesTraining' => ['nullable', 'string'],
            'volunteerPreference' => [
                'required',
                'string',
                Rule::in([
                    'sidewalk-sunday-school',
                    'mobile-kitchen',
                    'relief-operations',
                    'safety-emergency',
                    'medical-operations',
                    'psychological-aid',
                    'transportation-logistics',
                    'purchasing',
                    'partnerships',
                    'digital-marketing',
                    'creatives',
                    'healing',
                    'real-estate-sports',
                    'kitchen-related',
                    'wherever-needed',
                    'dont-know',
                    'other',
                ]),
            ],
            'otherPreference' => [
                'nullable',
                'string',
                'max:255',
                'required_if:volunteerPreference,other',
                'prohibited_unless:volunteerPreference,other',
            ],
            'availability' => ['required', 'string'],
            'otherAvailability' => ['nullable', 'string'],
            'partOfLifegroup' => ['required', 'string', 'in:yes,no'],
            'lifegroupLeaderName' => [
                'required_if:partOfLifegroup,yes',
                'string',
                'max:100',
            ],
            'leadingLifegroup' => ['required', 'string', 'in:yes,no'],
            'emergencyContactName' => ['required', 'string', 'max:100'],
            'emergencyContactNumber' => [
                'required',
                'string',
                'min:10',
                'max:15',
            ],
            'emergencyContactRelationship' => [
                'required',
                'string',
                'max:50',
            ],
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
            'facebookName.required' => 'Facebook name is required.',
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
            'volunteerPreference.in' => 'Invalid volunteer preference selected.',
            'otherPreference.required_if' => 'Please specify your other preference.',
            'otherPreference.prohibited_unless' => 'Other preference is only allowed when volunteer preference is "other".',
            'otherPreference.max' => 'Other preference cannot exceed 255 characters.',
            'availability.required' => 'Availability is required.',
            'partOfLifegroup.required' => 'Lifegroup participation is required.',
            'partOfLifegroup.in' => 'Please select yes or no for lifegroup.',
            'lifegroupLeaderName.required_if' => 'Lifegroup leader name is required when you are part of a lifegroup.',
            'leadingLifegroup.required' => 'Lifegroup leadership information is required.',
            'leadingLifegroup.in' => 'Please select yes or no for lifegroup leadership.',
            'emergencyContactName.required' => 'Emergency contact name is required.',
            'emergencyContactNumber.required' => 'Emergency contact number is required.',
            'emergencyContactRelationship.required' => 'Emergency contact relationship is required.',
        ];
    }
}
