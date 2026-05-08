export type AttendanceStatus = 'pending' | 'approved' | 'rejected';

export type AttendancePeriod = 'daily' | 'weekly' | 'monthly' | 'all' | 'custom';

export interface Attendance {
  attendance_id: number;
  volunteer_id: number;
  date: string;
  hours: number;
  description: string | null;
  location?: string | null;
  status: AttendanceStatus;
  created_by: number | null;
  created_at: string;
  updated_at: string;
}

export interface AttendanceStats {
  total_hours: number;
  total_entries: number;
  all_time: { hours: number; entries: number };
  daily: { hours: number; entries: number };
  weekly: { hours: number; entries: number };
  monthly: { hours: number; entries: number };
}

export interface CreateAttendancePayload {
  date: string;
  hours: number;
  description?: string;
}
