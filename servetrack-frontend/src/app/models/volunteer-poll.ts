export interface VolunteerPollOption {
  id: number;
  text: string;
}

export interface VolunteerPoll {
  id: number;
  title: string;
  totalVotes: number;
  startDate: string;
  endDate: string;
  status: 'active' | 'closed' | 'upcoming';
  hasVoted: boolean;
  options: VolunteerPollOption[];
}
