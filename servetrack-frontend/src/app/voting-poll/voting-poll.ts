import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  OnInit,
  computed,
  inject,
  signal,
} from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { DecimalPipe } from '@angular/common';
import { PollService } from '../services/poll.service';
import { Poll, PollOption } from '../models/poll';

@Component({
  selector: 'app-voting-poll',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [DecimalPipe],
  templateUrl: './voting-poll.html',
  styleUrl: './voting-poll-styles.scss',
})
export class VotingPoll implements OnInit {
  private route = inject(ActivatedRoute);
  private pollService = inject(PollService);
  private destroyRef = inject(DestroyRef);

  poll = signal<Poll | null>(null);
  isLoading = signal(true);
  error = signal<string | null>(null);
  selectedOptionId = signal<number | null>(null);
  hasSubmittedVote = signal(false);
  voteError = signal<string | null>(null);

  totalVotes = computed(() => this.poll()?.totalVotes ?? 0);

  hasSelectedOption = computed(() => this.selectedOptionId() !== null);

  ngOnInit(): void {
    const pollId = Number(this.route.snapshot.queryParamMap.get('id'));
    if (!pollId) {
      this.error.set('No poll ID provided. Please use a valid poll link.');
      this.isLoading.set(false);
      return;
    }
    this.loadPoll(pollId);
  }

  private loadPoll(id: number): void {
    this.isLoading.set(true);
    this.error.set(null);
    this.pollService.getPollById(id).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (response) => {
        this.poll.set(response.data);
        this.isLoading.set(false);
      },
      error: () => {
        this.error.set('Poll not found or is no longer available.');
        this.isLoading.set(false);
      },
    });
  }

  getVotePercentage(votes: number): number {
    const total = this.totalVotes();
    return total > 0 ? (votes / total) * 100 : 0;
  }

  getRemainingSlots(option: PollOption): number {
    return option.capacity - option.votes;
  }

  isFull(option: PollOption): boolean {
    return option.votes >= option.capacity;
  }

  selectOption(optionId: number): void {
    const poll = this.poll();
    if (!poll || this.hasSubmittedVote()) {
      return;
    }
    const option = poll.options.find((o) => o.id === optionId);
    if (option && !this.isFull(option)) {
      this.selectedOptionId.set(optionId);
    }
  }

  submitVote(): void {
    const poll = this.poll();
    const optionId = this.selectedOptionId();
    if (!poll || optionId === null || this.hasSubmittedVote()) {
      return;
    }

    this.isLoading.set(true);
    this.voteError.set(null);
    this.pollService.vote(poll.id, optionId).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: () => {
        this.hasSubmittedVote.set(true);
        this.isLoading.set(false);
        // Refresh to show updated vote counts
        this.loadPoll(poll.id);
      },
      error: (err: { error?: { message?: string } }) => {
        this.voteError.set(err?.error?.message ?? 'Failed to submit vote. Please try again.');
        this.isLoading.set(false);
      },
    });
  }
}
