<?php

namespace App\Http\Controllers;

use App\Models\Attendance;
use App\Models\Lifegroup;
use App\Models\Position;
use App\Models\Rsvp;
use App\Models\Skill;
use App\Models\Training;
use App\Models\Volunteer;
use Carbon\Carbon;
use Dompdf\Dompdf;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Response;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;
use PhpOffice\PhpSpreadsheet\Spreadsheet;
use PhpOffice\PhpSpreadsheet\Style\Alignment;
use PhpOffice\PhpSpreadsheet\Style\Border;
use PhpOffice\PhpSpreadsheet\Style\Fill;
use PhpOffice\PhpSpreadsheet\Writer\Xlsx;

class AnalyticsController extends Controller
{
    public function reports(Request $request): JsonResponse
    {
        $dateRange = $request->query('dateRange', 'all');
        $departmentId = $request->query('departmentId');
        $legacyDepartment = $request->query('department');
        $resolvedDepartmentId = $departmentId;

        if (! $resolvedDepartmentId && $legacyDepartment) {
            $resolvedDepartmentId = Position::query()
                ->where('name', $legacyDepartment)
                ->value('position_id');
        }

        $startDateString = $this->getStartDate($dateRange);
        $startDate = $startDateString ? Carbon::parse($startDateString) : null;

        $activeCutoff = Carbon::now()->subDays(30);
        $attendanceStartDate = $startDate && $startDate->lt($activeCutoff)
            ? $startDate
            : $activeCutoff;

        try {
            // Get volunteer IDs first if department filter is applied
            if ($resolvedDepartmentId) {
                $volunteerIds = DB::table('volunteer_position')
                    ->where('position_id', $resolvedDepartmentId)
                    ->pluck('volunteer_id');

                $volunteers = Volunteer::query()
                    ->whereIn('volunteer_id', $volunteerIds)
                    ->with([
                        'positions:position_id,name',
                        'attendances' => fn ($query) => $query
                            ->where('date', '>=', $attendanceStartDate),
                    ])
                    ->get();
            } else {
                $volunteers = Volunteer::query()
                    ->with([
                        'positions:position_id,name',
                        'attendances' => fn ($query) => $query
                            ->where('date', '>=', $attendanceStartDate),
                    ])
                    ->get();
            }
        } catch (\Exception $e) {
            Log::error($e);

            return response()->json([
                'success' => false,
                'message' => 'Internal server error',
            ], 500);
        }

        $volunteerIds = $volunteers->pluck('volunteer_id');

        $attendances = $volunteers
            ->flatMap->attendances
            ->when($startDate, fn ($collection) => $collection->filter(
                fn ($attendance) => $attendance->date &&
                    $attendance->date->gte($startDate)
            ))
            ->values();

        $totalVolunteers = $volunteers->count();
        $activeVolunteers = $volunteers->filter(function ($v) use ($activeCutoff) {
            return $v->attendances->contains(function ($a) use ($activeCutoff) {
                return $a->date && $a->date->gte($activeCutoff);
            });
        })->count();
        $inactiveVolunteers = $totalVolunteers - $activeVolunteers;

        $totalHoursServed = round((float) $attendances->sum('hours'), 1);
        $totalTasksCompleted = $attendances->count();

        $totalAttendanceRecords = Attendance::query()
            ->whereIn('volunteer_id', $volunteerIds)
            ->when($startDateString, fn ($q) => $q->where('date', '>=', $startDateString))
            ->count();
        $averageAttendanceRate = $totalAttendanceRecords > 0
            ? (int) round(($totalTasksCompleted / $totalAttendanceRecords) * 100)
            : 0;

        $positions = Position::query()
            ->when($resolvedDepartmentId, fn ($q) => $q->where('position_id', $resolvedDepartmentId))
            ->withCount('volunteers')
            ->orderByDesc('volunteers_count')
            ->get();
        $totalPositionVolunteers = $positions->sum('volunteers_count') ?: 1;
        $departmentBreakdown = $positions->map(function ($pos) use ($totalPositionVolunteers) {
            return (object) [
                'name' => $pos->name,
                'count' => $pos->volunteers_count,
                'percentage' => $totalPositionVolunteers > 0
                    ? (int) round(($pos->volunteers_count / $totalPositionVolunteers) * 100)
                    : 0,
            ];
        })->filter(fn ($d) => $d->count > 0)->values();

        $monthlyTrend = $this->getMonthlyTrend(
            $startDateString,
            $resolvedDepartmentId
                ? Position::query()->where('position_id', $resolvedDepartmentId)->value('name')
                : null
        );

        $topPerformers = $this->getTopPerformers($volunteers, 10);

        $recentActivity = $this->getRecentActivity();

        $averageRating = $topPerformers->isNotEmpty()
            ? round($topPerformers->avg('rating'), 1)
            : 0;

        $eventParticipation = $this->getEventParticipation($startDate);
        $skillsDistribution = $this->getSkillsDistribution();
        $trainingCompletion = $this->getTrainingCompletion();
        $lifegroupDistribution = $this->getLifegroupDistribution();
        $retentionMetrics = $this->getRetentionMetrics($volunteers);
        $hourlyTrends = $this->getHourlyTrends($startDate);

        $responseData = [
            'success' => true,
            'data' => [
                'totalVolunteers' => $totalVolunteers,
                'activeVolunteers' => $activeVolunteers,
                'inactiveVolunteers' => $inactiveVolunteers,
                'totalHoursServed' => $totalHoursServed,
                'averageAttendanceRate' => $averageAttendanceRate,
                'totalTasksCompleted' => $totalTasksCompleted,
                'averageRating' => $averageRating,
                'departmentBreakdown' => $departmentBreakdown,
                'monthlyTrend' => $monthlyTrend,
                'topPerformers' => $topPerformers,
                'recentActivity' => $recentActivity,
                'eventParticipation' => $eventParticipation,
                'skillsDistribution' => $skillsDistribution,
                'trainingCompletion' => $trainingCompletion,
                'lifeGroupDistribution' => $lifegroupDistribution,
                'retentionMetrics' => $retentionMetrics,
                'hourlyTrends' => $hourlyTrends,
            ],
        ];

        return response()->json($responseData);
    }

    public function exportPdf(Request $request): Response
    {
        $role = $request->user()?->role;
        if ($role !== 'admin') {
            return response()->json([
                'success' => false,
                'message' => 'Forbidden. Admin access only.',
            ], 403);
        }

        $html = $this->generateEventScheduleHtml();

        $dompdf = new Dompdf;
        $dompdf->loadHtml($html);
        $dompdf->setPaper('A4', 'portrait');
        $dompdf->render();

        $filename = 'nlcom-metro-world-child-feeding-'.date('Y-m-d-H-i-s').'.pdf';

        return response($dompdf->output(), 200, [
            'Content-Type' => 'application/pdf',
            'Content-Disposition' => 'attachment; filename="'.$filename.'"',
        ]);
    }

    public function exportExcel(Request $request): Response
    {
        $role = $request->user()?->role;
        if ($role !== 'admin') {
            return response()->json([
                'success' => false,
                'message' => 'Forbidden. Admin access only.',
            ], 403);
        }

        $spreadsheet = new Spreadsheet;
        $sheet = $spreadsheet->getActiveSheet();
        $sheet->setTitle('Feeding Operation');

        // Set default font to Calibri
        $spreadsheet->getDefaultStyle()->getFont()->setName('Calibri');

        // Title - 15pt Bold
        $sheet->setCellValue('A1', 'NLCOM x Metro World Child Feeding Operation');
        $sheet->mergeCells('A1:E1');
        $sheet->getStyle('A1')->getFont()->setBold(true)->setSize(15);
        $sheet->getStyle('A1')->getAlignment()->setHorizontal(Alignment::HORIZONTAL_CENTER);

        // Date - 11pt Regular
        $sheet->setCellValue('A2', 'November 22, 2025');
        $sheet->mergeCells('A2:E2');
        $sheet->getStyle('A2')->getFont()->setSize(11);
        $sheet->getStyle('A2')->getAlignment()->setHorizontal(Alignment::HORIZONTAL_CENTER);

        // Headers - 10pt Bold
        $sheet->setCellValue('A4', 'TEAM & TIME DEPARTURE');
        $sheet->setCellValue('B4', 'LOCATION');
        $sheet->setCellValue('C4', 'TIME');
        $sheet->setCellValue('D4', 'NO. OF PAX');
        $sheet->setCellValue('E4', 'DETAILS');

        $sheet->getStyle('A4:E4')->getFont()->setBold(true)->setSize(10);
        $sheet->getStyle('A4:E4')->getFill()->setFillType(Fill::FILL_SOLID)->getStartColor()->setARGB('FFe5e7eb');

        // Data - 10pt Regular
        $row = 5;

        // Team Alpha
        $sheet->setCellValue('A'.$row, 'TEAM ALPHA (NL Las Piñas - Leaves 7:30am)');
        $sheet->mergeCells("A{$row}:E{$row}");
        $sheet->getStyle("A{$row}")->getFont()->setBold(true)->setSize(10);
        $row++;

        $sheet->setCellValue('A'.$row, '1. Golden Acres (Talon 1)');
        $sheet->setCellValue('B'.$row, 'Golden Acres (Talon 1)');
        $sheet->setCellValue('C'.$row, '8:00am - 9:30am');
        $sheet->setCellValue('D'.$row, 100);
        $sheet->setCellValue('E'.$row, 'Drop off GA team before proceeding to VP. Wait after feeding.');
        $sheet->getStyle("A{$row}:E{$row}")->getFont()->setSize(10);
        $row++;

        $sheet->setCellValue('A'.$row, '2. Villa Pangarap (Talon 5)');
        $sheet->setCellValue('B'.$row, 'Villa Pangarap (Talon 5)');
        $sheet->setCellValue('C'.$row, '8:00am - 9:30am');
        $sheet->setCellValue('D'.$row, 150);
        $sheet->setCellValue('E'.$row, 'Park vehicle in VP. After feeding, pick up GA team and go to Annex.');
        $sheet->getStyle("A{$row}:E{$row}")->getFont()->setSize(10);
        $row++;

        $sheet->setCellValue('A'.$row, '3. Annex (Talon 5)');
        $sheet->setCellValue('B'.$row, 'Annex (Talon 5)');
        $sheet->setCellValue('C'.$row, '9:00am - 12:00nn');
        $sheet->setCellValue('D'.$row, 150);
        $sheet->setCellValue('E'.$row, 'Proceed after 2 sites before heading back to base.');
        $sheet->getStyle("A{$row}:E{$row}")->getFont()->setSize(10);
        $row += 2;

        // Team Bravo
        $sheet->setCellValue('A'.$row, 'TEAM BRAVO (Tondo AM - Leaves 7:30am)');
        $sheet->mergeCells("A{$row}:E{$row}");
        $sheet->getStyle("A{$row}")->getFont()->setBold(true)->setSize(10);
        $row++;

        $sheet->setCellValue('A'.$row, '4. Market 3');
        $sheet->setCellValue('B'.$row, 'Market 3');
        $sheet->setCellValue('C'.$row, '8:30am - 10:00am');
        $sheet->setCellValue('D'.$row, 200);
        $sheet->setCellValue('E'.$row, 'Proceed to M3 until feeding. Then go to second site (NBBN).');
        $sheet->getStyle("A{$row}:E{$row}")->getFont()->setSize(10);
        $row++;

        $sheet->setCellValue('A'.$row, '5. NBBN');
        $sheet->setCellValue('B'.$row, 'NBBN');
        $sheet->setCellValue('C'.$row, '11:00am - 12:30pm');
        $sheet->setCellValue('D'.$row, 170);
        $sheet->setCellValue('E'.$row, 'Continue after M3 before heading back to base.');
        $sheet->getStyle("A{$row}:E{$row}")->getFont()->setSize(10);
        $row += 2;

        // Team Charlie
        $sheet->setCellValue('A'.$row, 'TEAM CHARLIE (GIAWH AM - Leaves 8:30am)');
        $sheet->mergeCells("A{$row}:E{$row}");
        $sheet->getStyle("A{$row}")->getFont()->setBold(true)->setSize(10);
        $row++;

        $sheet->setCellValue('A'.$row, '6. Masville');
        $sheet->setCellValue('B'.$row, 'Masville');
        $sheet->setCellValue('C'.$row, '9:00am - 12:00nn');
        $sheet->setCellValue('D'.$row, 350);
        $sheet->setCellValue('E'.$row, 'Whole team proceeds to Masville.');
        $sheet->getStyle("A{$row}:E{$row}")->getFont()->setSize(10);
        $row++;

        $sheet->setCellValue('A'.$row, '7. Banai');
        $sheet->setCellValue('B'.$row, 'Banai');
        $sheet->setCellValue('C'.$row, '9:00am - 10:30am');
        $sheet->setCellValue('D'.$row, 250);
        $sheet->setCellValue('E'.$row, 'Whole team proceeds to Banai.');
        $sheet->getStyle("A{$row}:E{$row}")->getFont()->setSize(10);
        $row += 2;

        // Team Delta
        $sheet->setCellValue('A'.$row, 'TEAM DELTA (GIAWH PM - Leaves 2:00pm)');
        $sheet->mergeCells("A{$row}:E{$row}");
        $sheet->getStyle("A{$row}")->getFont()->setBold(true)->setSize(10);
        $row++;

        $sheet->setCellValue('A'.$row, '8. Sitio Pagkakaisa Zone');
        $sheet->setCellValue('B'.$row, 'Sitio Pagkakaisa Zone');
        $sheet->setCellValue('C'.$row, '2:00pm - 3:30pm');
        $sheet->setCellValue('D'.$row, 300);
        $sheet->setCellValue('E'.$row, 'Transport food via pedicab to reach Sitio Pagkakaisa.');
        $sheet->getStyle("A{$row}:E{$row}")->getFont()->setSize(10);
        $row++;

        $sheet->setCellValue('A'.$row, '9. Sucat Highway');
        $sheet->setCellValue('B'.$row, 'Sucat Highway');
        $sheet->setCellValue('C'.$row, '3:30pm - 4:30pm');
        $sheet->setCellValue('D'.$row, 300);
        $sheet->setCellValue('E'.$row, 'Whole team proceeds to Sucat Highway.');
        $sheet->getStyle("A{$row}:E{$row}")->getFont()->setSize(10);
        $row += 2;

        // Team Echo
        $sheet->setCellValue('A'.$row, 'TEAM ECHO (Tondo PM - Leaves 2:00pm)');
        $sheet->mergeCells("A{$row}:E{$row}");
        $sheet->getStyle("A{$row}")->getFont()->setBold(true)->setSize(10);
        $row++;

        $sheet->setCellValue('A'.$row, '10. Delpan');
        $sheet->setCellValue('B'.$row, 'Delpan');
        $sheet->setCellValue('C'.$row, '3:30pm - 4:30pm');
        $sheet->setCellValue('D'.$row, 220);
        $sheet->setCellValue('E'.$row, 'Whole team proceeds to Delpan.');
        $sheet->getStyle("A{$row}:E{$row}")->getFont()->setSize(10);
        $row += 2;

        // Team Foxtrot
        $sheet->setCellValue('A'.$row, 'TEAM FOXTROT (NL Muntinlupa - Leaves 2:00pm)');
        $sheet->mergeCells("A{$row}:E{$row}");
        $sheet->getStyle("A{$row}")->getFont()->setBold(true)->setSize(10);
        $row++;

        $sheet->setCellValue('A'.$row, '11. Paraiso (Alabang)');
        $sheet->setCellValue('B'.$row, 'Paraiso (Alabang)');
        $sheet->setCellValue('C'.$row, '2:00pm - 4:00pm');
        $sheet->setCellValue('D'.$row, 100);
        $sheet->setCellValue('E'.$row, 'Drop off Paraiso team before proceeding to Sunrise.');
        $sheet->getStyle("A{$row}:E{$row}")->getFont()->setSize(10);
        $row++;

        $sheet->setCellValue('A'.$row, '12. Sunrise (Bayanan)');
        $sheet->setCellValue('B'.$row, 'Sunrise (Bayanan)');
        $sheet->setCellValue('C'.$row, '2:00pm - 4:00pm');
        $sheet->setCellValue('D'.$row, 100);
        $sheet->setCellValue('E'.$row, 'Park vehicle. After feeding, pick up Paraiso team and return.');
        $sheet->getStyle("A{$row}:E{$row}")->getFont()->setSize(10);
        $row++;

        // Total PAX - 10pt Bold
        $row++;
        $sheet->setCellValue('A'.$row, 'TOTAL PAX:');
        $sheet->mergeCells("B{$row}:C{$row}");
        $sheet->setCellValue('D'.$row, 2390);
        $sheet->getStyle("A{$row}:E{$row}")->getFont()->setBold(true)->setSize(10);

        // Borders
        $sheet->getStyle("A4:E{$row}")->getBorders()->getAllBorders()->setBorderStyle(Border::BORDER_THIN);

        foreach (range('A', 'E') as $col) {
            $sheet->getColumnDimension($col)->setAutoSize(true);
        }

        $writer = new Xlsx($spreadsheet);
        $filename = 'nlcom-metro-world-child-feeding-'.date('Y-m-d-H-i-s').'.xlsx';

        ob_start();
        $writer->save('php://output');
        $content = ob_get_clean();

        return response($content, 200, [
            'Content-Type' => 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
            'Content-Disposition' => 'attachment; filename="'.$filename.'"',
        ]);
    }

    private function getStartDate(?string $dateRange): ?string
    {
        return match ($dateRange) {
            'month' => Carbon::now()->startOfMonth()->toDateString(),
            'quarter' => Carbon::now()->startOfQuarter()->toDateString(),
            'year' => Carbon::now()->startOfYear()->toDateString(),
            default => null,
        };
    }

    private function getMonthlyTrend(?string $startDate, ?string $department = null): array
    {
        $months = collect();
        $currentMonth = Carbon::now()->startOfMonth();

        if ($startDate) {
            $month = Carbon::parse($startDate)->startOfMonth();

            while ($month->lte($currentMonth)) {
                $months->push($month->copy());
                $month->addMonth();
            }
        } else {
            for ($i = 5; $i >= 0; $i--) {
                $months->push(Carbon::now()->subMonths($i));
            }
        }

        return $months->map(function ($month) use ($department) {
            $start = $month->copy()->startOfMonth();
            $end = $month->copy()->endOfMonth();

            $volunteerQuery = Volunteer::query()
                ->whereBetween('created_at', [$start, $end]);

            if ($department) {
                $volunteerQuery->whereHas('positions', fn ($q) => $q->where('name', $department));
            }

            $newVolunteers = $volunteerQuery->count();

            $attendanceQuery = Attendance::query()
                ->where('status', 'approved')
                ->whereBetween('date', [$start->toDateString(), $end->toDateString()]);

            if ($department) {
                $attendanceQuery->whereHas('volunteer.positions', fn ($q) => $q->where('name', $department));
            }

            $attendances = $attendanceQuery->get();

            return [
                'month' => $month->format('M'),
                'volunteers' => $newVolunteers,
                'hours' => round((float) $attendances->sum('hours'), 1),
                'tasks' => $attendances->count(),
            ];
        })->toArray();
    }

    private function getTopPerformers($volunteers, int $limit = 10)
    {
        return $volunteers->map(function ($volunteer) {
            $allAttendances = $volunteer->attendances;
            $approvedAttendances = $allAttendances->where('status', 'approved');

            $hoursServed = round((float) $approvedAttendances->sum('hours'), 1);
            $tasksCompleted = $approvedAttendances->count();
            $totalEntries = $allAttendances->count();
            $attendanceRate = $totalEntries > 0
                ? (int) round(($tasksCompleted / $totalEntries) * 100)
                : 0;

            $ratingBase = min(5, max(0, 2.5 + ($attendanceRate / 40) + min($hoursServed / 120, 1)));
            $rating = round($ratingBase, 1);

            return [
                'id' => $volunteer->volunteer_id,
                'name' => trim($volunteer->first_name.' '.$volunteer->last_name),
                'department' => $volunteer->positions->first()->name ?? 'Unassigned',
                'hoursServed' => $hoursServed,
                'attendanceRate' => $attendanceRate,
                'rating' => $rating,
            ];
        })
            ->sortByDesc('hoursServed')
            ->take($limit)
            ->values();
    }

    private function getRecentActivity(): array
    {
        $activities = collect();

        $recentVolunteers = Volunteer::query()
            ->latest()
            ->limit(3)
            ->get()
            ->map(fn ($v) => [
                'id' => $v->volunteer_id,
                'type' => 'registration',
                'description' => 'New volunteer registered',
                'volunteerName' => trim($v->first_name.' '.$v->last_name),
                'timestamp' => $v->created_at?->toIso8601String(),
            ]);

        $recentAttendance = Attendance::query()
            ->with('volunteer')
            ->latest()
            ->limit(2)
            ->get()
            ->map(fn ($a) => [
                'id' => $a->attendance_id,
                'type' => 'attendance',
                'description' => 'Marked '.$a->status,
                'volunteerName' => $a->volunteer ? trim($a->volunteer->first_name.' '.$a->volunteer->last_name) : 'Unknown',
                'timestamp' => $a->created_at?->toIso8601String(),
            ]);

        $recentRsvps = Rsvp::query()
            ->latest()
            ->limit(2)
            ->get()
            ->map(fn ($r) => [
                'id' => $r->rsvp_id,
                'type' => 'event',
                'description' => 'Event created: '.$r->title,
                'volunteerName' => 'System',
                'timestamp' => $r->created_at?->toIso8601String(),
            ]);

        return $activities
            ->concat($recentVolunteers)
            ->concat($recentAttendance)
            ->concat($recentRsvps)
            ->sortByDesc('timestamp')
            ->take(10)
            ->values()
            ->toArray();
    }

    private function getEventParticipation(?string $startDate): array
    {
        $rsvps = Rsvp::query()
            ->with('responses')
            ->withCount('responses')
            ->when($startDate, fn ($q) => $q->where('date', '>=', $startDate))
            ->get();

        $totalEvents = $rsvps->count();
        $totalResponses = $rsvps->sum('responses_count') ?: 0;
        $confirmedCount = $rsvps->map(fn ($r) => $r->responses->filter(fn ($resp) => $resp->attendance_status === 'checked_in')->count())->sum();

        $activeEvents = $rsvps->filter(fn ($r) => $r->status === 'active')->count();
        $closedEvents = $rsvps->filter(fn ($r) => $r->status === 'closed')->count();

        return [
            'totalEvents' => $totalEvents,
            'totalResponses' => $totalResponses,
            'confirmedCount' => $confirmedCount,
            'activeEvents' => $activeEvents,
            'closedEvents' => $closedEvents,
            'responseRate' => $totalEvents > 0 ? (int) round(($totalResponses / $totalEvents)) : 0,
            'events' => $rsvps->map(fn ($r) => [
                'id' => $r->rsvp_id,
                'title' => $r->title,
                'date' => $r->date,
                'responses' => $r->responses_count,
                'status' => $r->status,
            ])->take(10)->toArray(),
        ];
    }

    private function getSkillsDistribution(): array
    {
        $skills = Skill::query()
            ->withCount('volunteers')
            ->orderByDesc('volunteers_count')
            ->limit(10)
            ->get();

        $totalVolunteersWithSkills = DB::table('volunteer_skill')->distinct('volunteer_id')->count('volunteer_id');

        // Check if there's any skills data
        if ($skills->isEmpty()) {
            return [
                'totalSkills' => 0,
                'volunteersWithSkills' => 0,
                'skills' => [],
            ];
        }

        return [
            'totalSkills' => $skills->count(),
            'volunteersWithSkills' => $totalVolunteersWithSkills,
            'skills' => $skills->map(fn ($s) => [
                'name' => $s->name,
                'count' => $s->volunteers_count,
                'percentage' => $totalVolunteersWithSkills > 0
                    ? (int) round(($s->volunteers_count / $totalVolunteersWithSkills) * 100)
                    : 0,
            ])->toArray(),
        ];
    }

    private function getTrainingCompletion(): array
    {
        $trainings = Training::query()
            ->withCount('volunteers')
            ->orderByDesc('volunteers_count')
            ->limit(10)
            ->get();

        $totalVolunteers = Volunteer::query()->count();
        $volunteersWithTraining = DB::table('volunteer_training')->distinct('volunteer_id')->count('volunteer_id');

        return [
            'totalTrainings' => $trainings->count(),
            'volunteersWithTraining' => $volunteersWithTraining,
            'completionRate' => $totalVolunteers > 0 && $volunteersWithTraining > 0
                ? (int) round(($volunteersWithTraining / $totalVolunteers) * 100)
                : 0,
            'trainings' => $trainings->map(fn ($t) => [
                'name' => $t->name,
                'count' => $t->volunteers_count,
                'percentage' => $totalVolunteers > 0
                    ? (int) round(($t->volunteers_count / $totalVolunteers) * 100)
                    : 0,
            ])->toArray(),
        ];
    }

    private function getLifegroupDistribution(): array
    {
        $lifegroups = Lifegroup::query()
            ->withCount('volunteers')
            ->orderByDesc('volunteers_count')
            ->limit(10)
            ->get();

        $totalInLifegroups = $lifegroups->sum('volunteers_count');
        $leadersCount = DB::table('volunteer_lifegroup')->where('is_leader', true)->distinct('volunteer_id')->count('volunteer_id');

        return [
            'totalLifegroups' => $lifegroups->count(),
            'totalInLifegroups' => $totalInLifegroups,
            'leadersCount' => $leadersCount,
            'lifegroups' => $lifegroups->map(fn ($lg) => [
                'name' => $lg->name,
                'count' => $lg->volunteers_count,
            ])->toArray(),
        ];
    }

    private function getRetentionMetrics($volunteers): array
    {
        $now = Carbon::now();
        $threeMonthsAgo = $now->copy()->subMonths(3);
        $sixMonthsAgo = $now->copy()->subMonths(6);

        $threeMonthActive = $volunteers->filter(fn ($v) => $v->attendances->contains(fn ($a) => $a->status === 'approved' && $a->date && $a->date->gte($threeMonthsAgo)))->count();
        $sixMonthActive = $volunteers->filter(fn ($v) => $v->attendances->contains(fn ($a) => $a->status === 'approved' && $a->date && $a->date->gte($sixMonthsAgo)))->count();
        $totalVolunteers = $volunteers->count();
        $churnedCount = $totalVolunteers - $threeMonthActive;

        return [
            'totalVolunteers' => $totalVolunteers,
            'activeLast3Months' => $threeMonthActive,
            'activeLast6Months' => $sixMonthActive,
            'churnedCount' => $churnedCount,
            'retentionRate' => $totalVolunteers > 0 && $threeMonthActive > 0
                ? (int) round(($threeMonthActive / $totalVolunteers) * 100)
                : 0,
        ];
    }

    private function getHourlyTrends(?string $startDate): array
    {
        $attendances = Attendance::query()
            ->where('status', 'approved')
            ->when($startDate, fn ($q) => $q->where('date', '>=', $startDate))
            ->get()
            ->groupBy(fn ($a) => Carbon::parse($a->date)->format('N'));

        $days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
        $dayData = collect($days)->map(function ($day, $index) use ($attendances) {
            $dayNum = $index + 1;
            $dayAttendances = $attendances->get($dayNum) ?? collect();
            $hours = $dayAttendances->sum('hours');

            return [
                'day' => $day,
                'hours' => round((float) $hours, 1),
                'entries' => $dayAttendances->count(),
            ];
        });

        return $dayData->toArray();
    }

    private function generatePdfHtml(array $data): string
    {
        $html = '
        <!DOCTYPE html>
        <html>
        <head>
            <meta charset="UTF-8">
            <title>Volunteer Analytics Report</title>
            <style>
                body { font-family: Arial, sans-serif; padding: 20px; }
                h1 { color: #1e40af; margin-bottom: 5px; }
                h2 { color: #374151; border-bottom: 2px solid #e5e7eb; padding-bottom: 5px; margin-top: 25px; }
                .header { margin-bottom: 20px; }
                .meta { color: #6b7280; font-size: 12px; }
                .stats-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 15px; margin: 20px 0; }
                .stat-box { background: #f3f4f6; padding: 15px; border-radius: 8px; text-align: center; }
                .stat-value { font-size: 24px; font-weight: bold; color: #1e40af; }
                .stat-label { font-size: 12px; color: #6b7280; }
                table { width: 100%; border-collapse: collapse; margin: 15px 0; }
                th, td { padding: 10px; text-align: left; border-bottom: 1px solid #e5e7eb; }
                th { background: #f9fafb; font-weight: bold; }
                tr:hover { background: #f9fafb; }
                .section { margin: 25px 0; }
            </style>
        </head>
        <body>
            <div class="header">
                <h1>Volunteer Analytics Report</h1>
                <p class="meta">Generated: '.date('Y-m-d H:i:s').' | Date Range: '.htmlspecialchars(ucfirst((string) $data['dateRange']), ENT_QUOTES, 'UTF-8').'</p>
            </div>

            <h2>Overview</h2>
            <div class="stats-grid">
                <div class="stat-box">
                    <div class="stat-value">'.$data['totalVolunteers'].'</div>
                    <div class="stat-label">Total Volunteers</div>
                </div>
                <div class="stat-box">
                    <div class="stat-value">'.$data['activeVolunteers'].'</div>
                    <div class="stat-label">Active Volunteers</div>
                </div>
                <div class="stat-box">
                    <div class="stat-value">'.$data['totalHoursServed'].'</div>
                    <div class="stat-label">Hours Served</div>
                </div>
                <div class="stat-box">
                    <div class="stat-value">'.$data['totalTasksCompleted'].'</div>
                    <div class="stat-label">Tasks Completed</div>
                </div>
            </div>

            <h2>Department Breakdown</h2>
            <table>
                <thead>
                    <tr>
                        <th>Department</th>
                        <th>Count</th>
                    </tr>
                </thead>
                <tbody>
        ';

        foreach ($data['departmentBreakdown'] as $dept) {
            $html .= '<tr><td>'.htmlspecialchars($dept['name']).'</td><td>'.$dept['count'].'</td></tr>';
        }

        $html .= '
                </tbody>
            </table>

            <h2>Top Performers</h2>
            <table>
                <thead>
                    <tr>
                        <th>Name</th>
                        <th>Department</th>
                        <th>Hours Served</th>
                        <th>Attendance Rate</th>
                        <th>Rating</th>
                    </tr>
                </thead>
                <tbody>
        ';

        foreach ($data['topPerformers'] as $performer) {
            $html .= '<tr>';
            $html .= '<td>'.htmlspecialchars($performer['name']).'</td>';
            $html .= '<td>'.htmlspecialchars($performer['department']).'</td>';
            $html .= '<td>'.$performer['hoursServed'].'</td>';
            $html .= '<td>'.$performer['attendanceRate'].'%</td>';
            $html .= '<td>'.$performer['rating'].'</td>';
            $html .= '</tr>';
        }

        $html .= '
                </tbody>
            </table>

            <h2>Monthly Trend</h2>
            <table>
                <thead>
                    <tr>
                        <th>Month</th>
                        <th>New Volunteers</th>
                        <th>Hours</th>
                        <th>Tasks</th>
                    </tr>
                </thead>
                <tbody>
        ';

        foreach ($data['monthlyTrend'] as $trend) {
            $html .= '<tr>';
            $html .= '<td>'.htmlspecialchars($trend['month']).'</td>';
            $html .= '<td>'.$trend['volunteers'].'</td>';
            $html .= '<td>'.$trend['hours'].'</td>';
            $html .= '<td>'.$trend['tasks'].'</td>';
            $html .= '</tr>';
        }

        $html .= '
                </tbody>
            </table>
        </body>
        </html>
        ';

        return $html;
    }

    private function spreadsheetText(mixed $value): string
    {
        $text = (string) $value;

        return preg_match('/^[=+\-@]/', $text) === 1 ? "'".$text : $text;
    }

    private function generateEventScheduleHtml(): string
    {
        $html = '
        <!DOCTYPE html>
        <html>
        <head>
            <meta charset="UTF-8">
            <title>NLCOM x Metro World Child Feeding Operation</title>
            <style>
                body { font-family: Calibri, sans-serif; padding: 20px; }
                .title { font-size: 15pt; font-weight: bold; margin-bottom: 5px; }
                .date { font-size: 11pt; margin-bottom: 20px; }
                table { width: 100%; border-collapse: collapse; margin: 15px 0; font-size: 10pt; }
                th { font-size: 10pt; font-weight: bold; padding: 8px; text-align: left; border: 1px solid #000; background: #e5e7eb; }
                td { font-size: 10pt; padding: 8px; text-align: left; border: 1px solid #000; }
                .team-header { font-weight: bold; font-size: 10pt; background: #f3f4f6; }
                .separator { border-top: 2px solid #000; }
                .total { font-weight: bold; font-size: 10pt; }
            </style>
        </head>
        <body>
            <div class="title">NLCOM x Metro World Child Feeding Operation</div>
            <div class="date">November 22, 2025</div>

            <table>
                <thead>
                    <tr>
                        <th>TEAM & TIME DEPARTURE</th>
                        <th>LOCATION</th>
                        <th>TIME</th>
                        <th>NO. OF PAX</th>
                        <th>DETAILS</th>
                    </tr>
                </thead>
                <tbody>
                    <tr class="team-header">
                        <td colspan="5">TEAM ALPHA (NL Las Piñas - Leaves 7:30am)</td>
                    </tr>
                    <tr>
                        <td>1. Golden Acres (Talon 1)</td>
                        <td>Golden Acres (Talon 1)</td>
                        <td>8:00am - 9:30am</td>
                        <td>100</td>
                        <td>Drop off GA team before proceeding to VP. Wait after feeding.</td>
                    </tr>
                    <tr>
                        <td>2. Villa Pangarap (Talon 5)</td>
                        <td>Villa Pangarap (Talon 5)</td>
                        <td>8:00am - 9:30am</td>
                        <td>150</td>
                        <td>Park vehicle in VP. After feeding, pick up GA team and go to Annex.</td>
                    </tr>
                    <tr>
                        <td>3. Annex (Talon 5)</td>
                        <td>Annex (Talon 5)</td>
                        <td>9:00am - 12:00nn</td>
                        <td>150</td>
                        <td>Proceed after 2 sites before heading back to base.</td>
                    </tr>
                    <tr class="separator"><td colspan="5"></td></tr>
                    <tr class="team-header">
                        <td colspan="5">TEAM BRAVO (Tondo AM - Leaves 7:30am)</td>
                    </tr>
                    <tr>
                        <td>4. Market 3</td>
                        <td>Market 3</td>
                        <td>8:30am - 10:00am</td>
                        <td>200</td>
                        <td>Proceed to M3 until feeding. Then go to second site (NBBN).</td>
                    </tr>
                    <tr>
                        <td>5. NBBN</td>
                        <td>NBBN</td>
                        <td>11:00am - 12:30pm</td>
                        <td>170</td>
                        <td>Continue after M3 before heading back to base.</td>
                    </tr>
                    <tr class="separator"><td colspan="5"></td></tr>
                    <tr class="team-header">
                        <td colspan="5">TEAM CHARLIE (GIAWH AM - Leaves 8:30am)</td>
                    </tr>
                    <tr>
                        <td>6. Masville</td>
                        <td>Masville</td>
                        <td>9:00am - 12:00nn</td>
                        <td>350</td>
                        <td>Whole team proceeds to Masville.</td>
                    </tr>
                    <tr>
                        <td>7. Banai</td>
                        <td>Banai</td>
                        <td>9:00am - 10:30am</td>
                        <td>250</td>
                        <td>Whole team proceeds to Banai.</td>
                    </tr>
                    <tr class="separator"><td colspan="5"></td></tr>
                    <tr class="team-header">
                        <td colspan="5">TEAM DELTA (GIAWH PM - Leaves 2:00pm)</td>
                    </tr>
                    <tr>
                        <td>8. Sitio Pagkakaisa Zone</td>
                        <td>Sitio Pagkakaisa Zone</td>
                        <td>2:00pm - 3:30pm</td>
                        <td>300</td>
                        <td>Transport food via pedicab to reach Sitio Pagkakaisa.</td>
                    </tr>
                    <tr>
                        <td>9. Sucat Highway</td>
                        <td>Sucat Highway</td>
                        <td>3:30pm - 4:30pm</td>
                        <td>300</td>
                        <td>Whole team proceeds to Sucat Highway.</td>
                    </tr>
                    <tr class="separator"><td colspan="5"></td></tr>
                    <tr class="team-header">
                        <td colspan="5">TEAM ECHO (Tondo PM - Leaves 2:00pm)</td>
                    </tr>
                    <tr>
                        <td>10. Delpan</td>
                        <td>Delpan</td>
                        <td>3:30pm - 4:30pm</td>
                        <td>220</td>
                        <td>Whole team proceeds to Delpan.</td>
                    </tr>
                    <tr class="separator"><td colspan="5"></td></tr>
                    <tr class="team-header">
                        <td colspan="5">TEAM FOXTROT (NL Muntinlupa - Leaves 2:00pm)</td>
                    </tr>
                    <tr>
                        <td>11. Paraiso (Alabang)</td>
                        <td>Paraiso (Alabang)</td>
                        <td>2:00pm - 4:00pm</td>
                        <td>100</td>
                        <td>Drop off Paraiso team before proceeding to Sunrise.</td>
                    </tr>
                    <tr>
                        <td>12. Sunrise (Bayanan)</td>
                        <td>Sunrise (Bayanan)</td>
                        <td>2:00pm - 4:00pm</td>
                        <td>100</td>
                        <td>Park vehicle. After feeding, pick up Paraiso team and return.</td>
                    </tr>
                    <tr class="separator"><td colspan="5"></td></tr>
                    <tr class="total">
                        <td colspan="3">TOTAL PAX:</td>
                        <td>2390</td>
                        <td></td>
                    </tr>
                </tbody>
            </table>
        </body>
        </html>
        ';

        return $html;
    }
}
