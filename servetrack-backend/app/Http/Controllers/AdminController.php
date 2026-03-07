<?php

namespace App\Http\Controllers;

use App\Models\Admin;
use App\Models\Attendance;
use App\Models\User;
use App\Models\Volunteer;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Schema;
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
            $result = DB::transaction(function () use ($request) {
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
            $token = $result['user']->createToken('auth-token', ['*'], now()->addMinutes(config('sanctum.expiration', 60)))->plainTextToken;
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
            \Log::error('Admin registration failed', [
                'error' => $e->getMessage(),
                'trace' => $e->getTraceAsString(),
            ]);

            return response()->json([
                'success' => false,
                'message' => 'Registration failed. Please try again or contact support.',
            ], 500);
        }
    }
}
