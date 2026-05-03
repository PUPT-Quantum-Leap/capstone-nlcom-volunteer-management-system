import {
  ChangeDetectionStrategy,
  Component,
  inject,
  OnInit,
  signal,
  computed,
  DestroyRef,
} from '@angular/core';
import { TitleCasePipe } from '@angular/common';
import { RsvpService } from '../../services/rsvp.service';
import { Rsvp, UserVote } from '../../models/rsvp';
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
  userVote?: UserVote | null;
  canEditVote?: boolean;
  remainingEdits?: number;
}

@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [TitleCasePipe],
  templateUrl: './polls.html',
  styleUrl: './polls.scss',
})
export class PollsComponent implements OnInit {
  private rsvpService = inject(RsvpService);
  private destroyRef = inject(DestroyRef);

  pollTab = signal<'active' | 'past'>('active');
  activePoll = signal<Poll | null>(null);
  pastPolls = signal<Poll[]>([]);
  selectedPastPoll = signal<Poll | null>(null);
  isLoading = signal(true);
  pollError = signal<string | null>(null);

  hasSubmittedVote = signal(false);
  selectedOptionId = signal<number | null>(null);
  userVotes = signal<Map<number, UserVote>>(new Map());

  isVoting = signal(false);
  voteError = signal<string | null>(null);
  isEditMode = signal(false);

  userVote = computed(() => this.activePoll()?.userVote ?? null);
  canEdit = computed(() => this.activePoll()?.canEditVote ?? false);
  remainingEdits = computed(() => this.activePoll()?.remainingEdits ?? 0);

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
          const activeRsvps = rsvps.filter((r: Rsvp) => r.status === 'active');
          const pastRsvps = rsvps.filter((r: Rsvp) => r.status === 'closed');

          const activePoll = activeRsvps.length > 0 ? this.mapRsvpToPoll(activeRsvps[0]) : null;
          this.activePoll.set(activePoll);

          if (activePoll?.userVote) {
            const votes = new Map(this.userVotes());
            votes.set(activePoll.id, activePoll.userVote);
            this.userVotes.set(votes);
            this.hasSubmittedVote.set(true);
            this.selectedOptionId.set(activePoll.userVote.timeSlotId);
          }

          this.pastPolls.set(pastRsvps.map((r: Rsvp) => this.mapRsvpToPoll(r)));
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
      userVote: rsvp.userVote,
      canEditVote: rsvp.canEditVote,
      remainingEdits: rsvp.remainingEdits,
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

  selectOption(optionId: number): void {
    if (this.hasSubmittedVote() && !this.isEditMode()) return;
    this.selectedOptionId.set(optionId);
    this.voteError.set(null);
  }

  submitPollVote(): void {
    const poll = this.activePoll();
    const optionId = this.selectedOptionId();
    if (!poll || optionId === null) return;

    this.isVoting.set(true);
    this.voteError.set(null);

    const isEditing = this.hasSubmittedVote() && this.isEditMode();
    const apiCall = isEditing
      ? this.rsvpService.updateRsvpResponse(poll.id, optionId)
      : this.rsvpService.vote(poll.id, optionId);

    apiCall.pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (response: { message: string; remaining_edits?: number }) => {
        this.hasSubmittedVote.set(true);
        this.isVoting.set(false);
        this.isEditMode.set(false);

        if (isEditing && response.remaining_edits !== undefined) {
          const remainingEdits = response.remaining_edits as number;
          this.activePoll.update((p) => {
            if (!p) return p;
            return {
              ...p,
              remainingEdits,
              canEditVote: remainingEdits > 0,
              userVote: p.userVote ? { ...p.userVote, remainingEdits } : undefined,
            };
          });
        }

        this.loadRsvpEvents();
      },
      error: (err: { error?: { message?: string } }) => {
        this.voteError.set(err?.error?.message ?? 'Failed to submit vote. Please try again.');
        this.isVoting.set(false);
      },
    });
  }

  enterEditMode(): void {
    if (!this.canEdit()) return;
    this.isEditMode.set(true);
    this.selectedOptionId.set(null);
    this.voteError.set(null);
  }

  cancelEditMode(): void {
    this.isEditMode.set(false);
    const userVote = this.userVote();
    if (userVote) {
      this.selectedOptionId.set(userVote.timeSlotId);
    }
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
    return this.userVotes().get(pollId)?.timeSlotId ?? null;
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

  getSelectedOptionTimeSlot(): string {
    const poll = this.activePoll();
    const optionId = this.selectedOptionId();
    if (!poll || optionId === null) return '';
    const option = poll.options.find((o) => o.id === optionId);
    return option?.timeSlot ?? '';
  }
}