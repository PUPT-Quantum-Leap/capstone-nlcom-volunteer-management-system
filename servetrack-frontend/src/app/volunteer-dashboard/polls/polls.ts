import {
  ChangeDetectionStrategy,
  Component,
  inject,
  OnInit,
  signal,
  computed,
  DestroyRef,
} from '@angular/core';
import { NgClass } from '@angular/common';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { RsvpService } from '../../services/rsvp.service';
import { Rsvp, UserVote } from '../../models/rsvp';

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
  isCutoffPassed: boolean;
  options: PollOption[];
  totalResponses?: number;
  userVote?: UserVote | null;
  canEditVote?: boolean;
  remainingEdits?: number;
}

@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [NgClass],
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
  hasData = signal(false);
  pollError = signal<string | null>(null);

  // Pagination
  currentPage = signal(1);
  pageSize = 6;

  totalPages = computed(() => Math.max(1, Math.ceil(this.pastPolls().length / this.pageSize)));

  paginatedPastPolls = computed(() => {
    const start = (this.currentPage() - 1) * this.pageSize;
    return this.pastPolls().slice(start, start + this.pageSize);
  });

  visiblePages = computed(() => {
    const total = this.totalPages();
    const current = this.currentPage();
    const pages: (number | 'ellipsis')[] = [];

    if (total <= 5) {
      for (let i = 1; i <= total; i++) pages.push(i);
      return pages;
    }

    pages.push(1);
    if (current > 3) pages.push('ellipsis');
    const start = Math.max(2, current - 1);
    const end = Math.min(total - 1, current + 1);
    for (let i = start; i <= end; i++) pages.push(i);
    if (current < total - 2) pages.push('ellipsis');
    pages.push(total);

    return pages;
  });

  pastPollsStart = computed(() => (this.currentPage() - 1) * this.pageSize + 1);
  pastPollsEnd = computed(() => Math.min(this.currentPage() * this.pageSize, this.pastPolls().length));
  pastPollsTotal = computed(() => this.pastPolls().length);

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
    this.hydrateFromCache();
    this.reload();
  }

  private hydrateFromCache(): void {
    const cached = this.rsvpService.getCachedRsvps();
    if (!cached?.data?.length) return;

    this.hasData.set(true);
    this.applyRsvpData(cached.data);
  }

  reload(): void {
    this.loadRsvpEvents();
  }

  private loadRsvpEvents(): void {
    this.isLoading.set(true);
    this.pollError.set(null);

    this.rsvpService
      .getRsvps(100)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (response) => {
          this.applyRsvpData(response.data);
          this.isLoading.set(false);
          this.hasData.set(true);
        },
        error: () => {
          this.pollError.set('Failed to load RSVP events. Please try again later.');
          this.isLoading.set(false);
        },
      });
  }

  private applyRsvpData(rsvps: Rsvp[]): void {
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

    this.pastPolls.set(
      pastRsvps
        .map((r: Rsvp) => this.mapRsvpToPoll(r))
        .sort((a, b) => new Date(b.date ?? 0).getTime() - new Date(a.date ?? 0).getTime()),
    );
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
      isCutoffPassed: rsvp.isCutoffPassed,
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
    this.currentPage.set(1);
  }

  goToPage(page: number): void {
    if (page < 1 || page > this.totalPages()) return;
    this.currentPage.set(page);
  }

  nextPage(): void {
    this.goToPage(this.currentPage() + 1);
  }

  prevPage(): void {
    this.goToPage(this.currentPage() - 1);
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
    const targetDate = this.parseLocalISO(cutOffDay || date || '');
    const today = new Date();
    // Reset today to midnight for accurate day difference calculation
    today.setHours(0, 0, 0, 0);
    const targetDateMidnight = new Date(targetDate);
    targetDateMidnight.setHours(0, 0, 0, 0);
    
    const diffTime = targetDateMidnight.getTime() - today.getTime();
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

  getAttendanceStatus(poll: Poll): { label: string; cssClass: string; icon: 'attended' | 'absent' | 'no-vote' } {
    const vote = poll.userVote;
    if (!vote) {
      return { label: "Didn't Vote", cssClass: 'status-no-vote', icon: 'no-vote' };
    }
    const status = vote.attendanceStatus;
    if (status === 'checked_in' || status === 'checked_out') {
      return { label: 'Attended', cssClass: 'status-attended', icon: 'attended' };
    }
    if (status === 'no_show') {
      return { label: 'Absent', cssClass: 'status-absent', icon: 'absent' };
    }
    // 'registered' — voted but event hasn't occurred yet or status not updated
    return { label: 'Voted', cssClass: 'status-voted', icon: 'attended' };
  }

  private parseLocalISO(dateStr: string): Date {
    if (!dateStr) return new Date();
    const [year, month, day] = dateStr.split('-').map(Number);
    if (isNaN(year) || isNaN(month) || isNaN(day)) return new Date(dateStr);
    return new Date(year, month - 1, day);
  }
}