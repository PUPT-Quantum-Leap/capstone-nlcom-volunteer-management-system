import {
  ChangeDetectionStrategy,
  Component,
  inject,
  OnInit,
  signal,
  DestroyRef,
} from '@angular/core';
import { DatePipe, TitleCasePipe } from '@angular/common';
import { RsvpService } from '../../services/rsvp.service';
import { Rsvp } from '../../models/rsvp';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';

interface PollOption {
  id: number;
  timeSlot: string;
  capacity: number;
  votes: number;
}

interface Poll {
  id: number;
  slug: string;
  title: string;
  description?: string;
  date?: string;
  cutOffDay?: string;
  status: 'draft' | 'active' | 'closed';
  options: PollOption[];
  totalResponses?: number;
}

@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [DatePipe, TitleCasePipe],
  templateUrl: './polls.html',
  styleUrl: './polls.scss',
})
export class PollsComponent implements OnInit {
  private rsvpService = inject(RsvpService);
  private destroyRef = inject(DestroyRef);

  // ── Poll State ──────────────────────────────────────────────────────────
  pollTab = signal<'active' | 'past'>('active');
  activePoll = signal<Poll | null>(null);
  pastPolls = signal<Poll[]>([]);
  selectedPastPoll = signal<Poll | null>(null);
  isLoading = signal(true);
  pollError = signal<string | null>(null);

  // ── Voting State ─────────────────────────────────────────────────────────
  hasSubmittedVote = signal(false);
  selectedOptionId = signal<number | null>(null);
  userVotes = signal<Map<number, number>>(new Map());

  ngOnInit(): void {
    this.loadRsvpEvents();
  }

  private loadRsvpEvents(): void {
    this.isLoading.set(true);
    this.pollError.set(null);

    this.rsvpService
      .getRsvps()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (response) => {
          const rsvps: Rsvp[] = response.data;
          const activeRsvps = rsvps.filter((r) => r.status === 'active');
          const pastRsvps = rsvps.filter((r) => r.status === 'closed');

          this.activePoll.set(activeRsvps.length > 0 ? this.mapRsvpToPoll(activeRsvps[0]) : null);
          this.pastPolls.set(pastRsvps.map((r) => this.mapRsvpToPoll(r)));
          this.isLoading.set(false);
        },
        error: () => {
          this.pollError.set('Failed to load RSVP events. Please try again later.');
          this.isLoading.set(false);
        },
      });
  }

  private mapRsvpToPoll(rsvp: Rsvp): Poll {
    return {
      id: rsvp.id,
      slug: rsvp.slug,
      title: rsvp.title,
      description: rsvp.description,
      date: rsvp.date,
      cutOffDay: rsvp.cutOffDay,
      status: rsvp.status,
      totalResponses: rsvp.totalResponses,
      options: rsvp.shifts.map((shift) => ({
        id: shift.id,
        timeSlot: shift.timeSlot,
        capacity: shift.capacity,
        votes: shift.responses,
      })),
    };
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
    return this.userVotes().has(pollId);
  }

  getUserSelectedOption(pollId: number): number | null {
    return this.userVotes().get(pollId) ?? null;
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
