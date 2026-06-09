import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  computed,
  inject,
  signal,
  effect,
  untracked,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { AbstractControl, FormArray, FormBuilder, ReactiveFormsModule, ValidationErrors, Validators, ValidatorFn } from '@angular/forms';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { debounceTime, distinctUntilChanged, Subject } from 'rxjs';
import { Rsvp, RsvpShift } from '../../models/rsvp';
import { RsvpService } from '../../services/rsvp.service';
import { AdminDashboardService, NonResponder } from '../../services/admin-dashboard.service';

import { CustomSelect, SelectOption } from '../../components/custom-select/custom-select';
import { MapPickerComponent, MapLocation } from '../../components/map-picker/map-picker';
import { MapViewComponent } from '../../components/map-view/map-view';
import { Time12hrPipe } from '../../pipes/time12hr.pipe';
import { GlobalSearchService } from '../../services/global-search.service';

export interface RespondedItem {
  id: number;
  rsvp_id: number;
  volunteer_id: number;
  volunteer_name: string;
  volunteer_email: string;
  volunteer_department: string;
  time_slot: string | null;
  attendance_status: 'registered' | 'checked_in' | 'checked_out' | 'no_show';
  voted_at: string | null;
  checked_in_at: string | null;
  checked_out_at: string | null;
}

@Component({
  selector: 'app-rsvps',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, ReactiveFormsModule, CustomSelect, MapPickerComponent, MapViewComponent, Time12hrPipe],
  templateUrl: './rsvps.html',
  styleUrl: './rsvps.scss',
})
export class RsvpsComponent {
  private readonly fb = inject(FormBuilder);
  private readonly rsvpService = inject(RsvpService);
  private readonly adminService = inject(AdminDashboardService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly globalSearchService = inject(GlobalSearchService);
  private readonly nonResponderSearch$ = new Subject<string>();

  // Dropdown Options
  statusFilterOptions: SelectOption<'all' | 'active' | 'closed' | 'draft'>[] = [
    { label: 'All Events', value: 'all' },
    { label: 'Active Events', value: 'active' },
    { label: 'Draft Events', value: 'draft' },
    { label: 'Closed Events', value: 'closed' }
  ];

  readonly rsvps = signal<Rsvp[]>([]);
  readonly isLoading = signal(true);
  readonly rsvpFilterStatus = signal<'all' | 'active' | 'closed' | 'draft'>('all');
  readonly rsvpSearchQuery = this.globalSearchService.searchQuery;
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
  readonly showMapPicker = signal(false);
  readonly showPreview = signal(false);
  readonly feedbackMessage = signal('');
  readonly feedbackType = signal<'success' | 'error' | 'info'>('info');

  // ── Responses modal ──────────────────────────────────────────────────────────
  readonly showResponsesModal = signal(false);
  readonly selectedRsvpForResponses = signal<Rsvp | null>(null);
  readonly responsesActiveTab = signal<'responded' | 'not_responded'>('responded');
  readonly respondedList = signal<RespondedItem[]>([]);
  readonly responsesLoading = signal(false);
  readonly responsesError = signal('');
  readonly responseFilterStatus = signal<'all' | 'registered' | 'checked_in' | 'checked_out' | 'no_show'>('all');
  readonly responseFilterShift = signal<string>('all');
  readonly responseSearchQuery = signal('');

  readonly nonRespondersList = signal<NonResponder[]>([]);
  readonly nonRespondersLoading = signal(false);
  readonly nonRespondersError = signal('');
  readonly nonRespondersPage = signal(1);
  readonly nonRespondersTotalPages = signal(1);
  readonly nonRespondersTotal = signal(0);
  readonly nonResponderSearchQuery = signal('');

  // CSV export popover
  readonly showExportPopover = signal(false);
  readonly exportColumns = signal<Record<string, boolean>>({});

  readonly filteredResponded = computed(() => {
    let list = this.respondedList();
    const status = this.responseFilterStatus();
    const shift = this.responseFilterShift();
    const q = this.responseSearchQuery().toLowerCase();
    if (status !== 'all') list = list.filter((r) => r.attendance_status === status);
    if (shift !== 'all') list = list.filter((r) => r.time_slot === shift);
    if (q) list = list.filter((r) => r.volunteer_name.toLowerCase().includes(q));
    return list;
  });

  readonly responseStats = computed(() => {
    const list = this.respondedList();
    return {
      total: list.length,
      registered: list.filter((r) => r.attendance_status === 'registered').length,
      checkedIn: list.filter((r) => r.attendance_status === 'checked_in').length,
      checkedOut: list.filter((r) => r.attendance_status === 'checked_out').length,
      noShow: list.filter((r) => r.attendance_status === 'no_show').length,
    };
  });

  readonly responseShiftOptions = computed((): SelectOption<string>[] => {
    const rsvp = this.selectedRsvpForResponses();
    if (!rsvp) return [{ label: 'All Shifts', value: 'all' }];
    const shifts = rsvp.shifts.map((s) => ({ label: s.text ?? s.timeSlot, value: s.text ?? s.timeSlot }));
    return [{ label: 'All Shifts', value: 'all' }, ...shifts];
  });

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
      latitude: [null as number | null],
      longitude: [null as number | null],
      date: ['', Validators.required],
      cutOffDay: ['', Validators.required],
      cutOffTime: ['', Validators.required],
      description: ['', [Validators.required, Validators.minLength(10)]],
      status: ['active', Validators.required],
      shifts: this.fb.array([]),
    },
    { validators: this.cutoffDateValidator() },
  );

  readonly previewRsvp = signal<{
    title: string;
    description: string;
    eventLocation: string;
    latitude: number | null;
    longitude: number | null;
    date: string;
    cutOffDay: string;
    cutOffTime: string;
    status: 'active' | 'draft';
    shifts: { timeSlot: string; capacity: number }[];
  } | null>(null);

  constructor() {
    this.loadRsvps();

    effect(() => {
      this.rsvpSearchQuery();
      untracked(() => {
        this.currentPage.set(1);
      });
    });

    this.nonResponderSearch$
      .pipe(debounceTime(350), distinctUntilChanged(), takeUntilDestroyed(this.destroyRef))
      .subscribe((q) => {
        this.nonResponderSearchQuery.set(q);
        this.nonRespondersPage.set(1);
        this.loadNonResponders();
      });

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

  // Search set query removed, handled by global search effect

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

    if (rsvp.location?.latitude && rsvp.location?.longitude) {
      this.rsvpForm.patchValue({
        latitude: rsvp.location.latitude,
        longitude: rsvp.location.longitude,
      });
      this.showMapPicker.set(true);
    }
    this.lockBodyScroll();
    this.showRsvpModal.set(true);
  }

  closeRsvpModal(): void {
    if (this.rsvpForm.dirty && !confirm('You have unsaved changes. Discard them?')) {
      return;
    }
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

  onMapLocationSelected(location: MapLocation): void {
    this.rsvpForm.patchValue({
      eventLocation: location.address,
      latitude: location.latitude,
      longitude: location.longitude,
    });
  }

  toggleMapPicker(): void {
    this.showMapPicker.update((v) => !v);
  }

  openPreview(): void {
    const form = this.rsvpForm.value;
    const rawShifts = (form.shifts ?? []) as { startTime: string; endTime: string; capacity: number }[];
    this.previewRsvp.set({
      title: form.title || 'Untitled Event',
      description: form.description || '',
      eventLocation: form.eventLocation || '',
      latitude: form.latitude ?? null,
      longitude: form.longitude ?? null,
      date: form.date || '',
      cutOffDay: form.cutOffDay || '',
      cutOffTime: form.cutOffTime || '',
      status: form.status === 'active' ? 'active' : 'draft',
      shifts: rawShifts.map((s) => ({
        timeSlot: `${s.startTime || '--:--'} - ${s.endTime || '--:--'}`,
        capacity: s.capacity || 0,
      })),
    });
    this.showPreview.set(true);
    this.lockBodyScroll();
  }

  closePreview(): void {
    this.showPreview.set(false);
    this.previewRsvp.set(null);
    this.unlockBodyScroll();
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
      latitude: formValue.latitude ?? null,
      longitude: formValue.longitude ?? null,
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

  // ── Responses modal methods ──────────────────────────────────────────────────

  openResponsesModal(rsvp: Rsvp): void {
    this.selectedRsvpForResponses.set(rsvp);
    this.responsesActiveTab.set('responded');
    this.responseFilterStatus.set('all');
    this.responseFilterShift.set('all');
    this.responseSearchQuery.set('');
    this.nonResponderSearchQuery.set('');
    this.nonRespondersPage.set(1);
    this.showExportPopover.set(false);
    this.resetExportColumns('responded');
    this.lockBodyScroll();
    this.showResponsesModal.set(true);
    this.loadResponded(rsvp.id);
    this.loadNonResponders();
  }

  closeResponsesModal(): void {
    this.showResponsesModal.set(false);
    this.unlockBodyScroll();
    this.selectedRsvpForResponses.set(null);
    this.respondedList.set([]);
    this.nonRespondersList.set([]);
    this.responsesError.set('');
    this.nonRespondersError.set('');
    this.showExportPopover.set(false);
  }

  switchResponsesTab(tab: 'responded' | 'not_responded'): void {
    this.responsesActiveTab.set(tab);
    this.showExportPopover.set(false);
    this.resetExportColumns(tab);
  }

  setResponseFilterStatus(status: 'all' | 'registered' | 'checked_in' | 'checked_out' | 'no_show'): void {
    this.responseFilterStatus.set(status);
  }

  setResponseFilterShift(shift: string): void {
    this.responseFilterShift.set(shift);
  }

  setResponseSearchQuery(q: string): void {
    this.responseSearchQuery.set(q);
  }

  setNonResponderSearchQuery(q: string): void {
    this.nonResponderSearch$.next(q);
  }

  loadNonResponders(): void {
    const rsvp = this.selectedRsvpForResponses();
    if (!rsvp) return;
    this.nonRespondersLoading.set(true);
    this.nonRespondersError.set('');
    this.adminService
      .getRsvpNonResponders(rsvp.id, {
        search: this.nonResponderSearchQuery() || undefined,
        page: this.nonRespondersPage(),
        perPage: 25,
      })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (res) => {
          this.nonRespondersLoading.set(false);
          if (res.success) {
            this.nonRespondersList.set(res.data);
            this.nonRespondersTotalPages.set(res.meta.last_page);
            this.nonRespondersTotal.set(res.meta.total);
          } else {
            this.nonRespondersError.set(res.message ?? 'Failed to load non-responders.');
            this.showFeedback(res.message ?? 'Failed to load non-responders.', 'error');
          }
        },
        error: (error: Error) => {
          console.error('Error loading non-responders:', error);
          this.nonRespondersLoading.set(false);
          this.nonRespondersError.set('Failed to load non-responders.');
          this.showFeedback('Failed to load non-responders.', 'error');
        }
      });
  }

  nextNonRespondersPage(): void {
    if (this.nonRespondersPage() < this.nonRespondersTotalPages()) {
      this.nonRespondersPage.update((p) => p + 1);
      this.loadNonResponders();
    }
  }

  prevNonRespondersPage(): void {
    if (this.nonRespondersPage() > 1) {
      this.nonRespondersPage.update((p) => p - 1);
      this.loadNonResponders();
    }
  }

  toggleExportPopover(): void {
    this.showExportPopover.update((v) => !v);
  }

  toggleExportColumn(col: string): void {
    this.exportColumns.update((cols) => ({ ...cols, [col]: !cols[col] }));
  }

  exportCsv(): void {
    const tab = this.responsesActiveTab();
    const cols = this.exportColumns();
    let rows: string[][];
    let headers: string[];

    if (tab === 'responded') {
      const allCols: { key: string; label: string }[] = [
        { key: 'name', label: 'Name' },
        { key: 'email', label: 'Email' },
        { key: 'department', label: 'Department' },
        { key: 'shift', label: 'Shift' },
        { key: 'status', label: 'Status' },
        { key: 'voted_at', label: 'Voted At' },
        { key: 'checked_in_at', label: 'Checked In At' },
        { key: 'checked_out_at', label: 'Checked Out At' },
      ];
      const active = allCols.filter((c) => cols[c.key]);
      headers = active.map((c) => c.label);
      rows = this.filteredResponded().map((r) =>
        active.map((c) => {
          if (c.key === 'name') return r.volunteer_name ?? '';
          if (c.key === 'email') return r.volunteer_email ?? '';
          if (c.key === 'department') return r.volunteer_department ?? '';
          if (c.key === 'shift') return r.time_slot ?? '';
          if (c.key === 'status') return r.attendance_status ?? '';
          if (c.key === 'voted_at') return r.voted_at ?? '';
          if (c.key === 'checked_in_at') return r.checked_in_at ?? '';
          if (c.key === 'checked_out_at') return r.checked_out_at ?? '';
          return '';
        }),
      );
    } else {
      const allCols: { key: string; label: string }[] = [
        { key: 'name', label: 'Name' },
        { key: 'email', label: 'Email' },
        { key: 'department', label: 'Department' },
        { key: 'mobile', label: 'Mobile Number' },
      ];
      const active = allCols.filter((c) => cols[c.key]);
      headers = active.map((c) => c.label);
      rows = this.nonRespondersList().map((r) =>
        active.map((c) => {
          if (c.key === 'name') return r.volunteer_name;
          if (c.key === 'email') return r.volunteer_email;
          if (c.key === 'department') return r.volunteer_department;
          if (c.key === 'mobile') return r.mobile_number;
          return '';
        }),
      );
    }

    const rsvp = this.selectedRsvpForResponses();
    const date = new Date().toISOString().split('T')[0];
    const filename = `rsvp-${rsvp?.id ?? 0}-${tab}-${date}.csv`;
    this.downloadCsv([headers, ...rows], filename);
    this.showExportPopover.set(false);
  }

  loadResponded(rsvpId: number): void {
    this.responsesLoading.set(true);
    this.responsesError.set('');
    this.adminService
      .fetchAttendanceFromRsvp(rsvpId)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (res) => {
          this.responsesLoading.set(false);
          if (res.success) {
            this.respondedList.set(res.data ?? []);
            this.resetExportColumns('responded');
          } else {
            this.responsesError.set(res.message ?? 'Failed to load responses.');
            this.showFeedback(res.message ?? 'Failed to load responses.', 'error');
          }
        },
        error: (error: Error) => {
          console.error('Error loading responses:', error);
          this.responsesLoading.set(false);
          this.responsesError.set('Failed to load responses.');
          this.showFeedback('Failed to load responses.', 'error');
        }
      });
  }

  private resetExportColumns(tab: 'responded' | 'not_responded'): void {
    if (tab === 'responded') {
      this.exportColumns.set({ name: true, email: true, department: true, shift: true, status: true, voted_at: true, checked_in_at: true, checked_out_at: true });
    } else {
      this.exportColumns.set({ name: true, email: true, department: true, mobile: true });
    }
  }

  private downloadCsv(rows: string[][], filename: string): void {
    const escape = (v: string) => {
      let s = (v ?? '').replace(/"/g, '""');
      if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`;
      return `"${s}"`;
    };    const csv = rows.map((r) => r.map(escape).join(',')).join('\r\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
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
