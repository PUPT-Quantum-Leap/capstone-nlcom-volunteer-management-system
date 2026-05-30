<?php

namespace App\Http\Controllers;

use App\Constants\TokenAbilities;
use App\Enums\AuditAction;
use App\Http\Requests\RsvpNonRespondersRequest;
use App\Http\Requests\VerifyPasswordRequest;
use App\Models\Admin;
use App\Models\Attendance;
use App\Models\Rsvp;
use App\Models\RsvpResponse;
use App\Models\User;
use App\Models\Volunteer;
use App\Services\AuditLogger;
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

        $upcomingEvents = Rsvp::query()->where('status', 'active')->whereDate('date', '>=', today())->count();
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

            $hoursServed = round((float) $approvedAttendances->sum('hours'), 2);
            $tasksCompleted = $approvedAttendances->count();
            $totalEntries = $allAttendances->count();
            $attendanceRate = $totalEntries > 0
                ? (int) round(($tasksCompleted / $totalEntries) * 100)
                : 0;

            // Derived rating based on measured participation when explicit rating data is unavailable.
            $ratingBase = min(5, max(0, 2.5 + ($attendanceRate / 40) + min($hoursServed / 120, 1)));
            $rating = round($ratingBase, 2);

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

        $upcomingEventsList = Rsvp::query()
            ->where('status', 'active')
            ->whereDate('date', '>=', today())
            ->withCount('responses')
            ->orderBy('date', 'asc')
            ->limit(5)
            ->get()
            ->map(function ($rsvp) {
                return [
                    'id' => $rsvp->rsvp_id,
                    'title' => $rsvp->title,
                    'date' => $rsvp->date ? $rsvp->date->format('M d, Y') : null,
                    'responses_count' => $rsvp->responses_count,
                    'status' => $rsvp->status,
                ];
            });

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
                'upcomingEventsList' => $upcomingEventsList,
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

        // Security gate: verify invite code and email domain before any other processing.
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
            if (str_starts_with($admin->profile_photo, '/assets/')) {
                $photoUrl = $admin->profile_photo;
            } else {
                $photoUrl = Storage::disk('public')->url($admin->profile_photo);
            }
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

                    // Accept asset path avatars (e.g. /assets/boy.svg, /assets/girl.svg, /assets/apple.svg)
                    if (str_starts_with($photo, '/assets/')) {
                        if ($admin->profile_photo && ! str_starts_with($admin->profile_photo, '/assets/')) {
                            Storage::disk('public')->delete($admin->profile_photo);
                        }
                        $adminData['profile_photo'] = $photo;
                    } elseif (str_starts_with($photo, 'data:image')) {
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
                if (str_starts_with($freshAdmin->profile_photo, '/assets/')) {
                    $photoUrl = $freshAdmin->profile_photo;
                } else {
                    $photoUrl = Storage::disk('public')->url($freshAdmin->profile_photo);
                }
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

    /**
     * Verify the authenticated admin's current password.
     *
     * Validates the password via VerifyPasswordRequest, then checks it
     * against the authenticated user's stored hash. Returns 403 on mismatch
     * or if no user is authenticated.
     */
    public function verifyPassword(VerifyPasswordRequest $request): JsonResponse
    {
        $user = $request->user();

        if (! $user || ! Hash::check($request->password, $user->password)) {
            return response()->json([
                'success' => false,
                'message' => 'Invalid password.',
            ], 403);
        }

        return response()->json([
            'success' => true,
            'message' => 'Password verified.',
        ]);
    }

    /**
     * Helper to get filtered attendance data.
     */
    private function getFilteredAttendanceData(Request $request): array
    {
        $rsvpId = $request->query('rsvp_id') ? (int) $request->query('rsvp_id') : null;
        $date = $request->query('date');
        $search = $request->query('search');

        $query = Rsvp::query()
            ->with(['responses.volunteer.positions', 'responses.timeSlot', 'location']);

        if ($rsvpId) {
            $query->where('rsvp_id', $rsvpId);
        } else {
            $query->whereIn('status', ['active', 'closed']);
        }

        if ($date) {
            $query->whereDate('date', $date);
        }

        $rsvps = $query->get();

        $attendanceData = [];
        $searchTerm = $search ? strtolower(trim($search)) : null;

        foreach ($rsvps as $rsvp) {
            $isCutoffPassed = $rsvp->isCutoffPassed();

            foreach ($rsvp->responses as $response) {
                $v = $response->volunteer;
                $volunteerName = trim(($v?->first_name ?? '').' '.($v?->last_name ?? ''));
                $volunteerEmail = $v?->email ?? '';
                $volunteerDept = $v?->positions?->first()?->name ?? 'Unassigned';
                $rsvpTitle = $rsvp->title ?? '';

                // Apply search filter if present
                if ($searchTerm) {
                    $matchesName = str_contains(strtolower($volunteerName), $searchTerm);
                    $matchesEmail = str_contains(strtolower($volunteerEmail), $searchTerm);
                    $matchesDept = str_contains(strtolower($volunteerDept), $searchTerm);
                    $matchesTitle = str_contains(strtolower($rsvpTitle), $searchTerm);

                    if (! $matchesName && ! $matchesEmail && ! $matchesDept && ! $matchesTitle) {
                        continue;
                    }
                }

                $attendanceData[] = [
                    'id' => $response->rsvp_response_id,
                    'rsvp_id' => $rsvp->rsvp_id,
                    'rsvp_title' => $rsvp->title,
                    'rsvp_date' => $rsvp->date ? (is_string($rsvp->date) ? $rsvp->date : $rsvp->date->toDateString()) : null,
                    'rsvp_location' => $rsvp->event_location,
                    'cutoff_passed' => $isCutoffPassed,
                    'volunteer_id' => $response->volunteer_id,
                    'volunteer_name' => $volunteerName,
                    'volunteer_email' => $volunteerEmail,
                    'volunteer_department' => $volunteerDept,
                    'time_slot' => $response->timeSlot->text ?? null,
                    'voted_at' => $response->voted_at,
                    'checked_in_at' => $response->checked_in_at,
                    'checked_out_at' => $response->checked_out_at,
                    'attendance_status' => $response->attendance_status,
                ];
            }
        }

        return $attendanceData;
    }

    /**
     * Get attendance from RSVP responses after cutoff.
     * Supports filtering by specific RSVP/event.
     */
    public function attendanceFromRsvp(Request $request): JsonResponse
    {
        $role = $request->user()?->role;
        if ($role !== 'admin') {
            return response()->json([
                'success' => false,
                'message' => 'Forbidden. Admin access only.',
            ], 403);
        }

        $attendanceData = $this->getFilteredAttendanceData($request);

        return response()->json([
            'success' => true,
            'data' => $attendanceData,
        ]);
    }

    /**
     * Export attendance to PDF (landscape A4).
     */
    public function exportAttendancePdf(Request $request): \Illuminate\Http\Response|JsonResponse
    {
        $role = $request->user()?->role;
        if ($role !== 'admin') {
            return response()->json([
                'success' => false,
                'message' => 'Forbidden. Admin access only.',
            ], 403);
        }

        $date = $request->query('date');
        $rsvpId = $request->query('rsvp_id');
        $records = $this->getFilteredAttendanceData($request);

        $eventSubtitle = 'All Dates';
        $filenameSuffix = 'all';
        if ($rsvpId) {
            $rsvp = Rsvp::find($rsvpId);
            if ($rsvp) {
                $eventSubtitle = $rsvp->title.' ('.\Carbon\Carbon::parse($rsvp->date)->format('F d, Y').')';
                $filenameSuffix = 'event-'.$rsvpId;
            }
        } elseif ($date) {
            $eventSubtitle = \Carbon\Carbon::parse($date)->format('F d, Y');
            $filenameSuffix = $date;
        }

        $html = view('pdfs.attendance', [
            'records' => $records,
            'date' => $eventSubtitle,
            'generated_at' => now()->format('Y-m-d H:i:s'),
        ])->render();

        $dompdf = new \Dompdf\Dompdf;
        $dompdf->loadHtml($html);
        $dompdf->setPaper('A4', 'landscape');
        $dompdf->render();

        $filename = 'attendance-report-'.$filenameSuffix.'-'.date('YmdHis').'.pdf';

        return response($dompdf->output(), 200, [
            'Content-Type' => 'application/pdf',
            'Content-Disposition' => 'attachment; filename="'.$filename.'"',
        ]);
    }

    /**
     * Export attendance to Excel spreadsheet.
     */
    public function exportAttendanceExcel(Request $request): \Illuminate\Http\Response|JsonResponse
    {
        $role = $request->user()?->role;
        if ($role !== 'admin') {
            return response()->json([
                'success' => false,
                'message' => 'Forbidden. Admin access only.',
            ], 403);
        }

        $date = $request->query('date');
        $rsvpId = $request->query('rsvp_id');
        $records = $this->getFilteredAttendanceData($request);

        $spreadsheet = new \PhpOffice\PhpSpreadsheet\Spreadsheet;
        $sheet = $spreadsheet->getActiveSheet();
        $sheet->setTitle('Attendance Report');

        $spreadsheet->getDefaultStyle()->getFont()->setName('Calibri');

        // Title
        $sheet->setCellValue('A1', 'Volunteer Attendance Report');
        $sheet->mergeCells('A1:G1');
        $sheet->getStyle('A1')->getFont()->setBold(true)->setSize(15);
        $sheet->getStyle('A1')
            ->getAlignment()
            ->setHorizontal(\PhpOffice\PhpSpreadsheet\Style\Alignment::HORIZONTAL_CENTER);

        $subtitle = 'Generated: '.date('Y-m-d H:i:s');
        if ($rsvpId) {
            $rsvp = Rsvp::find($rsvpId);
            if ($rsvp) {
                $subtitle .= ' | Event: '.$rsvp->title.' ('.\Carbon\Carbon::parse($rsvp->date)->format('F d, Y').')';
            }
        } elseif ($date) {
            $subtitle .= ' | Date: '.\Carbon\Carbon::parse($date)->format('F d, Y');
        }
        $sheet->setCellValue('A2', $subtitle);
        $sheet->mergeCells('A2:G2');
        $sheet->getStyle('A2')->getFont()->setSize(11);
        $sheet->getStyle('A2')
            ->getAlignment()
            ->setHorizontal(\PhpOffice\PhpSpreadsheet\Style\Alignment::HORIZONTAL_CENTER);

        // Headers
        $sheet->setCellValue('A4', 'Volunteer Name');
        $sheet->setCellValue('B4', 'Email');
        $sheet->setCellValue('C4', 'Department');
        $sheet->setCellValue('D4', 'Check-In');
        $sheet->setCellValue('E4', 'Check-Out');
        $sheet->setCellValue('F4', 'Duration/Shift');
        $sheet->setCellValue('G4', 'Status');

        $headerRange = 'A4:G4';
        $sheet->getStyle($headerRange)->getFont()->setBold(true)->setSize(10);
        $sheet->getStyle($headerRange)
            ->getFill()
            ->setFillType(\PhpOffice\PhpSpreadsheet\Style\Fill::FILL_SOLID)
            ->getStartColor()
            ->setARGB('FF1e40af'); // primary blue color
        $sheet->getStyle($headerRange)->getFont()->getColor()->setARGB('FFFFFFFF'); // white text

        $row = 5;
        foreach ($records as $record) {
            $formatTime = function ($timeStr) {
                if (! $timeStr) {
                    return '—';
                }
                try {
                    return \Carbon\Carbon::parse($timeStr)->format('h:i A');
                } catch (\Exception $e) {
                    return $timeStr;
                }
            };

            $statusText = $record['attendance_status'] === 'checked_in' ? 'Present' : 'Absent';

            $sheet->setCellValue('A'.$row, $this->spreadsheetText($record['volunteer_name']));
            $sheet->setCellValue('B'.$row, $record['volunteer_email']);
            $sheet->setCellValue('C'.$row, $this->spreadsheetText($record['volunteer_department']));
            $sheet->setCellValue('D'.$row, $formatTime($record['checked_in_at']));
            $sheet->setCellValue('E'.$row, $formatTime($record['checked_out_at']));
            $sheet->setCellValue('F'.$row, $record['time_slot'] ?: '—');
            $sheet->setCellValue('G'.$row, $statusText);

            $statusCell = 'G'.$row;
            if ($statusText === 'Present') {
                $sheet->getStyle($statusCell)->getFont()->getColor()->setARGB('FF15803d');
            } else {
                $sheet->getStyle($statusCell)->getFont()->getColor()->setARGB('FFb91c1c');
            }

            $sheet->getStyle("A{$row}:G{$row}")->getFont()->setSize(10);
            $row++;
        }

        $lastRow = $row - 1;

        if ($lastRow >= 5) {
            $sheet->getStyle("A4:G{$lastRow}")
                ->getBorders()->getAllBorders()
                ->setBorderStyle(\PhpOffice\PhpSpreadsheet\Style\Border::BORDER_THIN);
        }

        foreach (range('A', 'G') as $col) {
            $sheet->getColumnDimension($col)->setAutoSize(true);
        }

        $writer = new \PhpOffice\PhpSpreadsheet\Writer\Xlsx($spreadsheet);
        $filenameSuffix = 'all';
        if ($rsvpId) {
            $filenameSuffix = 'event-'.$rsvpId;
        } elseif ($date) {
            $filenameSuffix = $date;
        }
        $filename = 'attendance-report-'.$filenameSuffix.'-'.date('YmdHis').'.xlsx';

        ob_start();
        $writer->save('php://output');
        $content = ob_get_clean();

        return response($content, 200, [
            'Content-Type' => 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
            'Content-Disposition' => 'attachment; filename="'.$filename.'"',
        ]);
    }

    /**
     * Get active volunteers who have NOT responded to a given RSVP.
     * Supports search by name/email and pagination.
     */
    public function rsvpNonResponders(RsvpNonRespondersRequest $request): JsonResponse
    {
        $validated = $request->validated();

        $rsvpId = (int) $validated['rsvp_id'];
        $search = $validated['search'] ?? null;
        $perPage = (int) ($validated['per_page'] ?? 25);

        $query = Volunteer::query()
            ->with('positions:position_id,name')
            ->whereNull('deleted_at')
            ->whereDoesntHave('rsvpResponses', fn ($q) => $q->where('rsvp_id', $rsvpId));

        if ($search) {
            $query->where(function ($q) use ($search): void {
                $q->where('first_name', 'like', "%{$search}%")
                    ->orWhere('last_name', 'like', "%{$search}%")
                    ->orWhere('email', 'like', "%{$search}%");
            });
        }

        $paginated = $query->paginate($perPage, ['*'], 'page', $validated['page'] ?? 1);

        $data = $paginated->map(fn ($v) => [
            'volunteer_id' => $v->volunteer_id,
            'volunteer_name' => trim("{$v->first_name} {$v->last_name}"),
            'volunteer_email' => $v->email ?? '',
            'volunteer_department' => $v->positions->first()?->name ?? 'Unassigned',
            'mobile_number' => $v->mobile_number ?? '',
        ])->values();

        return response()->json([
            'success' => true,
            'data' => $data,
            'meta' => [
                'current_page' => $paginated->currentPage(),
                'last_page' => $paginated->lastPage(),
                'total' => $paginated->total(),
                'per_page' => $paginated->perPage(),
            ],
        ]);
    }

    /**
     * Update attendance status for an RSVP response.
     * This updates both the RSVP response and creates/updates the Attendance record.
     */
    public function updateAttendanceStatus(Request $request): JsonResponse
    {
        $role = $request->user()?->role;
        if ($role !== 'admin') {
            return response()->json([
                'success' => false,
                'message' => 'Forbidden. Admin access only.',
            ], 403);
        }

        $validated = $request->validate([
            'rsvp_response_id' => ['required', 'exists:rsvp_response,rsvp_response_id'],
            'status' => ['required', 'in:present,absent'],
        ]);

        $rsvpResponse = RsvpResponse::query()->with(['timeSlot', 'rsvp'])->find($validated['rsvp_response_id']);
        if (! $rsvpResponse) {
            return response()->json([
                'success' => false,
                'message' => 'RSVP response not found.',
            ], 404);
        }

        if ($rsvpResponse->rsvp && $rsvpResponse->rsvp->date) {
            $eventDate = \Carbon\Carbon::parse($rsvpResponse->rsvp->date)->startOfDay();
            $today = \Carbon\Carbon::today();
            if ($eventDate->diffInDays($today, false) > 7) {
                return response()->json([
                    'success' => false,
                    'message' => 'Attendance for events older than 1 week cannot be modified.',
                ], 422);
            }
        }

        Log::debug('RSVP response loaded', [
            'rsvp_response_id' => $rsvpResponse->rsvp_response_id,
            'time_slot_id' => $rsvpResponse->time_slot_id,
            'time_slot_text' => $rsvpResponse->timeSlot?->text ?? 'NULL',
        ]);

        // Map present/absent to attendance_status values
        $attendanceStatus = $validated['status'] === 'present' ? 'checked_in' : 'no_show';

        $hours = 0;
        DB::transaction(function () use ($validated, $rsvpResponse, $attendanceStatus, &$hours) {
            // Update RSVP response
            $rsvpResponse->attendance_status = $attendanceStatus;
            if ($validated['status'] === 'present') {
                if (! $rsvpResponse->checked_in_at) {
                    $rsvpResponse->checked_in_at = now();
                }
                // Set checkout time to the configured default window after check-in if not already set
                if (! $rsvpResponse->checked_out_at) {
                    $defaultHours = (int) config('app.attendance_default_hours', 4);
                    $rsvpResponse->checked_out_at = $rsvpResponse->checked_in_at->copy()->addHours($defaultHours);
                }
            }

            // Suppress observer events because we will handle Attendance creation/update manually here
            RsvpResponse::withoutEvents(fn () => $rsvpResponse->save());

            // Calculate hours from time_slot if available, otherwise use check_in/check_out
            $hours = 0;

            // Try to get hours from rsvp_shift time_slot (e.g., "8:00 AM - 12:00 PM")
            $timeSlotText = $rsvpResponse->timeSlot?->text ?? null;
            if ($timeSlotText) {
                $hours = $this->calculateHoursFromTimeSlot($timeSlotText);
                Log::debug('Hours calculated from time_slot', ['time_slot' => $timeSlotText, 'hours' => $hours]);
            }

            // Fallback to check_in/check_out times if time_slot didn't give us hours
            if ($hours == 0 && $rsvpResponse->checked_in_at && $rsvpResponse->checked_out_at) {
                $diffMinutes = $rsvpResponse->checked_in_at->diffInMinutes($rsvpResponse->checked_out_at);
                $hours = round($diffMinutes / 60, 2);
                Log::debug('Hours calculated from check_in/check_out', [
                    'checked_in' => $rsvpResponse->checked_in_at,
                    'checked_out' => $rsvpResponse->checked_out_at,
                    'diff_minutes' => $diffMinutes,
                    'hours' => $hours,
                ]);
            }

            // Update or create Attendance record
            $rsvp = $rsvpResponse->rsvp;
            if ($rsvp) {
                $attendance = Attendance::query()->updateOrCreate(
                    [
                        'rsvp_response_id' => $rsvpResponse->rsvp_response_id,
                    ],
                    [
                        'volunteer_id' => $rsvpResponse->volunteer_id,
                        'rsvp_id' => $rsvp->rsvp_id,
                        'date' => $rsvp->date,
                        'hours' => $hours,
                        'description' => $rsvp->title,
                        'location' => $rsvp->event_location,
                        'location_id' => $rsvp->location_id,
                        'status' => $validated['status'] === 'present' ? 'approved' : 'rejected',
                    ]
                );

                Log::debug('Attendance record saved', [
                    'attendance_id' => $attendance->attendance_id,
                    'hours' => $attendance->hours,
                    'status' => $attendance->status,
                ]);
            }
        });

        AuditLogger::success(AuditAction::ATTENDANCE_MANUAL_OVERRIDE, [
            'resource_type' => 'rsvp_response',
            'resource_id' => $rsvpResponse->rsvp_response_id,
            'resource_label' => 'RSVP Response #'.$rsvpResponse->rsvp_response_id,
            'description' => "Manual attendance override: volunteer #{$rsvpResponse->volunteer_id} marked {$validated['status']}",
        ]);

        return response()->json([
            'success' => true,
            'message' => 'Attendance status updated successfully.',
            'data' => [
                'rsvp_response_id' => $rsvpResponse->rsvp_response_id,
                'status' => $validated['status'],
                'attendance_status' => $attendanceStatus,
                'hours' => $hours,
            ],
        ]);
    }

    /**
     * Calculate hours from time slot text (e.g., "8:00 AM - 12:00 PM")
     */
    private function calculateHoursFromTimeSlot(string $timeSlotText): float
    {
        // Pattern: "8:00 AM - 12:00 PM" or "8:00AM - 12:00PM"
        if (! preg_match('/(\d{1,2}:\d{2}\s*[AP]M)\s*-\s*(\d{1,2}:\d{2}\s*[AP]M)/i', $timeSlotText, $matches)) {
            return 0;
        }

        $start = $matches[1];
        $end = $matches[2];

        try {
            $startTime = \Carbon\Carbon::parse($start);
            $endTime = \Carbon\Carbon::parse($end);

            $diffMinutes = $startTime->diffInMinutes($endTime);

            return round($diffMinutes / 60, 2);
        } catch (\Exception $e) {
            Log::error('Failed to parse time slot', ['time_slot' => $timeSlotText, 'error' => $e->getMessage()]);

            return 0;
        }
    }

    /**
     * Prevent formula injection when generating spreadsheet cells.
     */
    private function spreadsheetText(mixed $value): string
    {
        $text = (string) $value;

        return preg_match('/^[=+\-@]/', $text) === 1 ? "'".$text : $text;
    }
}
