<?php

namespace App\Http\Controllers;

use App\Http\Requests\ChangePasswordRequest;
use App\Http\Requests\UpdateProfilePhotoRequest;
use App\Http\Requests\UpdateVolunteerProfileRequest;
use App\Http\Resources\ProfileChangeLogResource;
use App\Http\Resources\VolunteerProfileResource;
use App\Models\Position;
use App\Models\ProfileChangeLog;
use App\Models\Skill;
use App\Models\Training;
use App\Models\User;
use App\Models\Volunteer;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Facades\Validator;
use Illuminate\Validation\Rules\Password;

class VolunteerController extends Controller
{
    /**
     * Register a new volunteer with all related data
     */
    public function register(Request $request): JsonResponse
    {
        // Clean phone numbers before validation
        if ($request->has('mobileNumber')) {
            $request->merge([
                'mobileNumber' => preg_replace('/[\s\-()]/', '', $request->mobileNumber),
            ]);
        }
        if ($request->has('emergencyContactNumber')) {
            $request->merge([
                'emergencyContactNumber' => preg_replace('/[\s\-()]/', '', $request->emergencyContactNumber),
            ]);
        }
        if ($request->has('email')) {
            $request->merge([
                'email' => strtolower(trim((string) $request->email)),
            ]);
        }

        // Validate incoming data
        $validator = Validator::make($request->all(), [
            // Personal Information
            'firstName' => 'required|string|min:2|max:50',
            'lastName' => 'required|string|min:2|max:50',
            'facebookName' => 'required|string|max:100',
            'email' => 'required|email|unique:volunteer,email|unique:users,email',
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
            'availability' => 'required|string',
            'otherAvailability' => 'nullable|string',
            'partOfLifegroup' => 'required|string|in:yes,no',
            'lifegroupLeaderName' => 'nullable|required_if:partOfLifegroup,yes|string|max:100',
            'leadingLifegroup' => 'required|string|in:yes,no',

            // Emergency Contact
            'emergencyContactName' => 'required|string|max:100',
            'emergencyContactNumber' => 'required|string|min:10|max:15',
            'emergencyContactRelationship' => 'required|string|max:50',

            // Password (for authentication)
            'password' => ['required', 'string', Password::defaults()],
            'confirmPassword' => ['required', 'string', 'same:password'],
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
                'name' => $request->firstName.' '.$request->lastName,
                'email' => $request->email,
                'password' => bcrypt($request->password),
                'role' => 'volunteer',
            ]);

            // Create volunteer profile linked to user
            $volunteer = Volunteer::create([
                'first_name' => $request->firstName,
                'last_name' => $request->lastName,
                'facebook_name' => $request->facebookName ?? '',
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

            // Process emergency contact
            $this->processEmergencyContact($volunteer, $request->emergencyContactName, $request->emergencyContactNumber, $request->emergencyContactRelationship);

            // Process availability
            $this->processAvailability($volunteer, $request->availability, $request->otherAvailability);

            // Process lifegroup information
            $this->processLifegroupInfo($volunteer, $request->partOfLifegroup, $request->lifegroupLeaderName, $request->leadingLifegroup);

            // Log the user in
            Auth::login($user);

            DB::commit();

            // Create Sanctum token and cookie for immediate authentication
            $token = $user->createToken('auth-token', ['*'], now()->addMinutes(config('sanctum.expiration', 60)))->plainTextToken;
            $cookie = cookie(
                'auth_token',
                $token,
                config('sanctum.expiration', 60),
                '/',
                null,
                true,
                true,
                false,
                'strict'
            );

            return response()->json([
                'success' => true,
                'message' => 'Volunteer registered successfully',
                'user' => [
                    'id' => $user->id,
                    'name' => $user->name,
                    'email' => $user->email,
                    'role' => $user->role,
                    'volunteer_profile' => $volunteer->load(['experiences', 'skills', 'trainings', 'positions', 'availabilities', 'lifegroups', 'emergencyContact']),
                ],
            ], 201)->withCookie($cookie);

        } catch (\Exception $e) {
            DB::rollBack();

            return response()->json([
                'success' => false,
                'message' => 'Registration failed: '.$e->getMessage(),
            ], 500);
        }
    }

    /**
     * Get the authenticated volunteer's profile.
     */
    public function profile(Request $request): JsonResponse
    {
        if ($request->user()->role !== 'volunteer') {
            return response()->json([
                'success' => false,
                'message' => 'Forbidden. Volunteer access only.',
            ], 403);
        }

        $volunteer = $request->user()->volunteer;

        if (! $volunteer) {
            return response()->json([
                'success' => false,
                'message' => 'Volunteer profile not found.',
            ], 404);
        }

        // Load relationships
        $volunteer->load(['experiences', 'skills', 'trainings', 'positions', 'availabilities', 'lifegroups', 'emergencyContact']);

        // Get text fields from related tables
        $trainingExperience = $volunteer->trainings->pluck('name')->implode(', ');
        $skillsHobbies = $volunteer->skills->pluck('name')->implode(', ');
        $classesTraining = $volunteer->trainings->pluck('name')->implode(', ');

        return response()->json([
            'success' => true,
            'data' => [
                'volunteer_id' => $volunteer->volunteer_id,
                'first_name' => $volunteer->first_name,
                'last_name' => $volunteer->last_name,
                'facebook_name' => $volunteer->facebook_name,
                'email' => $volunteer->email,
                'mobile_number' => $volunteer->mobile_number,
                'birthdate' => $volunteer->birthdate,
                'address' => $volunteer->address,
                'educational_attainment' => $volunteer->educational_attainment,
                'last_medical_examination' => $volunteer->last_medical_examination,
                'training_experience' => $trainingExperience,
                'skills_hobbies' => $skillsHobbies,
                'classes_training' => $classesTraining,
                'positions' => $volunteer->positions,
                'experiences' => $volunteer->experiences,
                'skills' => $volunteer->skills,
                'trainings' => $volunteer->trainings,
                'availabilities' => $volunteer->availabilities,
                'lifegroups' => $volunteer->lifegroups,
                'emergency_contact' => $volunteer->emergencyContact,
            ],
        ]);
    }

    /**
     * Update the authenticated volunteer's profile.
     * Creates a new volunteer profile if one doesn't exist.
     */
    public function updateProfile(UpdateVolunteerProfileRequest $request): JsonResponse
    {
        $user = $request->user();
        $volunteer = $user->volunteer;

        // If no volunteer profile exists, create one
        if (! $volunteer) {
            DB::beginTransaction();
            try {
                // Create volunteer profile linked to user
                $volunteer = Volunteer::create([
                    'first_name' => $request->firstName,
                    'last_name' => $request->lastName,
                    'facebook_name' => $request->facebookName ?? '',
                    'email' => $request->email,
                    'mobile_number' => $request->mobileNumber,
                    'birthdate' => $request->birthdate,
                    'address' => $request->completeAddress,
                    'educational_attainment' => $request->educationalAttainment,
                    'last_medical_examination' => $request->lastMedicalExam,
                    'user_id' => $user->id,
                ]);

                // Update user info
                $user->name = $request->firstName.' '.$request->lastName;
                $user->email = $request->email;
                $user->save();

                // Process skills, training, and positions
                if ($request->skillsHobbies) {
                    $this->processSkillsHobbies($volunteer, $request->skillsHobbies);
                }
                if ($request->trainingExperience) {
                    $this->processTrainingExperience($volunteer, $request->trainingExperience);
                }
                if ($request->classesTraining) {
                    $this->processClassesTraining($volunteer, $request->classesTraining);
                }
                $this->processVolunteerPreference($volunteer, $request->volunteerPreference, $request->otherPreference);
                $this->processEmergencyContact($volunteer, $request->emergencyContactName, $request->emergencyContactNumber, $request->emergencyContactRelationship);
                $this->processAvailability($volunteer, $request->availability, $request->otherAvailability);
                $this->processLifegroupInfo($volunteer, $request->partOfLifegroup, $request->lifegroupLeaderName, $request->leadingLifegroup);

                DB::commit();

                // Reload with relationships
                $volunteer = $volunteer->fresh(['experiences', 'skills', 'trainings', 'positions', 'availabilities', 'lifegroups', 'emergencyContact']);

                return response()->json([
                    'success' => true,
                    'message' => 'Profile created successfully.',
                    'data' => [
                        'volunteer_id' => $volunteer->volunteer_id,
                        'first_name' => $volunteer->first_name,
                        'last_name' => $volunteer->last_name,
                        'facebook_name' => $volunteer->facebook_name,
                        'email' => $volunteer->email,
                        'mobile_number' => $volunteer->mobile_number,
                        'birthdate' => $volunteer->birthdate,
                        'address' => $volunteer->address,
                        'educational_attainment' => $volunteer->educational_attainment,
                        'last_medical_examination' => $volunteer->last_medical_examination,
                        'training_experience' => '',
                        'skills_hobbies' => '',
                        'classes_training' => '',
                        'positions' => $volunteer->positions,
                        'experiences' => $volunteer->experiences,
                        'skills' => $volunteer->skills,
                        'trainings' => $volunteer->trainings,
                        'availabilities' => $volunteer->availabilities,
                        'lifegroups' => $volunteer->lifegroups,
                        'emergency_contact' => $volunteer->emergencyContact,
                    ],
                ]);

            } catch (\Exception $e) {
                DB::rollBack();

                return response()->json([
                    'success' => false,
                    'message' => 'Failed to create profile. Please try again.',
                    'errors' => ['server' => $e->getMessage()],
                ], 500);
            }
        }

        // Volunteer profile exists, update it
        DB::beginTransaction();
        try {
            // Update volunteer basic info
            $volunteer->first_name = $request->firstName;
            $volunteer->last_name = $request->lastName;
            $volunteer->facebook_name = $request->facebookName ?? '';
            $volunteer->email = $request->email;
            $volunteer->mobile_number = $request->mobileNumber;
            $volunteer->birthdate = $request->birthdate;
            $volunteer->address = $request->completeAddress;
            $volunteer->educational_attainment = $request->educationalAttainment;
            $volunteer->last_medical_examination = $request->lastMedicalExam;
            $volunteer->save();

            // Also update the linked user's name and email
            $user->name = $request->firstName.' '.$request->lastName;
            $user->email = $request->email;
            $user->save();

            // Sync skills (detach all, re-attach from new input)
            $volunteer->skills()->detach();
            if ($request->skillsHobbies) {
                $this->processSkillsHobbies($volunteer, $request->skillsHobbies);
            }

            // Sync trainings - detach first to avoid duplicates
            $volunteer->trainings()->detach();
            if ($request->trainingExperience) {
                $this->processTrainingExperience($volunteer, $request->trainingExperience);
            }
            if ($request->classesTraining) {
                $this->processClassesTraining($volunteer, $request->classesTraining);
            }

            // Sync position preference
            $volunteer->positions()->detach();
            $this->processVolunteerPreference($volunteer, $request->volunteerPreference, $request->otherPreference);

            // Sync emergency contact
            $this->processEmergencyContact($volunteer, $request->emergencyContactName, $request->emergencyContactNumber, $request->emergencyContactRelationship);

            // Sync availability
            $volunteer->availabilities()->detach();
            $this->processAvailability($volunteer, $request->availability, $request->otherAvailability);

            // Sync lifegroup info
            $volunteer->lifegroups()->detach();
            $this->processLifegroupInfo($volunteer, $request->partOfLifegroup, $request->lifegroupLeaderName, $request->leadingLifegroup);

            DB::commit();

            // Reload the updated volunteer with relationships
            $volunteer = $volunteer->fresh(['experiences', 'skills', 'trainings', 'positions', 'availabilities', 'lifegroups', 'emergencyContact']);

            // Get text fields from related tables
            $trainingExperience = $volunteer->trainings->pluck('name')->implode(', ');
            $skillsHobbies = $volunteer->skills->pluck('name')->implode(', ');
            $classesTraining = $volunteer->trainings->pluck('name')->implode(', ');

            return response()->json([
                'success' => true,
                'message' => 'Profile updated successfully.',
                'data' => [
                    'volunteer_id' => $volunteer->volunteer_id,
                    'first_name' => $volunteer->first_name,
                    'last_name' => $volunteer->last_name,
                    'facebook_name' => $volunteer->facebook_name,
                    'email' => $volunteer->email,
                    'mobile_number' => $volunteer->mobile_number,
                    'birthdate' => $volunteer->birthdate,
                    'address' => $volunteer->address,
                    'educational_attainment' => $volunteer->educational_attainment,
                    'last_medical_examination' => $volunteer->last_medical_examination,
                    'training_experience' => $trainingExperience,
                    'skills_hobbies' => $skillsHobbies,
                    'classes_training' => $classesTraining,
                    'positions' => $volunteer->positions,
                    'experiences' => $volunteer->experiences,
                    'skills' => $volunteer->skills,
                    'trainings' => $volunteer->trainings,
                    'availabilities' => $volunteer->availabilities,
                    'lifegroups' => $volunteer->lifegroups,
                    'emergency_contact' => $volunteer->emergencyContact,
                ],
            ]);

        } catch (\Exception $e) {
            DB::rollBack();

            return response()->json([
                'success' => false,
                'message' => 'Failed to update profile. Please try again.',
                'errors' => ['server' => $e->getMessage()],
            ], 500);
        }
    }

    /**
     * Change the authenticated volunteer's password.
     */
    public function changePassword(ChangePasswordRequest $request): JsonResponse
    {
        $user = $request->user();

        if (! Hash::check($request->currentPassword, $user->password)) {
            return response()->json([
                'success' => false,
                'message' => 'Current password is incorrect.',
            ], 422);
        }

        $user->update([
            'password' => Hash::make($request->newPassword),
        ]);

        return response()->json([
            'success' => true,
            'message' => 'Password changed successfully.',
        ]);
    }

    /**
     * Update the authenticated volunteer's profile photo.
     */
    public function updateProfilePhoto(UpdateProfilePhotoRequest $request): JsonResponse
    {
        $volunteer = $request->user()->volunteer;

        if (! $volunteer) {
            return response()->json([
                'success' => false,
                'message' => 'Volunteer profile not found.',
            ], 404);
        }

        // Delete old photo if exists
        if ($volunteer->profile_photo) {
            Storage::disk('public')->delete($volunteer->profile_photo);
        }

        $path = $request->file('photo')->store('profile-photos', 'public');

        $volunteer->update(['profile_photo' => $path]);

        return response()->json([
            'success' => true,
            'message' => 'Profile photo updated successfully.',
            'data' => [
                'profile_photo_url' => Storage::disk('public')->url($path),
            ],
        ]);
    }

    /**
     * List attendance records for the authenticated volunteer.
     * Supports ?period=daily|weekly|monthly and ?search= filters.
     */
    public function listAttendance(Request $request): JsonResponse
    {
        if ($request->user()->role !== 'volunteer') {
            return response()->json([
                'success' => false,
                'message' => 'Forbidden. Volunteer access only.',
            ], 403);
        }

        $volunteer = $request->user()->volunteer;

        if (! $volunteer) {
            return response()->json(['success' => false, 'message' => 'Volunteer profile not found.'], 404);
        }

        $query = $volunteer->attendances()->orderBy('date', 'desc');

        // Period filter
        $period = $request->query('period');
        if ($period === 'daily') {
            $query->whereDate('date', today());
        } elseif ($period === 'weekly') {
            $query->whereBetween('date', [now()->startOfWeek(), now()->endOfWeek()]);
        } elseif ($period === 'monthly') {
            $query->whereMonth('date', now()->month)->whereYear('date', now()->year);
        }

        // Search filter on description
        $search = $request->query('search');
        if ($search) {
            $query->where('description', 'like', '%'.$search.'%');
        }

        return response()->json([
            'success' => true,
            'data' => $query->get(),
        ]);
    }

    /**
     * Get attendance statistics (total hours, counts) for the authenticated volunteer.
     */
    public function attendanceStats(Request $request): JsonResponse
    {
        if ($request->user()->role !== 'volunteer') {
            return response()->json([
                'success' => false,
                'message' => 'Forbidden. Volunteer access only.',
            ], 403);
        }

        $volunteer = $request->user()->volunteer;

        if (! $volunteer) {
            return response()->json(['success' => false, 'message' => 'Volunteer profile not found.'], 404);
        }

        $base = $volunteer->attendances()->where('status', 'approved');

        $stats = [
            'total_hours' => (float) $base->sum('hours'),
            'total_entries' => $base->count(),
            'daily' => [
                'hours' => (float) (clone $base)->whereDate('date', today())->sum('hours'),
                'entries' => (clone $base)->whereDate('date', today())->count(),
            ],
            'weekly' => [
                'hours' => (float) (clone $base)->whereBetween('date', [now()->startOfWeek(), now()->endOfWeek()])->sum('hours'),
                'entries' => (clone $base)->whereBetween('date', [now()->startOfWeek(), now()->endOfWeek()])->count(),
            ],
            'monthly' => [
                'hours' => (float) (clone $base)->whereMonth('date', now()->month)->whereYear('date', now()->year)->sum('hours'),
                'entries' => (clone $base)->whereMonth('date', now()->month)->whereYear('date', now()->year)->count(),
            ],
        ];

        return response()->json([
            'success' => true,
            'data' => $stats,
        ]);
    }

    /**
     * Get all volunteers with search, filter, sort, and pagination.
     */
    public function index(Request $request): JsonResponse
    {
        $query = Volunteer::with([
            'experiences',
            'skills',
            'trainings',
            'positions',
            'availabilities',
            'lifegroups',
        ]);

        // Search by name, email, or mobile number
        if ($search = $request->query('search')) {
            $query->where(function ($q) use ($search) {
                $q->where('first_name', 'like', '%'.$search.'%')
                    ->orWhere('last_name', 'like', '%'.$search.'%')
                    ->orWhere('email', 'like', '%'.$search.'%')
                    ->orWhere('mobile_number', 'like', '%'.$search.'%');
            });
        }

        // Filter by position
        if ($position = $request->query('position')) {
            $query->whereHas('positions', function ($q) use ($position) {
                $q->where('name', $position);
            });
        }

        // Sort — allowlist to prevent SQL injection
        $allowedSorts = ['first_name', 'last_name', 'email', 'created_at', 'updated_at'];
        $sortBy = in_array($request->query('sort'), $allowedSorts)
            ? $request->query('sort')
            : 'created_at';
        $sortOrder = $request->query('order') === 'asc' ? 'asc' : 'desc';

        $query->orderBy($sortBy, $sortOrder);

        // Paginate
        $perPage = min((int) $request->query('per_page', 15), 100);
        $volunteers = $query->paginate($perPage);

        return response()->json([
            'success' => true,
            'data' => VolunteerProfileResource::collection($volunteers),
            'meta' => [
                'total' => $volunteers->total(),
                'per_page' => $volunteers->perPage(),
                'current_page' => $volunteers->currentPage(),
                'last_page' => $volunteers->lastPage(),
            ],
        ]);
    }

    /**
     * Get a specific volunteer with their relationships and attendance stats.
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

        // Calculate attendance stats
        $attendances = $volunteer->attendances();
        $totalAttendances = $attendances->count();
        $approvedAttendances = $attendances->where('status', 'approved')->count();
        $pendingAttendances = $attendances->where('status', 'pending')->count();
        $rejectedAttendances = $attendances->where('status', 'rejected')->count();
        $totalHours = $attendances->where('status', 'approved')->sum('hours');

        return response()->json([
            'success' => true,
            'data' => [
                'volunteer' => new VolunteerProfileResource($volunteer),
                'stats' => [
                    'total_attendances' => $totalAttendances,
                    'approved_attendances' => $approvedAttendances,
                    'pending_attendances' => $pendingAttendances,
                    'rejected_attendances' => $rejectedAttendances,
                    'total_hours' => (float) $totalHours,
                ],
            ],
        ]);
    }

    /**
     * Get the change history for a specific volunteer (admin only).
     */
    public function changeHistory(int $id): JsonResponse
    {
        $volunteer = Volunteer::find($id);

        if (! $volunteer) {
            return response()->json([
                'success' => false,
                'message' => 'Volunteer not found',
            ], 404);
        }

        $changes = ProfileChangeLog::where('volunteer_id', $volunteer->volunteer_id)
            ->with('changedByUser')
            ->orderBy('created_at', 'desc')
            ->paginate(15);

        return response()->json([
            'success' => true,
            'data' => ProfileChangeLogResource::collection($changes),
            'meta' => [
                'total' => $changes->total(),
                'per_page' => $changes->perPage(),
                'current_page' => $changes->currentPage(),
                'last_page' => $changes->lastPage(),
            ],
        ]);
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
     * Process emergency contact and create/find emergency contact record
     */
    private function processEmergencyContact(
        Volunteer $volunteer,
        string $name,
        string $number,
        string $relationship
    ): void {
        $emergencyContact = \App\Models\EmergencyContact::firstOrCreate([
            'name' => $name,
            'phone_number' => $number,
            'relationship' => $relationship,
        ]);

        $volunteer->emergency_contact_id =
            $emergencyContact->emergency_contact_id;
        $volunteer->save();
    }

    /**
     * Process volunteer availability and create/find availability record
     */
    private function processAvailability(
        Volunteer $volunteer,
        string $availability,
        ?string $otherAvailability
    ): void {
        $availabilityName = $availability;
        $customDescription = null;

        if ($availability === 'others' && ! empty($otherAvailability)) {
            $availabilityName = 'Custom Availability';
            $customDescription = $otherAvailability;
        }

        $availabilityRecord = \App\Models\Availability::firstOrCreate([
            'name' => $availabilityName,
        ]);

        $volunteer->availabilities()->attach(
            $availabilityRecord->availability_id,
            ['custom_description' => $customDescription]
        );
    }

    /**
     * Process lifegroup information and create/find lifegroup record
     */
    private function processLifegroupInfo(
        Volunteer $volunteer,
        string $partOfLifegroup,
        ?string $lifegroupLeaderName,
        string $leadingLifegroup
    ): void {
        if ($partOfLifegroup === 'yes') {
            $lifegroupName = ! empty($lifegroupLeaderName) ? $lifegroupLeaderName : 'General Lifegroup';

            $lifegroup = \App\Models\Lifegroup::firstOrCreate([
                'name' => $lifegroupName,
            ]);

            $volunteer->lifegroups()->attach(
                $lifegroup->lifegroup_id,
                ['is_leader' => $leadingLifegroup === 'yes' ? 1 : 0]
            );
        }
    }
}
