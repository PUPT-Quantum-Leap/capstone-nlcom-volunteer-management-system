import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  OnInit,
  computed,
  effect,
  inject,
  signal,
} from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { CommonModule } from '@angular/common';
import { RsvpService } from '../services/rsvp.service';
import { AuthService } from '../services/auth.service';
import { Rsvp as RsvpModel, RsvpShift, RsvpResponse } from '../models/rsvp';

@Component({
  selector: 'app-rsvp',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule],
  templateUrl: './rsvp.html',
  styleUrl: './rsvp-styles.scss',
})
export class RsvpComponent implements OnInit {
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private rsvpService = inject(RsvpService);
  private destroyRef = inject(DestroyRef);
  private authService = inject(AuthService);

  private currentRsvpSlug = '';

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

  isAuthenticated = computed(() => this.authService.isAuthenticated());
  canVote = computed(() => this.isAuthenticated() === true);

  totalResponses = computed(() => this.rsvp()?.totalResponses ?? 0);
  hasSelectedShift = computed(() => this.selectedShiftId() !== null);
  remainingEdits = computed(() => this.rsvpResponse()?.remainingEdits ?? 0);
  hasEditsRemaining = computed(() => this.remainingEdits() > 0);
  isClosed = computed(() => {
    const rsvp = this.rsvp();
    return rsvp?.status !== 'active' || rsvp?.isCutoffPassed;
  });
  canEditResponse = computed(
    () => this.hasSubmittedRsvp() && this.hasEditsRemaining() && !this.isClosed(),
  );

  private queryParams: Record<string, string> = {};

  constructor() {
    // Effect: Watch for auth changes and reload response when user logs in
    effect(() => {
      const isAuthenticated = this.authService.isAuthenticated();
      const rsvpData = this.rsvp();
      const hasLoggedIn = this.queryParams['logged_in'] === 'true';

      if (isAuthenticated && rsvpData && hasLoggedIn) {
        this.loadMyResponse(rsvpData.id);
      }
    });
  }

  ngOnInit(): void {
    // Track query params for redirect after login and effect
    this.route.queryParams.pipe(takeUntilDestroyed(this.destroyRef)).subscribe((params) => {
      this.queryParams = params;
      if (params['logged_in'] === 'true' && this.rsvp()) {
        // User just logged in, reload their response to enable voting
        const rsvpData = this.rsvp();
        if (rsvpData) {
          this.loadMyResponse(rsvpData.id);
        }
      }
    });

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
          this.currentRsvpSlug = response.data.slug || String(identifier);
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

  /**
   * Redirect unauthenticated users to login page with redirect parameter.
   */
  redirectToLogin(): void {
    if (!this.currentRsvpSlug) {
      return;
    }
    this.router.navigate(['/volunteer-auth'], {
      queryParams: {
        redirect: `/rsvp/${this.currentRsvpSlug}?logged_in=true`,
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

  /**
   * Get the reason why the RSVP is closed ('manual' for status-based, 'cutoff' for time-based).
   */
  getClosureReason(): 'manual' | 'cutoff' | null {
    const rsvp = this.rsvp();
    if (rsvp?.status === 'closed' || rsvp?.status === 'draft') {
      return 'manual';
    }
    if (rsvp?.isCutoffPassed) {
      return 'cutoff';
    }
    return null;
  }

  /**
   * Get the appropriate closure message based on the reason for closure.
   */
  getClosureMessage(): string {
    const reason = this.getClosureReason();
    const rsvp = this.rsvp();

    if (reason === 'cutoff') {
      return 'This RSVP has closed and is no longer accepting responses.';
    }
    if (reason === 'manual') {
      return `This RSVP is ${rsvp?.status} and no longer accepting responses.`;
    }
    return '';
  }
}
