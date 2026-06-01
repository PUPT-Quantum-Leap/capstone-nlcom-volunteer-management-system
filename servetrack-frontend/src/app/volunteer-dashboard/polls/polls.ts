import {
  ChangeDetectionStrategy,
  Component,
  inject,
  OnInit,
  signal,
  computed,
  output,
  DestroyRef,
} from '@angular/core';
import { NgClass } from '@angular/common';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { RsvpService } from '../../services/rsvp.service';
import { Rsvp, UserVote, Location } from '../../models/rsvp';
import { MapViewComponent } from '../../components/map-view/map-view';

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
  eventLocation?: string;
  location?: Location | null;
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
  imports: [NgClass, MapViewComponent],
  templateUrl: './polls.html',
  styleUrl: './polls.scss',
})
export class PollsComponent implements OnInit {
  private rsvpService = inject(RsvpService);
  private   destroyRef = inject(DestroyRef);

  showSnackbar = output<{ message: string; type: 'success' | 'error' | 'info' }>();

  pollTab = signal<'active' | 'past'>('active');
  activePolls = signal<Poll[]>([]);
  selectedActivePoll = signal<Poll | null>(null);
  pastPolls = signal<Poll[]>([]);
  selectedPastPoll = signal<Poll | null>(null);
  isLoading = signal(true);
  hasData = signal(false);
  pollError = signal<string | null>(null);

  // Dual-tab Pagination
  activePage = signal(1);
  pastPage = signal(1);
  pageSize = 6;

  // --- Active Polls Pagination ---
  activeTotalPages = computed(() => Math.max(1, Math.ceil(this.activePolls().length / this.pageSize)));
  paginatedActivePolls = computed(() => {
    const start = (this.activePage() - 1) * this.pageSize;
    return this.activePolls().slice(start, start + this.pageSize);
  });
  activeVisiblePages = computed(() => {
    const total = this.activeTotalPages();
    const current = this.activePage();
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
  activePollsStart = computed(() => (this.activePage() - 1) * this.pageSize + 1);
  activePollsEnd = computed(() => Math.min(this.activePage() * this.pageSize, this.activePolls().length));
  activePollsTotal = computed(() => this.activePolls().length);

  // --- Past Polls Pagination ---
  pastTotalPages = computed(() => Math.max(1, Math.ceil(this.pastPolls().length / this.pageSize)));
  paginatedPastPolls = computed(() => {
    const start = (this.pastPage() - 1) * this.pageSize;
    return this.pastPolls().slice(start, start + this.pageSize);
  });
  pastVisiblePages = computed(() => {
    const total = this.pastTotalPages();
    const current = this.pastPage();
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
  pastPollsStart = computed(() => (this.pastPage() - 1) * this.pageSize + 1);
  pastPollsEnd = computed(() => Math.min(this.pastPage() * this.pageSize, this.pastPolls().length));
  pastPollsTotal = computed(() => this.pastPolls().length);

  hasSubmittedVote = signal(false);
  selectedOptionId = signal<number | null>(null);
  userVotes = signal<Map<number, UserVote>>(new Map());

  isVoting = signal(false);
  voteError = signal<string | null>(null);

  userVote = computed(() => this.selectedActivePoll()?.userVote ?? null);

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

    const sortedActive = activeRsvps
      .map((r: Rsvp) => this.mapRsvpToPoll(r))
      .sort((a, b) => {
        const aDay = a.cutOffDay ?? a.date ?? '';
        const bDay = b.cutOffDay ?? b.date ?? '';
        return new Date(aDay).getTime() - new Date(bDay).getTime();
      });

    this.activePolls.set(sortedActive);

    const isDetailOpen = this.selectedActivePoll() !== null;
    if (!isDetailOpen && sortedActive.length > 0) {
      const first = sortedActive[0];
      if (first.userVote) {
        const votes = new Map(this.userVotes());
        votes.set(first.id, first.userVote);
        this.userVotes.set(votes);
        this.hasSubmittedVote.set(true);
        this.selectedOptionId.set(first.userVote.timeSlotId);
      }
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
      eventLocation: rsvp.eventLocation,
      location: rsvp.location,
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
    if (tab === 'active') {
      this.activePage.set(1);
    } else {
      this.pastPage.set(1);
    }
  }

  goToPage(page: number): void {
    if (this.pollTab() === 'active') {
      if (page < 1 || page > this.activeTotalPages()) return;
      this.activePage.set(page);
    } else {
      if (page < 1 || page > this.pastTotalPages()) return;
      this.pastPage.set(page);
    }
  }

  nextPage(): void {
    this.goToPage(
      this.pollTab() === 'active' ? this.activePage() + 1 : this.pastPage() + 1
    );
  }

  prevPage(): void {
    this.goToPage(
      this.pollTab() === 'active' ? this.activePage() - 1 : this.pastPage() - 1
    );
  }

  selectActivePoll(poll: Poll): void {
    this.selectedActivePoll.set(poll);
    this.hasSubmittedVote.set(false);
    this.selectedOptionId.set(null);
    this.voteError.set(null);

    if (poll.userVote) {
      this.hasSubmittedVote.set(true);
      this.selectedOptionId.set(poll.userVote.timeSlotId);
    }
  }

  closeActivePollDetail(): void {
    this.selectedActivePoll.set(null);
    this.hasSubmittedVote.set(false);
    this.selectedOptionId.set(null);
    this.voteError.set(null);
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
    this.selectedOptionId.set(optionId);
    this.voteError.set(null);
  }

  submitPollVote(): void {
    const poll = this.selectedActivePoll();
    const optionId = this.selectedOptionId();
    if (!poll || optionId === null) return;

    this.isVoting.set(true);
    this.voteError.set(null);

    const isUpdate = this.hasSubmittedVote();
    const apiCall = isUpdate
      ? this.rsvpService.updateRsvpResponse(poll.id, optionId)
      : this.rsvpService.vote(poll.id, optionId);

    apiCall.pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: () => {
        this.hasSubmittedVote.set(true);
        this.isVoting.set(false);
        this.showSnackbar.emit({
          message: isUpdate ? 'Vote updated successfully' : 'Vote submitted successfully',
          type: 'success',
        });
        this.loadRsvpEvents();
      },
      error: (err: { error?: { message?: string } }) => {
        this.voteError.set(err?.error?.message ?? 'Failed to submit vote. Please try again.');
        this.showSnackbar.emit({
          message: err?.error?.message ?? 'Failed to submit vote. Please try again.',
          type: 'error',
        });
        this.isVoting.set(false);
      },
    });
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
    const poll = this.selectedActivePoll();
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