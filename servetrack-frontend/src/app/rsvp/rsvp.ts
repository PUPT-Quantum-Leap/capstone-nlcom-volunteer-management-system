import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  OnInit,
  computed,
  inject,
  signal,
} from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { DecimalPipe } from '@angular/common';
import { RsvpService } from '../services/rsvp.service';
import { Rsvp as RsvpModel, RsvpShift, RsvpResponse } from '../models/rsvp';

@Component({
  selector: 'app-rsvp',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [DecimalPipe],
  templateUrl: './rsvp.html',
  styleUrl: './rsvp-styles.scss',
})
export class RsvpComponent implements OnInit {
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private rsvpService = inject(RsvpService);
  private destroyRef = inject(DestroyRef);

  rsvp = signal<RsvpModel | null>(null);
  rsvpResponse = signal<RsvpResponse | null>(null);
  isLoading = signal(true);
  error = signal<string | null>(null);
  selectedShiftId = signal<number | null>(null);
  hasSubmittedRsvp = signal(false);
  rsvpError = signal<string | null>(null);
  isEditMode = signal(false);
  editShiftId = signal<number | null>(null);
  isEditSubmitting = signal(false);
  editError = signal<string | null>(null);

  totalResponses = computed(() => this.rsvp()?.totalResponses ?? 0);
  hasSelectedShift = computed(() => this.selectedShiftId() !== null);
  remainingEdits = computed(() => this.rsvpResponse()?.remainingEdits ?? 0);
  hasEditsRemaining = computed(() => this.remainingEdits() > 0);
  canEditResponse = computed(
    () => this.hasSubmittedRsvp() && this.hasEditsRemaining() && this.rsvp()?.status === 'active',
  );

  ngOnInit(): void {
    this.route.paramMap.pipe(takeUntilDestroyed(this.destroyRef)).subscribe((params) => {
      const slug = params.get('slug');
      const id = this.route.snapshot.queryParamMap.get('id');
      const identifier = slug || id;

      if (!identifier) {
        this.error.set('No RSVP provided. Please use a valid RSVP link.');
        this.isLoading.set(false);
        return;
      }

      this.loadRsvp(identifier);
    });
  }

  private loadRsvp(identifier: string | number): void {
    this.isLoading.set(true);
    this.error.set(null);
    this.rsvpService
      .getRsvpById(identifier)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (response) => {
          this.rsvp.set(response.data);
          this.isLoading.set(false);
          // Try to load the volunteer's response
          this.loadMyResponse(response.data.id);
        },
        error: () => {
          this.error.set('RSVP not found or is no longer available.');
          this.isLoading.set(false);
        },
      });
  }

  private loadMyResponse(rsvpId: number): void {
    this.rsvpService
      .getMyResponse(rsvpId)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (response) => {
          this.rsvpResponse.set(response.data);
          this.hasSubmittedRsvp.set(true);
        },
        error: () => {
          // No response yet, user hasn't responded to this RSVP
          this.rsvpResponse.set(null);
          this.hasSubmittedRsvp.set(false);
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
    this.rsvpService
      .vote(rsvp.id, shiftId)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          this.selectedShiftId.set(null);
          this.isLoading.set(false);
          // Load the user's response to display it
          this.loadMyResponse(rsvp.id);
          // Reload RSVP data to update shift counts
          this.rsvpService
            .getRsvpById(rsvp.id)
            .pipe(takeUntilDestroyed(this.destroyRef))
            .subscribe({
              next: (response) => {
                this.rsvp.set(response.data);
              },
            });
        },
        error: (err: { error?: { message?: string } }) => {
          this.rsvpError.set(err?.error?.message ?? 'Failed to submit RSVP. Please try again.');
          this.isLoading.set(false);
        },
      });
  }

  /**
   * Enter edit mode to change response.
   */
  enterEditMode(): void {
    if (!this.canEditResponse()) {
      return;
    }
    this.isEditMode.set(true);
    this.editShiftId.set(null);
    this.editError.set(null);
  }

  /**
   * Exit edit mode without saving.
   */
  exitEditMode(): void {
    this.isEditMode.set(false);
    this.editShiftId.set(null);
    this.editError.set(null);
  }

  /**
   * Select a new shift while in edit mode.
   */
  selectEditShift(shiftId: number): void {
    const rsvp = this.rsvp();
    if (!rsvp) {
      return;
    }

    const currentResponse = this.rsvpResponse();
    if (currentResponse && shiftId === currentResponse.timeSlotId) {
      this.editError.set('Please select a different time slot.');
      return;
    }

    const shift = rsvp.shifts.find((s) => s.id === shiftId);
    if (shift && !this.isFull(shift)) {
      this.editShiftId.set(shiftId);
    }
  }

  /**
   * Submit the edited response.
   */
  submitEditedResponse(): void {
    const rsvp = this.rsvp();
    const editShiftId = this.editShiftId();

    if (!rsvp || editShiftId === null) {
      return;
    }

    this.isEditSubmitting.set(true);
    this.editError.set(null);

    this.rsvpService
      .updateRsvpResponse(rsvp.id, editShiftId)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (response) => {
          // Update response data
          const currentResponse = this.rsvpResponse();
          if (currentResponse) {
            const updated: RsvpResponse = {
              ...currentResponse,
              timeSlotId: editShiftId,
              remainingEdits: response.remaining_edits,
              editCount: currentResponse.editCount + 1,
              lastEditedAt: new Date().toISOString(),
            };
            this.rsvpResponse.set(updated);
          }

          this.isEditSubmitting.set(false);
          this.isEditMode.set(false);
          this.editShiftId.set(null);
          this.loadRsvp(rsvp.id);
        },
        error: (err: { error?: { message?: string } }) => {
          this.editError.set(err?.error?.message ?? 'Failed to update response. Please try again.');
          this.isEditSubmitting.set(false);
        },
      });
  }

  /**
   * Get the currently selected shift label for display.
   */
  getCurrentShiftLabel(): string {
    const rsvp = this.rsvp();
    const response = this.rsvpResponse();
    if (!rsvp || !response) {
      return 'N/A';
    }
    const shift = rsvp.shifts.find((s) => s.id === response.timeSlotId);
    return shift ? shift.timeSlot : 'Unknown';
  }

  /**
   * Get the newly selected shift label for edit.
   */
  getEditShiftLabel(): string {
    const rsvp = this.rsvp();
    if (!rsvp) {
      return 'N/A';
    }
    const editShiftId = this.editShiftId();
    if (!editShiftId) {
      return 'Select a shift';
    }
    const shift = rsvp.shifts.find((s) => s.id === editShiftId);
    return shift ? shift.timeSlot : 'Unknown';
  }
}
