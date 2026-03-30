export interface PollOption {
  id: number;
  timeSlot: string;
  votes: number;
  capacity: number;
}

export interface Poll {
  id: number;
  title: string;
  status: 'active' | 'closed' | 'draft';
  date: string;
  cutOffDay: string;
  cutOffTime: string;
  description: string;
  totalVotes: number;
  options: PollOption[];
  shareUrl?: string;
}
