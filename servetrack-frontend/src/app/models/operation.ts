export type OperationSite = {
  siteNo: number;
  location: string;
  time: string;
  pax: number;
  team: string;
  baseLocation: string;
  details: string;
};

export type OperationTeam = {
  name: string;
  baseLocation: string;
  departureTime: string;
  totalPax: number;
  sites: OperationSite[];
};

export type NLCOMOperation = {
  date: string;
  totalPax: number;
  teams: OperationTeam[];
  allSites: OperationSite[];
};

export type DashboardView =
  | 'overview'
  | 'volunteers'
  | 'attendance'
  | 'performance'
  | 'rsvps'
  | 'ics'
  | 'users'
  | 'analytics'
  | 'events'
  | 'sms'
  | 'backup';

export type EventModuleCard = {
  label: string;
  value: number;
  helper: string;
};

export type BackupRecord = {
  id: number;
  name: string;
  file_path: string;
  size_bytes: number;
  type: 'automatic' | 'manual';
  status: 'pending' | 'in_progress' | 'completed' | 'failed';
  description: string | null;
  completed_at: string | null;
  error_message: string | null;
  created_at: string;
  updated_at: string;
};

export type AttendanceRecord = {
  id: number;
  volunteerName: string;
  email: string;
  department: string;
  checkInTime: string | null;
  checkOutTime: string | null;
  duration: string | null;
  status: 'present' | 'absent';
};