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
use PhpOffice\PhpSpreadsheet\Cell\DataType;
use PhpOffice\PhpSpreadsheet\Spreadsheet;
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

        $startDate = $this->getStartDate($dateRange);

        $volunteers = Volunteer::query()
            ->with(['positions:position_id,name', 'attendances'])
            ->when(
                $resolvedDepartmentId,
                fn ($q) => $q->whereHas(
        $activeCutoff = Carbon::now()->copy()->subDays(30);
        $attendanceStartDate = $startDate && $startDate->lt($activeCutoff)
            ? $startDate
            : $activeCutoff;

        $volunteers = Volunteer::query()
            ->with([
                'positions:position_id,name',
                'attendances' => fn ($query) => $query
                    ->where('status', 'approved')
                    ->where('date', '>=', $attendanceStartDate),
            ])
            ->when($department, fn ($q) => $q->whereHas('positions', fn ($pq) => $pq->where('name', $department)))
            ->get();

        $attendances = $volunteers
            ->flatMap->attendances
            ->when($startDate, fn ($collection) => $collection->filter(
                fn ($attendance) => $attendance->date && $attendance->date->gte($startDate)
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
            ->when($startDate, fn ($q) => $q->where('date', '>=', $startDate))
            ->count();
        $averageAttendanceRate = $totalAttendanceRecords > 0
            ? (int) round(($totalTasksCompleted / $totalAttendanceRecords) * 100)
            : 0;

        $positions = Position::query()
            ->when($department, fn ($q) => $q->where('name', $department))
            ->withCount('volunteers')
            ->get();
        $totalPositionVolunteers = $positions->sum('volunteers_count') ?: 1;
        $departmentBreakdown = $positions->map(function ($pos) use ($totalPositionVolunteers) {
            return [
                'name' => $pos->name,
                'count' => $pos->volunteers_count,
                'percentage' => $totalPositionVolunteers > 0
                    ? (int) round(($pos->volunteers_count / $totalPositionVolunteers) * 100)
                    : 0,
            ];
        })->filter(fn ($d) => $d['count'] > 0)->values();

        $monthlyTrend = $this->getMonthlyTrend($startDate, $department);

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

        return response()->json([
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
        ]);
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

        $dateRange = $request->query('dateRange', 'all');
        $departmentId = $request->query('departmentId');
        $startDate = $this->getStartDate($dateRange);

        $volunteers = Volunteer::query()
            ->with(['positions:position_id,name', 'attendances'])
            ->when($departmentId, fn ($q) => $q->whereHas('positions', fn ($pq) => $pq->where('position_id', $departmentId)))
            ->get();

        $volunteerIds = $volunteers->pluck('volunteer_id');

        $attendances = Attendance::query()
            ->where('status', 'approved')
            ->whereIn('volunteer_id', $volunteerIds)
            ->when($startDate, fn ($q) => $q->where('date', '>=', $startDate))
            ->get();

        $totalVolunteers = $volunteers->count();
        $activeCutoff = Carbon::now()->copy()->subDays(30);
        $activeVolunteers = $volunteers->filter(function ($v) use ($activeCutoff) {
            return $v->attendances->contains(function ($a) use ($activeCutoff) {
                return $a->status === 'approved' && $a->date && $a->date->gte($activeCutoff);
            });
        })->count();

        $totalHoursServed = round((float) $attendances->sum('hours'), 1);
        $totalTasksCompleted = $attendances->count();

        $positions = Position::query()
            ->when($departmentId, fn ($q) => $q->where('position_id', $departmentId))
            ->withCount('volunteers')
            ->get();
        $topPerformers = $this->getTopPerformers($volunteers, 10);

        $monthlyTrend = $this->getMonthlyTrend($startDate, $departmentId);

        $html = $this->generatePdfHtml([
            'totalVolunteers' => $totalVolunteers,
            'activeVolunteers' => $activeVolunteers,
            'inactiveVolunteers' => $totalVolunteers - $activeVolunteers,
            'totalHoursServed' => $totalHoursServed,
            'totalTasksCompleted' => $totalTasksCompleted,
            'departmentBreakdown' => $positions->map(fn ($p) => [
                'name' => $p->name,
                'count' => $p->volunteers_count,
            ]),
            'topPerformers' => $topPerformers,
            'monthlyTrend' => $monthlyTrend,
            'dateRange' => $dateRange,
        ]);

        $dompdf = new Dompdf;
        $dompdf->loadHtml($html);
        $dompdf->setPaper('A4', 'portrait');
        $dompdf->render();

        $filename = 'volunteer-analytics-'.date('Y-m-d-H-i-s').'.pdf';

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

        $dateRange = $request->query('dateRange', 'all');
        $departmentId = $request->query('departmentId');
        $startDate = $this->getStartDate($dateRange);

        $volunteers = Volunteer::query()
            ->with(['positions:position_id,name', 'attendances'])
            ->when($departmentId, fn ($q) => $q->whereHas('positions', fn ($pq) => $pq->where('position_id', $departmentId)))
            ->get();

        $volunteerIds = $volunteers->pluck('volunteer_id');

        $attendances = Attendance::query()
            ->where('status', 'approved')
            ->whereIn('volunteer_id', $volunteerIds)
            ->when($startDate, fn ($q) => $q->where('date', '>=', $startDate))
            ->get();

        $positions = Position::query()
            ->when($departmentId, fn ($q) => $q->where('position_id', $departmentId))
            ->withCount('volunteers')
            ->get();
        $topPerformers = $this->getTopPerformers($volunteers, 10);
        $monthlyTrend = $this->getMonthlyTrend($startDate, $departmentId);

        $spreadsheet = new Spreadsheet;
        $sheet = $spreadsheet->getActiveSheet();
        $sheet->setTitle('Overview');

        $sheet->setCellValue('A1', 'Volunteer Analytics Report');
        $sheet->setCellValue('A2', 'Generated: '.date('Y-m-d H:i:s'));
        $sheet->setCellValue('A3', 'Date Range: '.ucfirst($dateRange));

        $sheet->setCellValue('A5', 'Metric');
        $sheet->setCellValue('B5', 'Value');
        $sheet->setCellValue('A6', 'Total Volunteers');
        $sheet->setCellValue('B6', $volunteers->count());
        $sheet->setCellValue('A7', 'Active Volunteers');
        $sheet->setCellValue('B7', $volunteers->filter(fn ($v) => $v->attendances->contains(fn ($a) => $a->status === 'approved' && $a->date && $a->date->gte(Carbon::now()->subDays(30))))->count());
        $sheet->setCellValue('A8', 'Total Hours Served');
        $sheet->setCellValue('B8', round((float) $attendances->sum('hours'), 1));
        $sheet->setCellValue('A9', 'Total Tasks Completed');
        $sheet->setCellValue('B9', $attendances->count());

        $sheet->setCellValue('A11', 'Department Breakdown');
        $sheet->setCellValue('A12', 'Department');
        $sheet->setCellValue('B12', 'Count');
        $row = 13;
        foreach ($positions as $position) {
            $sheet->setCellValueExplicit('A'.$row, $this->spreadsheetText($position->name), DataType::TYPE_STRING);
            $sheet->setCellValue('B'.$row, $position->volunteers_count);
            $row++;
        }

        $row += 2;
        $sheet->setCellValue('A'.$row, 'Top Performers');
        $row++;
        $sheet->setCellValue('A'.$row, 'Name');
        $sheet->setCellValue('B'.$row, 'Department');
        $sheet->setCellValue('C'.$row, 'Hours Served');
        $sheet->setCellValue('D'.$row, 'Attendance Rate');
        $sheet->setCellValue('E'.$row, 'Rating');
        $row++;
        foreach ($topPerformers as $performer) {
            $sheet->setCellValueExplicit('A'.$row, $this->spreadsheetText($performer['name']), DataType::TYPE_STRING);
            $sheet->setCellValueExplicit('B'.$row, $this->spreadsheetText($performer['department']), DataType::TYPE_STRING);
            $sheet->setCellValue('C'.$row, $performer['hoursServed']);
            $sheet->setCellValueExplicit('D'.$row, $this->spreadsheetText($performer['attendanceRate'].'%'), DataType::TYPE_STRING);
            $sheet->setCellValue('E'.$row, $performer['rating']);
            $row++;
        }

        $row += 2;
        $sheet->setCellValue('A'.$row, 'Monthly Trend');
        $row++;
        $sheet->setCellValue('A'.$row, 'Month');
        $sheet->setCellValue('B'.$row, 'New Volunteers');
        $sheet->setCellValue('C'.$row, 'Hours');
        $sheet->setCellValue('D'.$row, 'Tasks');
        $row++;
        foreach ($monthlyTrend as $trend) {
            $sheet->setCellValueExplicit('A'.$row, $this->spreadsheetText($trend['month']), DataType::TYPE_STRING);
            $sheet->setCellValue('B'.$row, $trend['volunteers']);
            $sheet->setCellValue('C'.$row, $trend['hours']);
            $sheet->setCellValue('D'.$row, $trend['tasks']);
            $row++;
        }

        foreach (range('A', 'E') as $col) {
            $sheet->getColumnDimension($col)->setAutoSize(true);
        }

        $writer = new Xlsx($spreadsheet);
        $filename = 'volunteer-analytics-'.date('Y-m-d-H-i-s').'.xlsx';

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
            ->groupBy(fn ($a) => $a->date?->format('N'));

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
}
