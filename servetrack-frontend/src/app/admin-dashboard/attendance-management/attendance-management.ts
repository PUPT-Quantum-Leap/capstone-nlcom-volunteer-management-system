import { ChangeDetectionStrategy, Component, computed, inject, signal, output, OnInit, DestroyRef } from '@angular/core';
import { CommonModule, NgOptimizedImage } from '@angular/common';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { AdminDashboardService, VolunteerUser } from '../../services/admin-dashboard.service';

interface AttendanceRecord {
  id: number;
  rsvp_id: number;
  rsvp_title: string;
  rsvp_date: string;
  rsvp_location: string | null;
  cutoff_passed: boolean;
  volunteer_id: number;
  volunteer_name: string;
  volunteer_email: string;
  volunteer_department: string;
  time_slot: string | null;
  voted_at: string;
  checked_in_at: string | null;
  checked_out_at: string | null;
  attendance_status: string;
}

interface DetectedVolunteer {
  name: string;
  confidence: number;
}

@Component({
  selector: 'app-attendance-management',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule],
  templateUrl: './attendance-management.html',
  styleUrl: './attendance-management.scss',
})
export class AttendanceManagement implements OnInit {
  private adminDashboardService = inject(AdminDashboardService);
  private destroyRef = inject(DestroyRef);

  // Outputs
  showSnackbar = output<{ message: string; type: 'success' | 'error' | 'info' }>();

  // View state
  attendanceView = signal<'daily' | 'history' | 'reports'>('daily');
  attendancePage = signal(1);
  attendancePerPage = signal(5);
  attendanceSearchQuery = signal('');
  attendanceDateFilter = signal(new Date().toISOString().split('T')[0]);
  selectedRsvpId = signal<number | null>(null);
  isLoading = signal(false);

  // Modal states
  showAssignVolunteerModal = signal(false);
  showPhotoUploadModal = signal(false);
  showAttendanceDetailsModal = signal(false);
  selectedAttendanceRecord = signal<AttendanceRecord | null>(null);

  // Photo upload
  photoUploadProcessing = signal(false);
  photoUploadPreview = signal<string | null>(null);
  detectedVolunteersFromPhoto = signal<DetectedVolunteer[]>([]);

  // Assignment
  availableVolunteersForAssignment = signal<VolunteerUser[]>([]);
  selectedVolunteersForAssignment = signal<number[]>([]);
  isAssigningVolunteers = signal(false);

  // RSVP attendance data
  attendanceRecords = signal<AttendanceRecord[]>([]);
  availableRsvps = signal<{id: number, title: string, date: string}[]>([]);

  constructor() {}

  readonly Math = Math;

  ngOnInit(): void {
    this.loadAttendanceFromRsvp();
  }

  loadAttendanceFromRsvp(): void {
    this.isLoading.set(true);
    this.adminDashboardService.getAttendanceFromRsvp(this.selectedRsvpId() ?? undefined)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (response) => {
          if (response.success) {
            this.attendanceRecords.set(response.data ?? []);
            this.loadAvailableRsvps();
          }
          this.isLoading.set(false);
        },
        error: () => {
          this.isLoading.set(false);
        }
      });
  }

  loadAvailableRsvps(): void {
    // Extract unique RSVPs from the attendance records
    const uniqueRsvps = new Map<number, {id: number, title: string, date: string}>();
    this.attendanceRecords().forEach(record => {
      if (!uniqueRsvps.has(record.rsvp_id)) {
        uniqueRsvps.set(record.rsvp_id, {
          id: record.rsvp_id,
          title: record.rsvp_title,
          date: record.rsvp_date
        });
      }
    });
    this.availableRsvps.set(Array.from(uniqueRsvps.values()));
  }

  onRsvpFilterChange(value: string): void {
    this.selectedRsvpId.set(value === '' ? null : parseInt(value, 10));
    this.loadAttendanceFromRsvp();
  }

  selectedRsvpTitle = computed(() => {
    const rsvp = this.availableRsvps().find(r => r.id === this.selectedRsvpId());
    return rsvp ? rsvp.title : 'All Events';
  });

  // Computed signals for stats cards
  presentCount = computed(() =>
    this.attendanceRecords().filter((r) => r.attendance_status === 'checked_in' || r.attendance_status === 'checked_out').length
  );

  absentCount = computed(() =>
    this.attendanceRecords().filter((r) => r.attendance_status === 'no_show').length
  );

  totalAttendanceCount = computed(() => this.attendanceRecords().length);

  departmentCount = computed(() => {
    const departments = new Set(this.attendanceRecords().map((r) => r.volunteer_department));
    return departments.size;
  });

  filteredAttendance = computed(() => {
    const search = this.attendanceSearchQuery().toLowerCase().trim();
    const records = this.attendanceRecords();

    if (!search) {
      return records;
    }

    return records.filter(
      (r) =>
        r.volunteer_name.toLowerCase().includes(search) ||
        r.volunteer_email.toLowerCase().includes(search) ||
        r.volunteer_department.toLowerCase().includes(search),
    );
  });

  paginatedAttendance = computed(() => {
    const filtered = this.filteredAttendance();
    const page = this.attendancePage();
    const perPage = this.attendancePerPage();
    const start = (page - 1) * perPage;
    const end = start + perPage;
    return filtered.slice(start, end);
  });

  attendanceTotalPages = computed(() =>
    Math.ceil(this.filteredAttendance().length / this.attendancePerPage()),
  );

  // View methods
  setAttendanceView(view: 'daily' | 'history' | 'reports'): void {
    this.attendanceView.set(view);
    this.attendancePage.set(1);
  }

  // Search and filter
  setAttendanceSearchQuery(query: string): void {
    this.attendanceSearchQuery.set(query);
    this.attendancePage.set(1);
  }

  setAttendanceDateFilter(date: string): void {
    this.attendanceDateFilter.set(date);
    this.attendancePage.set(1);
  }

  // Pagination
  previousAttendancePage(): void {
    if (this.attendancePage() > 1) {
      this.attendancePage.update((p) => p - 1);
    }
  }

  nextAttendancePage(): void {
    if (this.attendancePage() < this.attendanceTotalPages()) {
      this.attendancePage.update((p) => p + 1);
    }
  }

  goToAttendancePage(page: number): void {
    this.attendancePage.set(page);
  }

  getAttendancePageNumbers(): number[] {
    const total = this.attendanceTotalPages();
    const current = this.attendancePage();
    const pages: number[] = [];

    if (total <= 7) {
      for (let i = 1; i <= total; i++) {
        pages.push(i);
      }
    } else {
      if (current <= 3) {
        pages.push(1, 2, 3, 4, -1, total);
      } else if (current >= total - 2) {
        pages.push(1, -1, total - 3, total - 2, total - 1, total);
      } else {
        pages.push(1, -1, current - 1, current, current + 1, -1, total);
      }
    }

    return pages;
  }

  // Status update
  updateAttendanceStatus(recordId: number, status: 'present' | 'absent'): void {
    const apiStatus = status === 'present' ? 'checked_in' : 'no_show';
    this.adminDashboardService.updateAttendanceStatus(recordId, status)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (response) => {
          if (response.success) {
            // Update local state
            this.attendanceRecords.update((records) =>
              records.map((r) => (r.id === recordId ? { ...r, attendance_status: apiStatus } : r)),
            );
            this.showSnackbar.emit({ message: `Attendance status updated to ${status}`, type: 'success' });
          } else {
            this.showSnackbar.emit({ message: response.message || 'Failed to update status', type: 'error' });
          }
        },
        error: () => {
          this.showSnackbar.emit({ message: 'Failed to update attendance status', type: 'error' });
        }
      });
  }

  // View details
  viewAttendanceDetails(record: AttendanceRecord): void {
    this.selectedAttendanceRecord.set(record);
    this.showAttendanceDetailsModal.set(true);
  }

  closeAttendanceDetailsModal(): void {
    this.showAttendanceDetailsModal.set(false);
    this.selectedAttendanceRecord.set(null);
  }

  // Export
  exportAttendanceToPDF(): void {
    this.showSnackbar.emit({ message: 'Exporting attendance to PDF...', type: 'info' });
  }

  exportAttendanceToExcel(): void {
    this.showSnackbar.emit({ message: 'Exporting attendance to Excel...', type: 'info' });
  }

  // Photo upload modal
  openPhotoUploadModal(): void {
    this.showPhotoUploadModal.set(true);
    this.photoUploadPreview.set(null);
    this.photoUploadProcessing.set(false);
  }

  closePhotoUploadModal(): void {
    this.showPhotoUploadModal.set(false);
    this.photoUploadPreview.set(null);
    this.photoUploadProcessing.set(false);
  }

  onPhotoSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];

    if (!file) return;

    if (!file.type.startsWith('image/')) {
      this.showSnackbar.emit({ message: 'Please select a valid image file', type: 'error' });
      return;
    }

    if (file.size > 10 * 1024 * 1024) {
      this.showSnackbar.emit({ message: 'Image file size should be less than 10MB', type: 'error' });
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      this.photoUploadPreview.set(reader.result as string);
    };
    reader.readAsDataURL(file);
  }

  async uploadPhoto(): Promise<void> {
    if (!this.photoUploadPreview()) {
      this.showSnackbar.emit({ message: 'Please upload a photo first', type: 'error' });
      return;
    }

    this.photoUploadProcessing.set(true);

    // TODO: Implement actual API call to upload photo
    // For now, simulate upload
    await new Promise((resolve) => setTimeout(resolve, 1500));

    this.photoUploadProcessing.set(false);
    this.closePhotoUploadModal();
    this.showSnackbar.emit({ message: 'Photo uploaded successfully. It will be archived after 5 days.', type: 'success' });
  }

  async processPhotoOCR(): Promise<void> {
    if (!this.photoUploadPreview()) return;
    
    this.photoUploadProcessing.set(true);
    // Simulate OCR processing
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    // Mock detected volunteers
    this.detectedVolunteersFromPhoto.set([
      { name: 'Agnes Felix', confidence: 0.98 },
      { name: 'Robbie Panaligan', confidence: 0.95 },
      { name: 'Natasya Angelina Lim', confidence: 0.92 }
    ]);
    
    this.photoUploadProcessing.set(false);
    this.showSnackbar.emit({ message: 'Photo processed. Detected 3 volunteers.', type: 'success' });
  }

  markDetectedVolunteersAsPresent(): void {
    const detectedNames = this.detectedVolunteersFromPhoto().map(v => v.name);
    const recordsToUpdate = this.attendanceRecords().filter(r => 
      detectedNames.includes(r.volunteer_name) && 
      r.attendance_status !== 'checked_in' && 
      r.attendance_status !== 'checked_out'
    );

    if (recordsToUpdate.length === 0) {
      this.showSnackbar.emit({ message: 'No new volunteers to mark as present', type: 'info' });
      return;
    }

    // Persist each update to the API
    let successCount = 0;
    recordsToUpdate.forEach(record => {
      this.adminDashboardService.updateAttendanceStatus(record.id, 'present')
        .pipe(takeUntilDestroyed(this.destroyRef))
        .subscribe({
          next: (response) => {
            if (response.success) {
              this.attendanceRecords.update(records =>
                records.map(r => r.id === record.id ? { ...r, attendance_status: 'checked_in' } : r)
              );
              successCount++;
              if (successCount === recordsToUpdate.length) {
                this.showSnackbar.emit({ message: `Successfully marked ${successCount} volunteers as present`, type: 'success' });
              }
            }
          }
        });
    });

    this.detectedVolunteersFromPhoto.set([]);
  }

  // Assignment modal
  openAssignVolunteerModal(): void {
    this.showAssignVolunteerModal.set(true);
    this.selectedVolunteersForAssignment.set([]);
  }

  closeAssignVolunteerModal(): void {
    this.showAssignVolunteerModal.set(false);
    this.selectedVolunteersForAssignment.set([]);
  }

  toggleVolunteerSelection(volunteerId: number): void {
    const current = this.selectedVolunteersForAssignment();
    if (current.includes(volunteerId)) {
      this.selectedVolunteersForAssignment.set(current.filter((id) => id !== volunteerId));
    } else {
      this.selectedVolunteersForAssignment.set([...current, volunteerId]);
    }
  }

  selectAllVolunteers(): void {
    // Mock - would use availableVolunteersForAssignment in real implementation
    this.showSnackbar.emit({ message: 'Select all functionality', type: 'info' });
  }

  clearVolunteerSelection(): void {
    this.selectedVolunteersForAssignment.set([]);
  }

  async assignSelectedVolunteers(): Promise<void> {
    if (this.selectedVolunteersForAssignment().length === 0) {
      this.showSnackbar.emit({ message: 'Please select at least one volunteer', type: 'error' });
      return;
    }

    this.isAssigningVolunteers.set(true);
    await new Promise((resolve) => setTimeout(resolve, 1000));
    this.isAssigningVolunteers.set(false);
    this.closeAssignVolunteerModal();
    this.showSnackbar.emit({ message: 'Volunteers assigned successfully', type: 'success' });
  }

  getAttendanceStatusClass(status: string): string {
    if (status === 'checked_in' || status === 'checked_out' || status === 'present') return 'dropdown-present';
    if (status === 'no_show' || status === 'absent') return 'dropdown-absent';
    return '';
  }

  getDisplayStatus(attendanceStatus: string | null | undefined): 'present' | 'absent' {
    if (attendanceStatus === 'no_show' || attendanceStatus === 'absent') {
      return 'absent';
    }
    // Default to present for null, undefined, empty, checked_in, checked_out, or present
    return 'present';
  }
}
