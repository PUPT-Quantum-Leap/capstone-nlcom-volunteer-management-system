<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <title>Volunteer Attendance Report</title>
    <style>
        @page {
            size: A4 landscape;
            margin: 20px;
        }
        body {
            font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif;
            color: #334155;
            padding: 10px;
            font-size: 11px;
            line-height: 1.4;
        }
        .header {
            border-bottom: 2px solid #3b82f6;
            padding-bottom: 10px;
            margin-bottom: 20px;
        }
        .header-title {
            font-size: 20px;
            font-weight: bold;
            color: #1e40af;
            margin: 0 0 5px 0;
        }
        .meta {
            color: #64748b;
            font-size: 11px;
            margin: 0;
        }
        table {
            width: 100%;
            border-collapse: collapse;
            margin-top: 15px;
        }
        th {
            background-color: #1e40af;
            color: white;
            font-weight: bold;
            text-transform: uppercase;
            font-size: 9px;
            letter-spacing: 0.05em;
            padding: 8px 10px;
            text-align: left;
            border: 1px solid #e2e8f0;
        }
        td {
            padding: 8px 10px;
            border: 1px solid #e2e8f0;
            text-align: left;
        }
        tr:nth-child(even) {
            background-color: #f8fafc;
        }
        .status {
            font-weight: bold;
            text-transform: uppercase;
            font-size: 9px;
            padding: 2px 6px;
            border-radius: 4px;
            display: inline-block;
        }
        .status-present {
            background-color: #dcfce7;
            color: #15803d;
        }
        .status-absent {
            background-color: #fee2e2;
            color: #b91c1c;
        }
        .volunteer-name {
            font-weight: 600;
            color: #0f172a;
        }
        .volunteer-email {
            color: #64748b;
            font-size: 9px;
        }
        .footer {
            margin-top: 30px;
            text-align: center;
            font-size: 9px;
            color: #94a3b8;
            border-top: 1px solid #e2e8f0;
            padding-top: 10px;
        }
    </style>
</head>
<body>
    <div class="header">
        <h1 class="header-title">Volunteer Attendance Report</h1>
        <p class="meta">Generated: {{ $generated_at }} | Filter Date: {{ $date }} | Total Records: {{ count($records) }}</p>
    </div>

    <table>
        <thead>
            <tr>
                <th style="width: 25%;">Volunteer</th>
                <th style="width: 25%;">Email</th>
                <th style="width: 18%;">Department</th>
                <th style="width: 10%;">Check-In</th>
                <th style="width: 10%;">Check-Out</th>
                <th style="width: 12%;">Duration/Shift</th>
                <th style="width: 10%; text-align: center;">Status</th>
            </tr>
        </thead>
        <tbody>
            @forelse ($records as $record)
            <tr>
                <td>
                    <span class="volunteer-name">{{ $record['volunteer_name'] }}</span>
                </td>
                <td>
                    <span class="volunteer-email">{{ $record['volunteer_email'] }}</span>
                </td>
                <td>{{ $record['volunteer_department'] }}</td>
                <td>
                    @if ($record['checked_in_at'])
                        {{ \Carbon\Carbon::parse($record['checked_in_at'])->format('h:i A') }}
                    @else
                        —
                    @endif
                </td>
                <td>
                    @if ($record['checked_out_at'])
                        {{ \Carbon\Carbon::parse($record['checked_out_at'])->format('h:i A') }}
                    @else
                        —
                    @endif
                </td>
                <td>{{ $record['time_slot'] ?: '—' }}</td>
                <td style="text-align: center;">
                    @if ($record['attendance_status'] === 'checked_in')
                        <span class="status status-present">Present</span>
                    @else
                        <span class="status status-absent">Absent</span>
                    @endif
                </td>
            </tr>
            @empty
            <tr>
                <td colspan="7" style="text-align: center; color: #94a3b8; padding: 20px;">
                    No attendance records found.
                </td>
            </tr>
            @endforelse
        </tbody>
    </table>

    <div class="footer">
        ServeTrack Volunteer Management System &bull;
    </div>
</body>
</html>
