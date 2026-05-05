import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  computed,
  inject,
  signal,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { AbstractControl, FormArray, FormBuilder, ReactiveFormsModule, ValidationErrors, Validators, ValidatorFn } from '@angular/forms';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Rsvp, RsvpShift } from '../../models/rsvp';
import { RsvpService } from '../../services/rsvp.service';

@Component({
  selector: 'app-rsvps',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './rsvps.html',
  styleUrl: './rsvps.scss',
})
export class RsvpsComponent {
  private readonly fb = inject(FormBuilder);
  private readonly rsvpService = inject(RsvpService);
  private readonly destroyRef = inject(DestroyRef);

  readonly rsvps = signal<Rsvp[]>([]);
  readonly isLoading = signal(true);
  readonly rsvpFilterStatus = signal<'all' | 'active' | 'closed' | 'draft'>('all');
  readonly rsvpSearchQuery = signal('');
  readonly currentPage = signal(1);
  readonly itemsPerPage = signal(10);
  readonly showRsvpModal = signal(false);
  readonly showDeleteRsvpModal = signal(false);
  readonly showShareRsvpModal = signal(false);
  readonly sharingRsvp = signal<Rsvp | null>(null);
  readonly editingRsvp = signal<Rsvp | null>(null);
  readonly deletingRsvpId = signal<number | null>(null);
  readonly isCreatingRsvp = signal(false);
  readonly isDeletingRsvp = signal(false);
  readonly isNotifyingRsvpId = signal<number | null>(null);
  readonly notifyType = signal<'sms' | 'facebook' | null>(null);
  readonly feedbackMessage = signal('');
  readonly feedbackType = signal<'success' | 'error' | 'info'>('info');

  readonly filteredRsvps = computed(() => {
    const status = this.rsvpFilterStatus();
    const searchQuery = this.rsvpSearchQuery().toLowerCase();
    
    let filtered = this.rsvps();
    
    // Filter by status
    if (status !== 'all') {
      filtered = filtered.filter((rsvp) => rsvp.status === status);
    }
    
    // Filter by search query
    if (searchQuery) {
      filtered = filtered.filter(
        (rsvp) =>
          rsvp.title.toLowerCase().includes(searchQuery) ||
          (rsvp.eventLocation && rsvp.eventLocation.toLowerCase().includes(searchQuery))
      );
    }
    
    return filtered;
  });

  readonly totalPages = computed(() => {
    return Math.ceil(this.filteredRsvps().length / this.itemsPerPage());
  });

  readonly paginatedRsvps = computed(() => {
    const start = (this.currentPage() - 1) * this.itemsPerPage();
    const end = start + this.itemsPerPage();
    return this.filteredRsvps().slice(start, end);
  });

  readonly paginatedRangeEnd = computed(() => {
    return Math.min(this.currentPage() * this.itemsPerPage(), this.filteredRsvps().length);
  });

  readonly activeRsvpsCount = computed(() => {
    return this.rsvps().filter((rsvp) => rsvp.status === 'active').length;
  });

  readonly draftRsvpsCount = computed(() => {
    return this.rsvps().filter((rsvp) => rsvp.status === 'draft').length;
  });

  readonly closedRsvpsCount = computed(() => {
    return this.rsvps().filter((rsvp) => rsvp.status === 'closed').length;
  });

  readonly totalResponsesCount = computed(() => {
    return this.rsvps().reduce((sum, rsvp) => sum + rsvp.totalResponses, 0);
  });

  readonly rsvpForm = this.fb.group(
    {
      title: ['', [Validators.required, Validators.minLength(3)]],
      eventLocation: ['', [Validators.required, Validators.maxLength(255)]],
      date: ['', Validators.required],
      cutOffDay: ['', Validators.required],
      cutOffTime: ['', Validators.required],
      description: ['', [Validators.required, Validators.minLength(10)]],
      status: ['active', Validators.required],
      shifts: this.fb.array([]),
    },
    { validators: this.cutoffDateValidator() },
  );

  constructor() {
    this.loadRsvps();

    this.destroyRef.onDestroy(() => {
      this.unlockBodyScroll();
    });
  }

  get rsvpShifts(): FormArray {
    return this.rsvpForm.get('shifts') as FormArray;
  }

  setRsvpFilterStatus(status: 'all' | 'active' | 'closed' | 'draft'): void {
    this.rsvpFilterStatus.set(status);
    this.currentPage.set(1);
  }

  setRsvpSearchQuery(query: string): void {
    this.rsvpSearchQuery.set(query);
    this.currentPage.set(1);
  }

  goToPage(page: number): void {
    this.currentPage.set(page);
  }

  nextPage(): void {
    if (this.currentPage() < this.totalPages()) {
      this.currentPage.set(this.currentPage() + 1);
    }
  }

  previousPage(): void {
    if (this.currentPage() > 1) {
      this.currentPage.set(this.currentPage() - 1);
    }
  }

  getPageNumbers(): number[] {
    const pages: number[] = [];
    const total = this.totalPages();
    const current = this.currentPage();
    
    if (total <= 7) {
      for (let i = 1; i <= total; i++) {
        pages.push(i);
      }
    } else {
      if (current <= 4) {
        for (let i = 1; i <= 5; i++) {
          pages.push(i);
        }
        pages.push(-1);
        pages.push(total);
      } else if (current >= total - 3) {
        pages.push(1);
        pages.push(-1);
        for (let i = total - 4; i <= total; i++) {
          pages.push(i);
        }
      } else {
        pages.push(1);
        pages.push(-1);
        for (let i = current - 1; i <= current + 1; i++) {
          pages.push(i);
        }
        pages.push(-1);
        pages.push(total);
      }
    }
    
    return pages;
  }

  getTotalCapacity(rsvp: Rsvp): number {
    return rsvp.shifts.reduce((sum, shift) => sum + shift.capacity, 0);
  }

  openCreateRsvpModal(): void {
    this.editingRsvp.set(null);
    this.rsvpForm.reset({ status: 'active' });
    this.rsvpShifts.clear();
    this.addRsvpShift();
    this.addRsvpShift();
    this.lockBodyScroll();
    this.showRsvpModal.set(true);
  }

  openEditRsvpModal(rsvp: Rsvp): void {
    this.editingRsvp.set(rsvp);
    this.rsvpShifts.clear();

    const parseBackendTime = (timeString: string): string => {
      if (!timeString) return '';
      if (/^\d{2}:\d{2}$/.test(timeString)) return timeString;
      if (/^\d{2}:\d{2}:\d{2}$/.test(timeString)) return timeString.substring(0, 5);

      const timeMatch = timeString.match(/(\d{1,2}):(\d{2})\s*(AM|PM)/i);
      if (!timeMatch) return '';

      const [, hours, minutes, ampm] = timeMatch;
      let hour = Number.parseInt(hours, 10);
      if (ampm.toUpperCase() === 'PM' && hour !== 12) hour += 12;
      if (ampm.toUpperCase() === 'AM' && hour === 12) hour = 0;
      return `${hour.toString().padStart(2, '0')}:${minutes}`;
    };

    rsvp.shifts.forEach((shift) => {
      let startTime = '';
      let endTime = '';

      if (shift.timeSlot) {
        const parts = shift.timeSlot.split('-').map((part) => part.trim());
        if (parts.length === 2) {
          startTime = parseBackendTime(parts[0]);
          endTime = parseBackendTime(parts[1]);
        }
      }

      this.rsvpShifts.push(
        this.fb.group(
          {
            startTime: [startTime, Validators.required],
            endTime: [endTime, Validators.required],
            capacity: [shift.capacity, [Validators.required, Validators.min(1)]],
          },
          { validators: this.rsvpShiftTimeRangeValidator() },
        ),
      );
    });

    this.rsvpForm.patchValue({
      title: rsvp.title,
      eventLocation: rsvp.eventLocation ?? '',
      date: this.parseBackendDate(rsvp.date),
      cutOffDay: this.parseBackendDate(rsvp.cutOffDay),
      cutOffTime: parseBackendTime(rsvp.cutOffTime),
      description: rsvp.description,
      status: rsvp.status,
    });

    this.lockBodyScroll();
    this.showRsvpModal.set(true);
  }

  closeRsvpModal(): void {
    this.showRsvpModal.set(false);
    this.unlockBodyScroll();
    this.editingRsvp.set(null);
    this.rsvpForm.reset({ status: 'active' });
  }

  addRsvpShift(): void {
    this.rsvpShifts.push(
      this.fb.group(
        {
          startTime: ['', Validators.required],
          endTime: ['', Validators.required],
          capacity: [10, [Validators.required, Validators.min(1)]],
        },
        { validators: this.rsvpShiftTimeRangeValidator() },
      ),
    );
  }

  removeRsvpShift(index: number): void {
    if (this.rsvpShifts.length > 1) {
      this.rsvpShifts.removeAt(index);
    }
  }

  saveRsvp(): void {
    if (this.rsvpForm.invalid) {
      this.rsvpForm.markAllAsTouched();
      return;
    }

    this.isCreatingRsvp.set(true);
    const formValue = this.rsvpForm.value;
    const payload = {
      title: formValue.title!,
      event_location: formValue.eventLocation!,
      date: this.formatDateForBackend(formValue.date!),
      cutoff_day: this.formatDateForBackend(formValue.cutOffDay!),
      cutoff_time: this.formatTimeForBackend(formValue.cutOffTime!),
      description: formValue.description!,
      status: formValue.status!,
      shifts: (
        formValue.shifts as { startTime: string; endTime: string; capacity: number }[]
      ).map((shift) => {
        const timeSlot = `${shift.startTime} - ${shift.endTime}`;
        return {
          text: timeSlot,
          time_slot: timeSlot,
          capacity: shift.capacity,
        };
      }),
    };

    const editingRsvp = this.editingRsvp();
    const request = editingRsvp
      ? this.rsvpService.updateRsvp(editingRsvp.id, payload)
      : this.rsvpService.createRsvp(payload);

    request.pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: () => {
        this.loadRsvps();
        this.closeRsvpModal();
        this.isCreatingRsvp.set(false);
        this.showFeedback(
          editingRsvp ? 'RSVP updated successfully.' : 'RSVP created successfully.',
          'success',
        );
      },
      error: (error: { error?: { message?: string; errors?: Record<string, string[]> }; message?: string }) => {
        console.error('Error saving RSVP:', error);
        this.isCreatingRsvp.set(false);

        // Extract validation errors from backend response
        let errorMessage = editingRsvp ? 'RSVP update failed.' : 'RSVP creation failed.';

        if (error.error?.message) {
          errorMessage = error.error.message;
        } else if (error.error?.errors) {
          // Format Laravel validation errors
          const validationErrors = Object.values(error.error.errors).flat();
          errorMessage = validationErrors.join(', ');
        } else if (error.message) {
          errorMessage = error.message;
        }

        this.showFeedback(errorMessage, 'error');
      },
    });
  }

  openShareRsvpModal(rsvp: Rsvp): void {
    if (rsvp.status !== 'active') {
      this.showFeedback('Cannot share draft or closed RSVP events.', 'error');
      return;
    }
    this.sharingRsvp.set(rsvp);
    this.lockBodyScroll();
    this.showShareRsvpModal.set(true);
  }

  closeShareRsvpModal(): void {
    this.sharingRsvp.set(null);
    this.showShareRsvpModal.set(false);
    this.unlockBodyScroll();
  }

  getShareLink(): string {
    const rsvp = this.sharingRsvp();
    if (!rsvp) return '';
    if (rsvp.shareUrl) return rsvp.shareUrl;
    return `${window.location.origin}/rsvp?id=${rsvp.id}`;
  }

  copyShareLink(): void {
    const link = this.getShareLink();
    if (!link) return;

    navigator.clipboard.writeText(link).then(
      () => {
        this.showFeedback('Link copied to clipboard.', 'success');
        this.closeShareRsvpModal();
      },
      () => {
        this.showFeedback('Failed to copy link.', 'error');
      },
    );
  }

  confirmDeleteRsvp(rsvpId: number): void {
    this.deletingRsvpId.set(rsvpId);
    this.lockBodyScroll();
    this.showDeleteRsvpModal.set(true);
  }

  closeDeleteRsvpModal(): void {
    this.showDeleteRsvpModal.set(false);
    this.unlockBodyScroll();
    this.deletingRsvpId.set(null);
  }

  deleteRsvp(): void {
    const rsvpId = this.deletingRsvpId();
    if (rsvpId === null) return;

    this.isDeletingRsvp.set(true);
    this.rsvpService
      .deleteRsvp(rsvpId)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          this.loadRsvps();
          this.closeDeleteRsvpModal();
          this.isDeletingRsvp.set(false);
          this.showFeedback('RSVP deleted successfully.', 'success');
        },
        error: (error: Error) => {
          console.error('Error deleting RSVP:', error);
          this.isDeletingRsvp.set(false);
          this.showFeedback('RSVP deletion failed.', 'error');
        },
      });
  }

  notifyRsvpSms(rsvpId: number): void {
    this.isNotifyingRsvpId.set(rsvpId);
    this.notifyType.set('sms');

    this.rsvpService
      .notifySms(rsvpId)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (result) => {
          this.isNotifyingRsvpId.set(null);
          this.notifyType.set(null);
          this.showFeedback(
            `SMS notifications sent: ${result.sent}/${result.total}`,
            'success',
          );
        },
        error: (error: { error?: { message?: string }; message?: string }) => {
          console.error('Error sending SMS notifications:', error);
          this.isNotifyingRsvpId.set(null);
          this.notifyType.set(null);

          const errorMessage = error.error?.message || error.message || 'Failed to send SMS notifications.';
          this.showFeedback(errorMessage, 'error');
        },
      });
  }

  notifyRsvpFacebook(rsvpId: number): void {
    this.isNotifyingRsvpId.set(rsvpId);
    this.notifyType.set('facebook');

    this.rsvpService
      .notifyFacebook(rsvpId)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (result) => {
          this.isNotifyingRsvpId.set(null);
          this.notifyType.set(null);
          this.showFeedback(
            `Facebook notifications sent: ${result.sent}/${result.total}`,
            'success',
          );
        },
        error: (error: { error?: { message?: string }; message?: string }) => {
          console.error('Error sending Facebook notifications:', error);
          this.isNotifyingRsvpId.set(null);
          this.notifyType.set(null);

          const errorMessage = error.error?.message || error.message || 'Failed to send Facebook notifications.';
          this.showFeedback(errorMessage, 'error');
        },
      });
  }

  updateRsvpStatus(rsvpId: number, status: 'active' | 'closed' | 'draft'): void {
    this.rsvpService
      .updateRsvpStatus(rsvpId, status)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          this.loadRsvps();
        },
        error: (error: Error) => {
          console.error('Error updating RSVP status:', error);
          this.showFeedback('Failed to update RSVP status.', 'error');
        },
      });
  }

  getResponsePercentage(rsvp: Rsvp, shift: RsvpShift): number {
    return rsvp.totalResponses > 0 ? (shift.responses / rsvp.totalResponses) * 100 : 0;
  }

  getRemainingSlots(shift: RsvpShift): number {
    return shift.capacity - shift.responses;
  }

  isFull(shift: RsvpShift): boolean {
    return shift.responses >= shift.capacity;
  }

  formatTimeSlot(timeSlot: string): string {
    if (!timeSlot) return '';
    if (timeSlot.includes(' - ')) {
      const [start, end] = timeSlot.split(' - ');
      return `${this.formatTimeTo12Hour(start.trim())} - ${this.formatTimeTo12Hour(end.trim())}`;
    }
    return this.formatTimeTo12Hour(timeSlot);
  }

  private loadRsvps(): void {
    this.isLoading.set(true);
    this.rsvpService
      .getRsvps()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (response) => {
          this.rsvps.set(response.data ?? []);
          this.isLoading.set(false);
        },
        error: (error: Error) => {
          console.error('Error loading RSVPs:', error);
          this.rsvps.set([]);
          this.isLoading.set(false);
        },
      });
  }

  private cutoffDateValidator(): ValidatorFn {
    return (group: AbstractControl): ValidationErrors | null => {
      const eventDate = group.get('date')?.value;
      const cutoffDate = group.get('cutOffDay')?.value;
      if (!eventDate || !cutoffDate) return null;

      const event = new Date(eventDate);
      const cutoff = new Date(cutoffDate);
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      if (cutoff > event) return { cutoffAfterEvent: true };
      if (cutoff < today) return { cutoffBeforeToday: true };
      return null;
    };
  }

  private rsvpShiftTimeRangeValidator(): ValidatorFn {
    return (group: AbstractControl): ValidationErrors | null => {
      const start = group.get('startTime')?.value as string | undefined;
      const end = group.get('endTime')?.value as string | undefined;
      if (!start || !end) return null;
      return start < end ? null : { invalidTimeRange: true };
    };
  }

  private parseBackendDate(dateString: string): string {
    if (!dateString) return '';
    if (dateString.match(/^\d{4}-\d{2}-\d{2}$/)) return dateString;
    const date = new Date(dateString);
    return Number.isNaN(date.getTime()) ? '' : date.toISOString().split('T')[0];
  }

  private formatDateForBackend(dateString: string): string {
    if (!dateString) return '';
    const date = new Date(dateString);
    return date.toISOString().split('T')[0];
  }

  private formatTimeForBackend(timeString: string): string {
    if (!timeString) return '';
    return `${timeString}:00`;
  }

  private formatTimeTo12Hour(time24: string): string {
    if (!time24) return '';
    if (time24.includes('AM') || time24.includes('PM')) return time24.trim();
    if (!time24.includes(':')) return time24;

    const [hourPart, minutePart] = time24.split(':');
    const hour = Number.parseInt(hourPart, 10);
    if (Number.isNaN(hour)) return time24;

    const period = hour >= 12 ? 'PM' : 'AM';
    const displayHour = hour === 0 ? 12 : hour > 12 ? hour - 12 : hour;
    return `${displayHour}:${minutePart} ${period}`;
  }

  private showFeedback(message: string, type: 'success' | 'error' | 'info'): void {
    this.feedbackMessage.set(message);
    this.feedbackType.set(type);
  }

  private lockBodyScroll(): void {
    document.body.style.overflow = 'hidden';
  }

  private unlockBodyScroll(): void {
    document.body.style.overflow = '';
  }
}
