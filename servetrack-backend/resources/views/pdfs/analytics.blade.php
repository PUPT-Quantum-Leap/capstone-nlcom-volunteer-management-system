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
        <p class="meta">Generated: {{ date('Y-m-d H:i:s') }} | Date Range: {{ ucfirst($dateRange ?? 'all') }}</p>
    </div>

    <h2>Overview</h2>
    <div class="stats-grid">
        <div class="stat-box">
            <div class="stat-value">{{ $totalVolunteers }}</div>
            <div class="stat-label">Total Volunteers</div>
        </div>
        <div class="stat-box">
            <div class="stat-value">{{ $activeVolunteers }}</div>
            <div class="stat-label">Active Volunteers</div>
        </div>
        <div class="stat-box">
            <div class="stat-value">{{ $totalHoursServed }}</div>
            <div class="stat-label">Hours Served</div>
        </div>
        <div class="stat-box">
            <div class="stat-value">{{ $totalTasksCompleted }}</div>
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
            @foreach ($departmentBreakdown as $dept)
            <tr>
                <td>{{ htmlspecialchars($dept['name']) }}</td>
                <td>{{ $dept['count'] }}</td>
            </tr>
            @endforeach
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
            @foreach ($topPerformers as $performer)
            <tr>
                <td>{{ htmlspecialchars($performer['name']) }}</td>
                <td>{{ htmlspecialchars($performer['department']) }}</td>
                <td>{{ $performer['hoursServed'] }}</td>
                <td>{{ $performer['attendanceRate'] }}%</td>
                <td>{{ $performer['rating'] }}</td>
            </tr>
            @endforeach
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
            @foreach ($monthlyTrend as $trend)
            <tr>
                <td>{{ htmlspecialchars($trend['month']) }}</td>
                <td>{{ $trend['volunteers'] }}</td>
                <td>{{ $trend['hours'] }}</td>
                <td>{{ $trend['tasks'] }}</td>
            </tr>
            @endforeach
        </tbody>
    </table>
</body>
</html>
