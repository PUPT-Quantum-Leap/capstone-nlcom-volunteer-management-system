import {
  ChangeDetectionStrategy,
  Component,
  inject,
  OnInit,
  signal,
  DestroyRef,
} from '@angular/core';
import { DatePipe, TitleCasePipe } from '@angular/common';
import { VolunteerService } from '../../services/volunteer.service';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { finalize } from 'rxjs';

interface PollOption {
  id: number;
  timeSlot: string;
  capacity: number;
  votes: number;
}

interface Poll {
  id: number;
  title: string;
  description?: string;
  date?: string;
  cutOffDay?: string;
  status: 'draft' | 'active' | 'closed';
  options: PollOption[];
}

@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [DatePipe, TitleCasePipe],
  templateUrl: './polls.html',
  styleUrl: './polls.scss',
})
export class PollsComponent implements OnInit {
  private volunteerService = inject(VolunteerService);
  private destroyRef = inject(DestroyRef);

  // ── Poll State ──────────────────────────────────────────────────────────
  pollTab = signal<'active' | 'past'>('active');
  activePoll = signal<Poll | null>(null);
  pastPolls = signal<Poll[]>([]);
  selectedPastPoll = signal<Poll | null>(null);

  // ── Voting State ─────────────────────────────────────────────────────────
  hasSubmittedVote = signal(false);
  selectedOptionId = signal<number | null>(null);
  isLoading = signal(false);
  pollError = signal<string | null>(null);

  ngOnInit(): void {
    this.loadSamplePolls();
  }

  private loadSamplePolls(): void {
    // Sample active poll
    this.activePoll.set({
      id: 1,
      title: 'March 2026 Outreach Assignment Preferences',
      description: 'Select your preferred time slot for the upcoming community outreach event.',
      date: '2026-03-15',
      cutOffDay: '2026-03-10',
      status: 'active',
      options: [
        { id: 1, timeSlot: 'Morning Shift (6:00 AM - 12:00 PM)', votes: 12, capacity: 20 },
        { id: 2, timeSlot: 'Afternoon Shift (12:00 PM - 6:00 PM)', votes: 8, capacity: 15 },
        { id: 3, timeSlot: 'Evening Shift (6:00 PM - 10:00 PM)', votes: 5, capacity: 10 },
      ],
    });

    // Sample past polls
    this.pastPolls.set([
      {
        id: 2,
        title: 'February 2026 Relief Operation Schedule',
        description: 'Preferred schedule for the disaster relief operation.',
        date: '2026-02-20',
        cutOffDay: '2026-02-15',
        status: 'closed',
        options: [
          { id: 4, timeSlot: 'Weekday Morning', votes: 25, capacity: 30 },
          { id: 5, timeSlot: 'Weekend Full Day', votes: 35, capacity: 40 },
          { id: 6, timeSlot: 'Weekday Evening', votes: 15, capacity: 20 },
        ],
      },
      {
        id: 3,
        title: 'January 2026 Medical Mission Schedule',
        description: 'Select your availability for the medical mission.',
        date: '2026-01-18',
        cutOffDay: '2026-01-12',
        status: 'closed',
        options: [
          { id: 7, timeSlot: 'Day 1 - Morning', votes: 18, capacity: 25 },
          { id: 8, timeSlot: 'Day 1 - Afternoon', votes: 12, capacity: 20 },
          { id: 9, timeSlot: 'Day 2 - Morning', votes: 20, capacity: 25 },
          { id: 10, timeSlot: 'Day 2 - Afternoon', votes: 15, capacity: 20 },
        ],
      },
      {
        id: 4,
        title: 'December 2025 Christmas Outreach',
        description: 'Volunteer shifts for the annual Christmas outreach event.',
        date: '2025-12-20',
        cutOffDay: '2025-12-15',
        status: 'closed',
        options: [
          { id: 11, timeSlot: 'Gift Distribution - Morning', votes: 30, capacity: 35 },
          { id: 12, timeSlot: 'Food Preparation', votes: 20, capacity: 25 },
          { id: 13, timeSlot: 'Entertainment & Activities', votes: 15, capacity: 20 },
        ],
      },
    ]);
  }

  setPollTab(tab: 'active' | 'past'): void {
    this.pollTab.set(tab);
    this.selectedPastPoll.set(null);
  }

  selectPastPoll(poll: Poll): void {
    this.selectedPastPoll.set(poll);
  }

  closePastPollDetail(): void {
    this.selectedPastPoll.set(null);
  }

  isOptionFull(option: PollOption): boolean {
    return option.votes >= option.capacity;
  }

  submitPollVote(): void {
    const poll = this.activePoll();
    const optionId = this.selectedOptionId();
    if (!poll || optionId === null) return;

    this.isLoading.set(true);
    this.pollError.set(null);

    // Simulate API call
    setTimeout(() => {
      this.hasSubmittedVote.set(true);
      this.isLoading.set(false);
    }, 1000);
  }

  getVotePercentage(option: PollOption, poll: Poll): number {
    const totalVotes = poll.options.reduce((sum, opt) => sum + opt.votes, 0);
    if (totalVotes === 0) return 0;
    return Math.round((option.votes / totalVotes) * 100);
  }

  getTotalVotes(poll: Poll): number {
    return poll.options.reduce((sum, opt) => sum + opt.votes, 0);
  }

  getMostVotedOption(poll: Poll): PollOption | null {
    if (poll.options.length === 0) return null;
    return poll.options.reduce((max, opt) => (opt.votes > max.votes ? opt : max), poll.options[0]);
  }

  hasUserVotedOnPoll(pollId: number): boolean {
    // Mock function - in real implementation, this would check against user votes
    return pollId === 2;
  }

  getDaysUntilClosing(cutOffDay: string | undefined, date: string | undefined): string {
    if (!cutOffDay && !date) return '';
    const targetDate = new Date(cutOffDay || date || '');
    const today = new Date();
    const diffTime = targetDate.getTime() - today.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    if (diffDays < 0) return 'Poll has closed';
    if (diffDays === 0) return 'Closes today';
    if (diffDays === 1) return 'Closes tomorrow';
    return `${diffDays} days left to vote`;
  }
}
