<?php

namespace App\Http\Controllers;

use App\Constants\TokenAbilities;
use App\Models\Admin;
use App\Models\Attendance;
use App\Models\Invite;
use App\Models\User;
use App\Models\Volunteer;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Facades\Validator;
use Illuminate\Validation\Rules\Password;

class AdminController extends Controller
{
    /**
     * Fetch dashboard analytics and lists for admin/coordinator.
     */
    public function dashboard(Request $request): JsonResponse
    {
        $role = $request->user()?->role;
        if ($role !== 'admin') {
            return response()->json([
                'success' => false,
                'message' => 'Forbidden. Admin access only.',
            ], 403);
        }

        $volunteers = Volunteer::query()
            ->with([
                'positions:position_id,name',
                'attendances' => fn ($q) => $q->select(
                    'attendance_id',
                    'volunteer_id',
                    'date',
                    'hours',
                    'status'
                ),
            ])
            ->get();

        $now = now();
        $activeCutoff = $now->copy()->subDays(30);
        $weekStart = $now->copy()->startOfWeek();

        $totalVolunteers = $volunteers->count();
        $newVolunteersThisWeek = $volunteers
            ->filter(fn ($v) => $v->created_at && $v->created_at->gte($weekStart))
            ->count();

        $activeVolunteers = $volunteers->filter(function ($v) use ($activeCutoff) {
            return $v->attendances->contains(function ($a) use ($activeCutoff) {
                return $a->status === 'approved' && $a->date && $a->date->gte($activeCutoff);
            });
        })->count();

        $upcomingEvents = Attendance::query()->whereDate('date', '>', today())->count();
        $completedMissions = Attendance::query()->where('status', 'approved')->count();

        $pendingAttendance = Attendance::query()->where('status', 'pending')->count();

        $volunteerRows = $volunteers->map(function ($volunteer) use ($activeCutoff) {
            $hasRecentApproved = $volunteer->attendances->contains(function ($attendance) use ($activeCutoff) {
                return $attendance->status === 'approved' && $attendance->date && $attendance->date->gte($activeCutoff);
            });

            return [
                'id' => $volunteer->volunteer_id,
                'name' => trim($volunteer->first_name.' '.$volunteer->last_name),
                'email' => $volunteer->email,
                'phone' => $volunteer->mobile_number,
                'facebookName' => $volunteer->facebook_name,
                'department' => $volunteer->positions->first()->name ?? 'Unassigned',
                'status' => $hasRecentApproved ? 'active' : 'inactive',
                'joined_date' => optional($volunteer->created_at)->toDateString(),
            ];
        })->values();

        $performance = $volunteers->map(function ($volunteer) {
            $allAttendances = $volunteer->attendances;
            $approvedAttendances = $allAttendances->where('status', 'approved');

            $hoursServed = round((float) $approvedAttendances->sum('hours'), 1);
            $tasksCompleted = $approvedAttendances->count();
            $totalEntries = $allAttendances->count();
            $attendanceRate = $totalEntries > 0
                ? (int) round(($tasksCompleted / $totalEntries) * 100)
                : 0;

            // Derived rating based on measured participation when explicit rating data is unavailable.
            $ratingBase = min(5, max(0, 2.5 + ($attendanceRate / 40) + min($hoursServed / 120, 1)));
            $rating = round($ratingBase, 1);

            $lastAttendance = $allAttendances->sortByDesc('date')->first();

            return [
                'id' => $volunteer->volunteer_id,
                'volunteerId' => $volunteer->volunteer_id,
                'volunteerName' => trim($volunteer->first_name.' '.$volunteer->last_name),
                'attendanceRate' => $attendanceRate,
                'hoursServed' => $hoursServed,
                'tasksCompleted' => $tasksCompleted,
                'rating' => $rating,
                'lastActivity' => optional($lastAttendance?->date)->toDateString() ?? optional($volunteer->updated_at)->toDateString(),
            ];
        })->values();

        $notifications = collect([
            $newVolunteersThisWeek > 0 ? [
                'id' => 1,
                'title' => 'New Volunteer Registrations',
                'description' => $newVolunteersThisWeek.' volunteer(s) registered this week.',
                'time' => 'This week',
                'read' => false,
            ] : null,
            $pendingAttendance > 0 ? [
                'id' => 2,
                'title' => 'Pending Attendance Entries',
                'description' => $pendingAttendance.' attendance record(s) awaiting review.',
                'time' => 'Now',
                'read' => false,
            ] : null,
        ])->filter()->values();

        return response()->json([
            'success' => true,
            'data' => [
                'stats' => [
                    'totalVolunteers' => $totalVolunteers,
                    'activeVolunteers' => $activeVolunteers,
                    'upcomingEvents' => $upcomingEvents,
                    'completedMissions' => $completedMissions,
                ],
                'notifications' => $notifications,
                'volunteers' => $volunteerRows,
                'performanceMetrics' => $performance,
            ],
        ]);
    }

    /**
     * Register a new admin user
     */
    public function register(Request $request): JsonResponse
    {
        // Email normalization is now handled by NormalizeEmail middleware

        // If already authenticated, log out first to prevent duplicate accounts
        if (Auth::check()) {
            Auth::logout();
            if ($request->hasSession()) {
                $request->session()->invalidate();
                $request->session()->regenerateToken();
            }
        }

        // Validate invite token if provided (for email invites)
        $invite = null;
        if ($request->has('token')) {
            $invite = Invite::where('token', $request->token)->first();
            if (! $invite || ! $invite->isValid() || $invite->role !== 'admin') {
                return response()->json([
                    'success' => false,
                    'message' => 'Invalid or expired invite token',
                ], 400);
            }
        }

        // Security gate: verify invite code and email domain before any other processing.
        // Only required if not using an invite token
        if (! $invite) {
            $inviteCode = config('services.admin.invite_code');
            if (empty($inviteCode)) {
                Log::error('Admin registration attempted but no invite code is configured in .env');

                return response()->json([
                    'success' => false,
                    'message' => 'Registration failed. Please contact your administrator.',
                ], 422);
            }

            if ($request->input('inviteCode') !== $inviteCode) {
                return response()->json([
                    'success' => false,
                    'message' => 'Registration failed. Please contact your administrator.',
                ], 422);
            }

            $allowedDomainsRaw = config('services.admin.allowed_domains');
            if (empty($allowedDomainsRaw)) {
                Log::error('Admin registration attempted but no allowed domains are configured in .env');

                return response()->json([
                    'success' => false,
                    'message' => 'Registration failed. Please contact your administrator.',
                ], 422);
            }

            $allowedDomains = array_map(
                fn (string $d) => strtolower(trim($d)),
                explode(',', $allowedDomainsRaw),
            );

            $emailDomain = strtolower(substr(strrchr((string) $request->input('email', ''), '@'), 1));
            if (! in_array($emailDomain, $allowedDomains, true)) {
                return response()->json([
                    'success' => false,
                    'message' => 'Registration failed. Please contact your administrator.',
                ], 422);
            }
        } else {
            // Ensure the email matches the invite if a token is used
            if (strtolower($invite->email) !== strtolower($request->email)) {
                return response()->json([
                    'success' => false,
                    'message' => 'Registration email must match the invitation email.',
                ], 400);
            }
        }

        // Validate incoming data
        $validator = Validator::make($request->all(), [
            'firstName' => 'required|string|min:2|max:50',
            'lastName' => 'required|string|min:2|max:50',
            'email' => 'required|email|unique:users,email|unique:admin,email',
            'contactNumber' => 'nullable|string|max:20',
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

        try {
            $result = DB::transaction(function () use ($request, $invite) {
                // Create admin user in users table
                $user = User::create([
                    'name' => $request->firstName.' '.$request->lastName,
                    'email' => $request->email,
                    'password' => Hash::make($request->password),
                    'role' => 'admin',
                ]);

                // Create admin profile in admin table, supporting current DB schema variants.
                $adminData = [
                    'email' => $request->email,
                    'contact_number' => $request->contactNumber,
                    'user_id' => $user->id,
                ];

                if (Schema::hasColumn('admin', 'first_name')) {
                    $adminData['first_name'] = $request->firstName;
                }

                if (Schema::hasColumn('admin', 'last_name')) {
                    $adminData['last_name'] = $request->lastName;
                }

                if (Schema::hasColumn('admin', 'name')) {
                    $adminData['name'] = $request->firstName.' '.$request->lastName;
                }

                if (Schema::hasColumn('admin', 'password')) {
                    $adminData['password'] = Hash::make($request->password);
                }

                $admin = Admin::create($adminData);

                // Mark invite as accepted if used
                if ($invite) {
                    $invite->accept();
                }

                $adminName = trim((string) ($admin->name ?? ''));
                $profileFirstName = $admin->first_name;
                $profileLastName = $admin->last_name;

                if ((! $profileFirstName || ! $profileLastName) && $adminName !== '') {
                    $nameParts = preg_split('/\s+/', $adminName, 2);
                    $profileFirstName = $profileFirstName ?: ($nameParts[0] ?? $request->firstName);
                    $profileLastName = $profileLastName ?: ($nameParts[1] ?? $request->lastName);
                }

                return [
                    'user' => $user,
                    'admin' => $admin,
                    'profile_first_name' => $profileFirstName ?: $request->firstName,
                    'profile_last_name' => $profileLastName ?: $request->lastName,
                ];
            });

            // Log the user in
            Auth::login($result['user']);

            // Create Sanctum token and cookie
            $token = $result['user']->createToken('auth-token', TokenAbilities::ADMIN, now()->addMinutes((int) config('sanctum.expiration', 60)))->plainTextToken;
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
                'message' => 'Admin registration successful',
                'user' => [
                    'id' => $result['user']->id,
                    'name' => $result['user']->name,
                    'email' => $result['user']->email,
                    'role' => $result['user']->role,
                    'admin_profile' => [
                        'id' => $result['admin']->id ?? $result['admin']->admin_id,
                        'first_name' => $result['profile_first_name'],
                        'last_name' => $result['profile_last_name'],
                        'contact_number' => $result['admin']->contact_number,
                    ],
                ],
            ], 201)->withCookie($cookie);

        } catch (\Exception $e) {
            Log::error('Admin registration failed', [
                'error' => $e->getMessage(),
                'trace' => $e->getTraceAsString(),
            ]);

            return response()->json([
                'success' => false,
                'message' => 'Registration failed. Please try again or contact support.',
            ], 500);
        }
    }

    /**
     * Get the current admin's profile.
     */
    public function profile(Request $request): JsonResponse
    {
        $user = $request->user();
        $admin = Admin::where('user_id', $user->id)->first() ?? Admin::where('email', $user->email)->first();

        if (! $admin) {
            return response()->json([
                'success' => false,
                'message' => 'Admin profile not found.',
            ], 404);
        }

        // Handle case where Admin model might use different primary key names
        $adminId = $admin->id ?? $admin->admin_id;

        $photoUrl = null;
        if ($admin->profile_photo) {
            $photoUrl = asset('storage/'.$admin->profile_photo);
        }

        return response()->json([
            'success' => true,
            'data' => [
                'id' => $user->id,
                'name' => $user->name,
                'email' => $user->email,
                'first_name' => $admin->first_name ?? explode(' ', $user->name)[0],
                'last_name' => $admin->last_name ?? (explode(' ', $user->name)[1] ?? ''),
                'contact_number' => $admin->contact_number,
                'profile_photo_url' => $photoUrl,
                'admin_id' => $adminId,
            ],
        ]);
    }

    /**
     * Update the current admin's profile.
     */
    public function updateProfile(Request $request): JsonResponse
    {
        $user = $request->user();
        $admin = Admin::where('user_id', $user->id)->first() ?? Admin::where('email', $user->email)->first();

        if (! $admin) {
            return response()->json([
                'success' => false,
                'message' => 'Admin profile not found.',
            ], 404);
        }

        $validator = Validator::make($request->all(), [
            'first_name' => 'required|string|max:50',
            'last_name' => 'required|string|max:50',
            'email' => 'required|email|unique:users,email,'.$user->id,
            'contact_number' => 'nullable|string|max:20',
            'profile_photo' => 'nullable|string',
        ]);

        if ($validator->fails()) {
            return response()->json([
                'success' => false,
                'message' => 'Validation failed',
                'errors' => $validator->errors(),
            ], 422);
        }

        try {
            DB::transaction(function () use ($request, $user, $admin): void {
                $user->update([
                    'name' => $request->first_name.' '.$request->last_name,
                    'email' => $request->email,
                ]);

                $adminData = [
                    'email' => $request->email,
                    'contact_number' => $request->contact_number,
                ];

                // Handle Photo
                if ($request->filled('profile_photo')) {
                    $photo = $request->profile_photo;
                    if (str_starts_with($photo, 'data:image')) {
                        $photoData = substr($photo, strpos($photo, ',') + 1);
                        $photoData = base64_decode($photoData);
                        $mimeType = explode(':', substr($photo, 0, strpos($photo, ';')))[1];
                        $extension = explode('/', $mimeType)[1];

                        // Normalize extension
                        if ($extension === 'jpeg') {
                            $extension = 'jpg';
                        }

                        $fileName = 'admin_'.($admin->id ?? $admin->admin_id).'_'.time().'.'.$extension;
                        Storage::disk('public')->put('profiles/'.$fileName, $photoData);

                        // Delete old photo if exists
                        if ($admin->profile_photo) {
                            Storage::disk('public')->delete($admin->profile_photo);
                        }

                        $adminData['profile_photo'] = 'profiles/'.$fileName;
                    }
                }

                if (Schema::hasColumn('admin', 'first_name')) {
                    $adminData['first_name'] = $request->first_name;
                }

                if (Schema::hasColumn('admin', 'last_name')) {
                    $adminData['last_name'] = $request->last_name;
                }

                if (Schema::hasColumn('admin', 'name')) {
                    $adminData['name'] = $request->first_name.' '.$request->last_name;
                }

                $admin->update($adminData);
            });

            $freshAdmin = $admin->fresh();
            $photoUrl = null;
            if ($freshAdmin->profile_photo) {
                $photoUrl = Storage::disk('public')->url($freshAdmin->profile_photo);
            }

            return response()->json([
                'success' => true,
                'message' => 'Profile updated successfully',
                'data' => [
                    'id' => $user->id,
                    'name' => $user->fresh()->name,
                    'email' => $user->fresh()->email,
                    'role' => $user->role,
                    'profile_photo_url' => $photoUrl,
                ],
            ]);
        } catch (\Exception $e) {
            Log::error('Admin profile update failed', ['error' => $e->getMessage()]);

            return response()->json([
                'success' => false,
                'message' => 'Failed to update profile.',
            ], 500);
        }
    }
}
