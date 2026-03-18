export interface Rsvp {
  id: number;
  title: string;
  date: string;
  eventLocation?: string;
  cutOffDay: string;
  cutOffTime: string;
  description: string;
  status: 'active' | 'closed' | 'draft';
  totalResponses: number;
  createdAt: string;
  shifts: RsvpShift[];
}

export interface RsvpShift {
  id: number;
  text?: string;
  timeSlot: string;
  responses: number;
  capacity: number;
  selected?: boolean;
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
