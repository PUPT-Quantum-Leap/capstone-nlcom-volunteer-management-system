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

        $totalHoursServed = round((float) $attendances->sum('hours'), 2);
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
            ? round($topPerformers->avg('rating'), 2)
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

        $reportResponse = $this->reports($request);
        $reportData = $reportResponse->getData(true);

        if (! $reportData['success']) {
            return response()->json([
                'success' => false,
                'message' => 'Failed to generate report data.',
            ], 500);
        }

        $data = $reportData['data'];
        $data['dateRange'] = $request->query('dateRange', 'all');

        $html = $this->generatePdfHtml($data);

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

        $reportResponse = $this->reports($request);
        $reportData = $reportResponse->getData(true);

        if (! $reportData['success']) {
            return response()->json([
                'success' => false,
                'message' => 'Failed to generate report data.',
            ], 500);
        }

        $data = $reportData['data'];

        $spreadsheet = new Spreadsheet;
        $sheet = $spreadsheet->getActiveSheet();
        $sheet->setTitle('Analytics Report');

        $spreadsheet->getDefaultStyle()->getFont()->setName('Calibri');

        // Title
        $sheet->setCellValue('A1', 'Volunteer Analytics Report');
        $sheet->mergeCells('A1:E1');
        $sheet->getStyle('A1')->getFont()->setBold(true)->setSize(15);
        $sheet->getStyle('A1')
            ->getAlignment()
            ->setHorizontal(Alignment::HORIZONTAL_CENTER);

        $sheet->setCellValue('A2', 'Generated: '.date('Y-m-d H:i:s'));
        $sheet->mergeCells('A2:E2');
        $sheet->getStyle('A2')->getFont()->setSize(11);
        $sheet->getStyle('A2')
            ->getAlignment()
            ->setHorizontal(Alignment::HORIZONTAL_CENTER);

        // Overview section
        $sheet->setCellValue('A4', 'Overview');
        $sheet->getStyle('A4')->getFont()->setBold(true)->setSize(13);

        $sheet->setCellValue('A5', 'Metric');
        $sheet->setCellValue('B5', 'Value');
        $sheet->getStyle('A5:B5')->getFont()->setBold(true)->setSize(10);
        $sheet->getStyle('A5:B5')
            ->getFill()
            ->setFillType(Fill::FILL_SOLID)
            ->getStartColor()
            ->setARGB('FFe5e7eb');

        $overviewData = [
            ['Total Volunteers', $data['totalVolunteers']],
            ['Active Volunteers', $data['activeVolunteers']],
            ['Inactive Volunteers', $data['inactiveVolunteers']],
            ['Total Hours Served', $data['totalHoursServed']],
            ['Average Attendance Rate', $data['averageAttendanceRate'].'%'],
            ['Total Tasks Completed', $data['totalTasksCompleted']],
            ['Average Rating', $data['averageRating']],
        ];

        $row = 6;
        foreach ($overviewData as $item) {
            $sheet->setCellValue('A'.$row, $item[0]);
            $sheet->setCellValue('B'.$row, $item[1]);
            $sheet->getStyle("A{$row}:B{$row}")->getFont()->setSize(10);
            $row++;
        }

        // Department Breakdown
        $row += 1;
        $sheet->setCellValue('A'.$row, 'Department Breakdown');
        $sheet->getStyle('A'.$row)->getFont()->setBold(true)->setSize(13);
        $row++;

        $sheet->setCellValue('A'.$row, 'Department');
        $sheet->setCellValue('B'.$row, 'Count');
        $sheet->setCellValue('C'.$row, 'Percentage');
        $sheet->getStyle("A{$row}:C{$row}")
            ->getFont()->setBold(true)->setSize(10);
        $sheet->getStyle("A{$row}:C{$row}")
            ->getFill()->setFillType(Fill::FILL_SOLID)
            ->getStartColor()->setARGB('FFe5e7eb');
        $row++;

        foreach ($data['departmentBreakdown'] as $dept) {
            $sheet->setCellValue(
                'A'.$row, $this->spreadsheetText($dept['name'])
            );
            $sheet->setCellValue('B'.$row, $dept['count']);
            $sheet->setCellValue('C'.$row, $dept['percentage'].'%');
            $sheet->getStyle("A{$row}:C{$row}")->getFont()->setSize(10);
            $row++;
        }

        // Top Performers
        $row += 1;
        $sheet->setCellValue('A'.$row, 'Top Performers');
        $sheet->getStyle('A'.$row)->getFont()->setBold(true)->setSize(13);
        $row++;

        $sheet->setCellValue('A'.$row, 'Name');
        $sheet->setCellValue('B'.$row, 'Department');
        $sheet->setCellValue('C'.$row, 'Hours Served');
        $sheet->setCellValue('D'.$row, 'Attendance Rate');
        $sheet->setCellValue('E'.$row, 'Rating');
        $sheet->getStyle("A{$row}:E{$row}")
            ->getFont()->setBold(true)->setSize(10);
        $sheet->getStyle("A{$row}:E{$row}")
            ->getFill()->setFillType(Fill::FILL_SOLID)
            ->getStartColor()->setARGB('FFe5e7eb');
        $row++;

        foreach ($data['topPerformers'] as $performer) {
            $sheet->setCellValue(
                'A'.$row, $this->spreadsheetText($performer['name'])
            );
            $sheet->setCellValue(
                'B'.$row, $this->spreadsheetText($performer['department'])
            );
            $sheet->setCellValue('C'.$row, $performer['hoursServed']);
            $sheet->setCellValue('D'.$row, $performer['attendanceRate'].'%');
            $sheet->setCellValue('E'.$row, $performer['rating']);
            $sheet->getStyle("A{$row}:E{$row}")->getFont()->setSize(10);
            $row++;
        }

        // Monthly Trend
        $row += 1;
        $sheet->setCellValue('A'.$row, 'Monthly Trend');
        $sheet->getStyle('A'.$row)->getFont()->setBold(true)->setSize(13);
        $row++;

        $sheet->setCellValue('A'.$row, 'Month');
        $sheet->setCellValue('B'.$row, 'New Volunteers');
        $sheet->setCellValue('C'.$row, 'Hours');
        $sheet->setCellValue('D'.$row, 'Tasks');
        $sheet->getStyle("A{$row}:D{$row}")
            ->getFont()->setBold(true)->setSize(10);
        $sheet->getStyle("A{$row}:D{$row}")
            ->getFill()->setFillType(Fill::FILL_SOLID)
            ->getStartColor()->setARGB('FFe5e7eb');
        $row++;

        foreach ($data['monthlyTrend'] as $trend) {
            $sheet->setCellValue(
                'A'.$row, $this->spreadsheetText($trend['month'])
            );
            $sheet->setCellValue('B'.$row, $trend['volunteers']);
            $sheet->setCellValue('C'.$row, $trend['hours']);
            $sheet->setCellValue('D'.$row, $trend['tasks']);
            $sheet->getStyle("A{$row}:D{$row}")->getFont()->setSize(10);
            $row++;
        }

        $lastRow = $row - 1;

        // Borders for all data sections
        $sheet->getStyle("A5:B{$lastRow}")
            ->getBorders()->getAllBorders()
            ->setBorderStyle(Border::BORDER_THIN);

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
                'hours' => round((float) $attendances->sum('hours'), 2),
                'tasks' => $attendances->count(),
            ];
        })->toArray();
    }

    private function getTopPerformers($volunteers, int $limit = 10)
    {
        return $volunteers->map(function ($volunteer) {
            $allAttendances = $volunteer->attendances;
            $approvedAttendances = $allAttendances->where('status', 'approved');

            $hoursServed = round((float) $approvedAttendances->sum('hours'), 2);
            $tasksCompleted = $approvedAttendances->count();
            $totalEntries = $allAttendances->count();
            $attendanceRate = $totalEntries > 0
                ? (int) round(($tasksCompleted / $totalEntries) * 100)
                : 0;

            $ratingBase = min(5, max(0, 2.5 + ($attendanceRate / 40) + min($hoursServed / 120, 1)));
            $rating = round($ratingBase, 2);

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
                'hours' => round((float) $hours, 2),
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
