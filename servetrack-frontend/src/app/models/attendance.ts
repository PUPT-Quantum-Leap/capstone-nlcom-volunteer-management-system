export type AttendanceStatus = 'pending' | 'approved' | 'rejected';

export type AttendancePeriod = 'daily' | 'weekly' | 'monthly';

export type Attendance = {
  attendance_id: number;
  volunteer_id: number;
  date: string;
  hours: number;
  description: string | null;
  status: AttendanceStatus;
  created_by: number | null;
  created_at: string;
  updated_at: string;
};

export type AttendanceStats = {
  total_hours: number;
  total_entries: number;
  daily: { hours: number; entries: number };
  weekly: { hours: number; entries: number };
  monthly: { hours: number; entries: number };
};

export type CreateAttendancePayload = {
  date: string;
  hours: number;
  description?: string;
};
