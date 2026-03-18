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
import { RsvpService } from '../services/rsvp.service';
import { Rsvp, RsvpShift } from '../models/rsvp';

@Component({
  selector: 'app-rsvp',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [DecimalPipe],
  templateUrl: './rsvp.html',
  styleUrl: './rsvp-styles.scss',
})
export class Rsvp implements OnInit {
  private route = inject(ActivatedRoute);
  private rsvpService = inject(RsvpService);
  private destroyRef = inject(DestroyRef);

  rsvp = signal<Rsvp | null>(null);
  isLoading = signal(true);
  error = signal<string | null>(null);
  selectedShiftId = signal<number | null>(null);
  hasSubmittedRsvp = signal(false);
  rsvpError = signal<string | null>(null);

  totalResponses = computed(() => this.rsvp()?.totalResponses ?? 0);

  hasSelectedShift = computed(() => this.selectedShiftId() !== null);

  ngOnInit(): void {
    const rsvpId = Number(this.route.snapshot.queryParamMap.get('id'));
    if (!rsvpId) {
      this.error.set('No RSVP ID provided. Please use a valid RSVP link.');
      this.isLoading.set(false);
      return;
    }
    this.loadRsvp(rsvpId);
  }

  private loadRsvp(id: number): void {
    this.isLoading.set(true);
    this.error.set(null);
    this.rsvpService.getRsvpById(id).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (response) => {
        this.rsvp.set(response.data);
        this.isLoading.set(false);
      },
      error: () => {
        this.error.set('RSVP not found or is no longer available.');
        this.isLoading.set(false);
      },
    });
  }

  getResponsePercentage(responses: number): number {
    const total = this.totalResponses();
    return total > 0 ? (responses / total) * 100 : 0;
  }

  getRemainingSlots(shift: RsvpShift): number {
    return shift.capacity - shift.responses;
  }

  isFull(shift: RsvpShift): boolean {
    return shift.responses >= shift.capacity;
  }

  selectShift(shiftId: number): void {
    const rsvp = this.rsvp();
    if (!rsvp || this.hasSubmittedRsvp()) {
      return;
    }
    const shift = rsvp.shifts.find((s) => s.id === shiftId);
    if (shift && !this.isFull(shift)) {
      this.selectedShiftId.set(shiftId);
    }
  }

  submitRsvp(): void {
    const rsvp = this.rsvp();
    const shiftId = this.selectedShiftId();
    if (!rsvp || shiftId === null || this.hasSubmittedRsvp()) {
      return;
    }

    this.isLoading.set(true);
    this.rsvpError.set(null);
    this.rsvpService.vote(rsvp.id, shiftId).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: () => {
        this.hasSubmittedRsvp.set(true);
        this.isLoading.set(false);
        this.loadRsvp(rsvp.id);
      },
      error: (err: { error?: { message?: string } }) => {
        this.rsvpError.set(err?.error?.message ?? 'Failed to submit RSVP. Please try again.');
        this.isLoading.set(false);
      },
    });
  }
}
