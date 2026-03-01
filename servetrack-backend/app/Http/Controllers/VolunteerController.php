<?php

namespace App\Http\Controllers;

use App\Models\Experience;
use App\Models\Position;
use App\Models\Skill;
use App\Models\Training;
use App\Models\User;
use App\Models\Volunteer;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Validator;

class VolunteerController extends Controller
{
    /**
     * Register a new volunteer with all related data
     */
    public function register(Request $request): JsonResponse
    {
        // Validate incoming data
        $validator = Validator::make($request->all(), [
            // Personal Information
            'firstName' => 'required|string|min:2|max:50',
            'lastName' => 'required|string|min:2|max:50',
            'facebookName' => 'nullable|string|max:100',
            'email' => 'required|email|unique:volunteer,email',
            'mobileNumber' => 'required|string|min:10|max:15',
            'birthdate' => 'required|date|before:today',
            'completeAddress' => 'required|string|min:10|max:255',
            'lastMedicalExam' => 'required|date|before_or_equal:today',

            // Education & Experience
            'educationalAttainment' => 'required|string|max:100',
            'trainingExperience' => 'nullable|string',
            'skillsHobbies' => 'nullable|string',
            'classesTraining' => 'nullable|string',

            // Preferences
            'volunteerPreference' => 'required|string',
            'otherPreference' => 'nullable|string',

            // Password (for authentication)
            'password' => 'required|string|min:8',
            'confirmPassword' => 'required|string|same:password',
        ]);

        if ($validator->fails()) {
            return response()->json([
                'success' => false,
                'message' => 'Validation failed',
                'errors' => $validator->errors(),
            ], 422);
        }

        // Use database transaction for data integrity
        DB::beginTransaction();
        try {
            // Create user account first
            $user = User::create([
                'name' => $request->firstName . ' ' . $request->lastName,
                'email' => $request->email,
                'password' => bcrypt($request->password),
            ]);

            // Create volunteer profile linked to user
            $volunteer = Volunteer::create([
                'first_name' => $request->firstName,
                'last_name' => $request->lastName,
                'facebook_name' => $request->facebookName ?? null,
                'email' => $request->email,
                'mobile_number' => $request->mobileNumber,
                'birthdate' => $request->birthdate,
                'address' => $request->completeAddress,
                'educational_attainment' => $request->educationalAttainment,
                'last_medical_examination' => $request->lastMedicalExam,
                'user_id' => $user->id,
            ]);

            // Process and attach training experience
            $this->processTrainingExperience($volunteer, $request->trainingExperience);

            // Process and attach skills/hobbies
            $this->processSkillsHobbies($volunteer, $request->skillsHobbies);

            // Process and attach classes/training
            $this->processClassesTraining($volunteer, $request->classesTraining);

            // Process volunteer preference and attach to position
            $this->processVolunteerPreference($volunteer, $request->volunteerPreference, $request->otherPreference);

            DB::commit();

            return response()->json([
                'success' => true,
                'message' => 'Volunteer registered successfully',
                'data' => [
                    'user' => $user,
                    'volunteer' => $volunteer->load(['experiences', 'skills', 'trainings', 'positions', 'user']),
                ],
            ], 201);

        } catch (\Exception $e) {
            DB::rollBack();

            return response()->json([
                'success' => false,
                'message' => 'Registration failed: '.$e->getMessage(),
            ], 500);
        }
    }

    /**
     * Process training experience text and create/find training records
     */
    private function processTrainingExperience(Volunteer $volunteer, ?string $trainingExperience): void
    {
        if (empty($trainingExperience)) {
            return;
        }

        // Split by common delimiters (commas, semicolons, new lines)
        $trainingItems = preg_split('/[,;\n]+/', $trainingExperience);
        $trainingItems = array_map('trim', $trainingItems);
        $trainingItems = array_filter($trainingItems, 'strlen');

        foreach ($trainingItems as $trainingName) {
            if (strlen($trainingName) > 0) {
                $training = Training::firstOrCreate(['name' => $trainingName]);
                $volunteer->trainings()->attach($training->training_id);
            }
        }
    }

    /**
     * Process skills/hobbies text and create/find skill records
     */
    private function processSkillsHobbies(Volunteer $volunteer, ?string $skillsHobbies): void
    {
        if (empty($skillsHobbies)) {
            return;
        }

        // Split by common delimiters
        $skillItems = preg_split('/[,;\n]+/', $skillsHobbies);
        $skillItems = array_map('trim', $skillItems);
        $skillItems = array_filter($skillItems, 'strlen');

        foreach ($skillItems as $skillName) {
            if (strlen($skillName) > 0) {
                $skill = Skill::firstOrCreate(['name' => $skillName]);
                $volunteer->skills()->attach($skill->skill_id);
            }
        }
    }

    /**
     * Process classes/training text and create/find training records
     */
    private function processClassesTraining(Volunteer $volunteer, ?string $classesTraining): void
    {
        if (empty($classesTraining)) {
            return;
        }

        // Split by common delimiters
        $classItems = preg_split('/[,;\n]+/', $classesTraining);
        $classItems = array_map('trim', $classItems);
        $classItems = array_filter($classItems, 'strlen');

        foreach ($classItems as $className) {
            if (strlen($className) > 0) {
                $training = Training::firstOrCreate(['name' => $className]);
                $volunteer->trainings()->attach($training->training_id);
            }
        }
    }

    /**
     * Process volunteer preference and create/find position record
     */
    private function processVolunteerPreference(Volunteer $volunteer, string $preference, ?string $otherPreference): void
    {
        $positionName = $preference;

        // Map preference values to readable position names
        $preferenceMap = [
            'sidewalk-sunday-school' => 'Metro Sidewalk Sunday School (Teaching & Education)',
            'mobile-kitchen' => 'Mobile Kitchen Operations',
            'relief-operations' => 'Relief Operations',
            'safety-emergency' => 'Safety and Emergency Response',
            'medical-operations' => 'Medical Operations',
            'psychological-aid' => 'Psychological First Aid',
            'transportation-logistics' => 'Transportation & Logistics Team',
            'purchasing' => 'Purchasing Team',
            'partnerships' => 'Individual & Corporate Partnerships',
            'digital-marketing' => 'Digital Marketing & Promotions',
            'creatives' => 'Creatives (Video / Photos)',
            'healing' => 'Healing',
            'real-estate-sports' => 'Real Estate & Sports',
            'kitchen-related' => 'Anything kitchen-related',
            'wherever-needed' => 'Wherever is needed',
            'dont-know' => 'Don\'t know yet',
        ];

        if ($preference === 'other' && ! empty($otherPreference)) {
            $positionName = $otherPreference;
        } elseif (isset($preferenceMap[$preference])) {
            $positionName = $preferenceMap[$preference];
        }

        $position = Position::firstOrCreate(['name' => $positionName]);
        $volunteer->positions()->attach($position->position_id);
    }

    /**
     * Get all volunteers with their relationships
     */
    public function index(): JsonResponse
    {
        $volunteers = Volunteer::with([
            'experiences',
            'skills',
            'trainings',
            'positions',
            'availabilities',
            'lifegroups',
        ])->get();

        return response()->json([
            'success' => true,
            'data' => $volunteers,
        ]);
    }

    /**
     * Get a specific volunteer with their relationships
     */
    public function show(int $id): JsonResponse
    {
        $volunteer = Volunteer::with([
            'experiences',
            'skills',
            'trainings',
            'positions',
            'availabilities',
            'lifegroups',
        ])->find($id);

        if (! $volunteer) {
            return response()->json([
                'success' => false,
                'message' => 'Volunteer not found',
            ], 404);
        }

        return response()->json([
            'success' => true,
            'data' => $volunteer,
        ]);
    }
}
