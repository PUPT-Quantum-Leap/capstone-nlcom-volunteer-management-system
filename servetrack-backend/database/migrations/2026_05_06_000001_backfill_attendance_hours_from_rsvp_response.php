<?php

use App\Models\Attendance;
use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    /**
     * Run the migrations.
     *
     * Backfill attendance hours from RSVP response check-in/check-out times.
     */
    public function up(): void
    {
        $driver = DB::connection()->getDriverName();

        if (! Schema::hasColumn('attendances', 'rsvp_response_id')) {
            return;
        }

        // Update attendance records that have rsvp_response_id but hours = 0
        // First try using check-in/check-out times.
        if ($driver === 'mysql') {
            DB::statement('
                UPDATE attendances a
                JOIN rsvp_response rr ON a.rsvp_response_id = rr.rsvp_response_id
                SET a.hours = ROUND(TIMESTAMPDIFF(MINUTE, rr.checked_in_at, rr.checked_out_at) / 60, 2)
                WHERE a.hours = 0
                  AND rr.checked_in_at IS NOT NULL
                  AND rr.checked_out_at IS NOT NULL
            ');
        } else {
            $rows = Attendance::query()
                ->from('attendances', 'a')
                ->join('rsvp_response as rr', 'a.rsvp_response_id', '=', 'rr.rsvp_response_id')
                ->where('a.hours', 0)
                ->whereNotNull('rr.checked_in_at')
                ->whereNotNull('rr.checked_out_at')
                ->select('a.attendance_id', 'rr.checked_in_at', 'rr.checked_out_at')
                ->get();

            foreach ($rows as $row) {
                $checkedInAt = Carbon::parse($row->checked_in_at);
                $checkedOutAt = Carbon::parse($row->checked_out_at);

                $hours = round($checkedInAt->diffInMinutes($checkedOutAt) / 60, 2);

                if ($hours > 0) {
                    Attendance::query()
                        ->where('attendance_id', $row->attendance_id)
                        ->update(['hours' => $hours]);
                }
            }
        }

        // For records without check-in/check-out, use time_slot text to calculate hours
        // time_slot text format: "8:00 AM - 12:00 PM"
        $attendances = Attendance::query()
            ->from('attendances', 'a')
            ->join('rsvp_response as rr', 'a.rsvp_response_id', '=', 'rr.rsvp_response_id')
            ->join('time_slot as ts', 'rr.time_slot_id', '=', 'ts.time_slot_id')
            ->where('a.hours', 0)
            ->select('a.attendance_id', 'ts.text as time_slot_text')
            ->get();

        foreach ($attendances as $attendance) {
            $hours = $this->parseHoursFromTimeSlot($attendance->time_slot_text);
            if ($hours > 0) {
                Attendance::query()
                    ->where('attendance_id', $attendance->attendance_id)
                    ->update(['hours' => $hours]);
            }
        }

        // Also update attendance records that have rsvp_id but no rsvp_response_id
        // by finding the corresponding rsvp_response
        if ($driver === 'mysql') {
            DB::statement('
                UPDATE attendances a
                JOIN rsvp_response rr ON a.rsvp_id = rr.rsvp_id AND a.volunteer_id = rr.volunteer_id
                SET a.hours = ROUND(TIMESTAMPDIFF(MINUTE, rr.checked_in_at, rr.checked_out_at) / 60, 2),
                    a.rsvp_response_id = rr.rsvp_response_id
                WHERE a.hours = 0
                  AND a.rsvp_response_id IS NULL
                  AND rr.checked_in_at IS NOT NULL
                  AND rr.checked_out_at IS NOT NULL
            ');
        } else {
            $rows = Attendance::query()
                ->from('attendances', 'a')
                ->join('rsvp_response as rr', function ($join) {
                    $join->on('a.rsvp_id', '=', 'rr.rsvp_id')
                        ->on('a.volunteer_id', '=', 'rr.volunteer_id');
                })
                ->where('a.hours', 0)
                ->whereNull('a.rsvp_response_id')
                ->whereNotNull('rr.checked_in_at')
                ->whereNotNull('rr.checked_out_at')
                ->select('a.attendance_id', 'rr.rsvp_response_id', 'rr.checked_in_at', 'rr.checked_out_at')
                ->get();

            foreach ($rows as $row) {
                $checkedInAt = Carbon::parse($row->checked_in_at);
                $checkedOutAt = Carbon::parse($row->checked_out_at);

                $hours = round($checkedInAt->diffInMinutes($checkedOutAt) / 60, 2);

                Attendance::query()
                    ->where('attendance_id', $row->attendance_id)
                    ->update([
                        'hours' => $hours,
                        'rsvp_response_id' => $row->rsvp_response_id,
                    ]);
            }
        }
    }

    /**
     * Parse hours from time_slot text format like "8:00 AM - 12:00 PM" or "08:00 - 12:00"
     */
    private function parseHoursFromTimeSlot(string $timeSlotText): float
    {
        $timeSlotText = trim($timeSlotText);

        // Try 12-hour format with AM/PM: "8:00 AM - 12:00 PM"
        if (preg_match('/(\d{1,2}):(\d{2})\s*(AM|PM)\s*-\s*(\d{1,2}):(\d{2})\s*(AM|PM)/i', $timeSlotText, $matches)) {
            return $this->calculateHoursFrom12HourFormat($matches);
        }

        // Try 24-hour format without AM/PM: "08:00 - 12:00"
        if (preg_match('/(\d{1,2}):(\d{2})\s*-\s*(\d{1,2}):(\d{2})/', $timeSlotText, $matches)) {
            return $this->calculateHoursFrom24HourFormat($matches);
        }

        return 0;
    }

    /**
     * Calculate hours from 12-hour format match
     */
    private function calculateHoursFrom12HourFormat(array $matches): float
    {
        $startHour = (int) $matches[1];
        $startMin = (int) $matches[2];
        $startMeridiem = strtoupper($matches[3]);
        $endHour = (int) $matches[4];
        $endMin = (int) $matches[5];
        $endMeridiem = strtoupper($matches[6]);

        // Convert to 24-hour format
        if ($startMeridiem === 'PM' && $startHour !== 12) {
            $startHour += 12;
        } elseif ($startMeridiem === 'AM' && $startHour === 12) {
            $startHour = 0;
        }

        if ($endMeridiem === 'PM' && $endHour !== 12) {
            $endHour += 12;
        } elseif ($endMeridiem === 'AM' && $endHour === 12) {
            $endHour = 0;
        }

        return $this->calculateHoursFromMinutes($startHour, $startMin, $endHour, $endMin);
    }

    /**
     * Calculate hours from 24-hour format match
     */
    private function calculateHoursFrom24HourFormat(array $matches): float
    {
        $startHour = (int) $matches[1];
        $startMin = (int) $matches[2];
        $endHour = (int) $matches[3];
        $endMin = (int) $matches[4];

        return $this->calculateHoursFromMinutes($startHour, $startMin, $endHour, $endMin);
    }

    /**
     * Calculate hours from hour/minute values
     */
    private function calculateHoursFromMinutes(int $startHour, int $startMin, int $endHour, int $endMin): float
    {
        $startMinutes = $startHour * 60 + $startMin;
        $endMinutes = $endHour * 60 + $endMin;

        // Handle overnight shifts
        if ($endMinutes < $startMinutes) {
            $endMinutes += 24 * 60;
        }

        $hours = ($endMinutes - $startMinutes) / 60;

        return round($hours, 2);
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        // Cannot easily reverse this operation as we don't know the original values
        // Set all hours back to 0 as a safe rollback
        DB::statement('UPDATE attendances SET hours = 0 WHERE hours > 0');
    }
};
