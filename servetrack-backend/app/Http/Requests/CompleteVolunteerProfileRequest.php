<?php

namespace App\Http\Requests;

use Illuminate\Contracts\Validation\ValidationRule;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class CompleteVolunteerProfileRequest extends FormRequest
{
    protected function prepareForValidation(): void
    {
        $clean = [];
        if ($this->has('mobileNumber')) {
            $clean['mobileNumber'] = preg_replace('/[\s\-()]/', '', (string) $this->input('mobileNumber'));
        }
        if ($this->has('emergencyContactNumber')) {
            $clean['emergencyContactNumber'] = preg_replace('/[\s\-()]/', '', (string) $this->input('emergencyContactNumber'));
        }
        if ($clean) {
            $this->merge($clean);
        }
    }

    /**
     * Only authenticated volunteers without an existing profile may call this.
     */
    public function authorize(): bool
    {
        $user = $this->user();

        return $user !== null
            && $user->role === 'volunteer'
            && $user->volunteer === null;
    }

    /**
     * @return array<string, ValidationRule|array<mixed>|string>
     */
    public function rules(): array
    {
        return [
            'firstName' => ['required', 'string', 'min:2', 'max:50'],
            'lastName' => ['required', 'string', 'min:2', 'max:50'],
            'mobileNumber' => ['required', 'string', 'min:10', 'max:15'],
            'birthdate' => ['required', 'date', 'before:today'],
            'completeAddress' => ['required', 'string', 'min:10', 'max:255'],
            'lastMedicalExam' => ['required', 'date', 'before_or_equal:today'],
            'gender' => ['nullable', 'string', 'in:boy,girl,male,female'],
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
                    'Metro Sidewalk Sunday School (Teaching & Education)',
                    'Mobile Kitchen Operations',
                    'Relief Operations',
                    'Safety and Emergency Response',
                    'Medical Operations',
                    'Psychological First Aid',
                    'Transportation & Logistics Team',
                    'Purchasing Team',
                    'Individual & Corporate Partnerships',
                    'Digital Marketing & Promotions',
                    'Creatives (Video / Photos)',
                    'Healing',
                    'Real Estate & Sports',
                    'Anything kitchen-related',
                    'Wherever is needed',
                    "Don't know yet",
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
            'otherAvailability' => ['nullable', 'string', 'max:100'],
            'partOfLifegroup' => ['required', 'string', 'in:yes,no'],
            'lifegroupLeaderName' => ['nullable', 'required_if:partOfLifegroup,yes', 'string', 'max:100'],
            'leadingLifegroup' => ['required', 'string', 'in:yes,no'],
            'emergencyContactName' => ['required', 'string', 'max:100'],
            'emergencyContactNumber' => ['required', 'string', 'min:10', 'max:15'],
            'emergencyContactRelationship' => ['required', 'string', 'max:50'],
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
