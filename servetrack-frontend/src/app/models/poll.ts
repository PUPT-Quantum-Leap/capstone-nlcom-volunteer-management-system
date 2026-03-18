export interface Poll {
  id: number;
  title: string;
  date: string;
  cutOffDay: string;
  cutOffTime: string;
  description: string;
  status: 'active' | 'closed' | 'draft';
  shareUrl?: string;
  totalVotes: number;
  createdAt: string;
  options: PollOption[];
}

export interface PollOption {
  id: number;
  timeSlot: string;
  votes: number;
  capacity: number;
  selected?: boolean;
}

export interface CreatePollDto {
  title: string;
  date: string;
  cutOffDay: string;
  cutOffTime: string;
  description: string;
  options: CreatePollOptionDto[];
}

export interface CreatePollOptionDto {
  timeSlot: string;
  capacity: number;
}
