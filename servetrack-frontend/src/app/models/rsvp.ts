export interface Location {
  id: number;
  name: string;
  address: string;
  displayName: string;
}

export interface Rsvp {
  id: number;
  slug: string;
  title: string;
  date: string;
  eventLocation?: string;
  location?: Location | null;
  shareUrl?: string;
  cutOffDay: string;
  cutOffTime: string;
  description: string;
  status: 'active' | 'closed' | 'draft';
  isCutoffPassed: boolean;
  totalResponses: number;
  createdAt: string;
  shifts: RsvpShift[];
  userVote?: UserVote | null;
  canEditVote?: boolean;
  remainingEdits?: number;
}

export interface UserVote {
  timeSlotId: number;
  votedAt: string;
  editCount: number;
  remainingEdits: number;
}

export interface RsvpShift {
  id: number;
  text?: string;
  timeSlot: string;
  responses: number;
  capacity: number;
  selected?: boolean;
}

export interface RsvpResponse {
  id: number;
  volunteerId: number;
  rsvpId: number;
  timeSlotId: number;
  votedAt: string;
  createdAt: string;
  editCount: number;
  remainingEdits: number;
  lastEditedAt?: string;
  editHistory: EditHistoryItem[];
}

export interface EditHistoryItem {
  oldTimeSlotId: number;
  newTimeSlotId: number;
  editedAt: string;
}

export interface RsvpNotification {
  id: number;
  type: 'event_created' | 'event_updated' | 'reminder';
  message: string;
  rsvpId: number;
  rsvpTitle: string;
  rsvpDate: string;
  rsvpSlug: string;
  readAt: string | null;
  isRead: boolean;
  emailSent: boolean;
  createdAt: string;
}

export interface CreateRsvpDto {
  title: string;
  date: string;
  eventLocation?: string;
  cutOffDay: string;
  cutOffTime: string;
  description: string;
  shifts: CreateRsvpShiftDto[];
}

export interface CreateRsvpShiftDto {
  text?: string;
  timeSlot: string;
  capacity: number;
}
