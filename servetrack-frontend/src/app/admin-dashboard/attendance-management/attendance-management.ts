import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  signal,
  output,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { AdminDashboardService, VolunteerUser } from '../../services/admin-dashboard.service';

interface AttendanceRecord {
  id: number;
  volunteerName: string;
  email: string;
  department: string;
  checkInTime: string | null;
  checkOutTime: string | null;
  duration: string | null;
  status: 'present' | 'absent';
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
export class AttendanceManagement {
  private adminDashboardService = inject(AdminDashboardService);

  // Outputs
  showSnackbar = output<{ message: string; type: 'success' | 'error' | 'info' }>();

  // View state
  attendanceView = signal<'daily' | 'history' | 'reports'>('daily');
  attendancePage = signal(1);
  attendancePerPage = signal(5);
  attendanceSearchQuery = signal('');
  attendanceDateFilter = signal(new Date().toISOString().split('T')[0]);

  // Modal states
  showAssignVolunteerModal = signal(false);
  showPhotoUploadModal = signal(false);
  showAttendanceDetailsModal = signal(false);
  selectedAttendanceRecord = signal<AttendanceRecord | null>(null);

  // Photo upload
  photoUploadProcessing = signal(false);
  photoUploadPreview = signal<string | null>(null);

  // Assignment
  availableVolunteersForAssignment = signal<VolunteerUser[]>([]);
  selectedVolunteersForAssignment = signal<number[]>([]);
  isAssigningVolunteers = signal(false);

  // Mock attendance data (will be replaced with API call)
  attendanceRecords = signal<AttendanceRecord[]>([
    { id: 1, volunteerName: 'Agnes Felix', email: 'agnes.felix@example.com', department: 'Mobile Kitchen Operations', checkInTime: '08:30 AM', checkOutTime: '12:00 PM', duration: '3h 30m', status: 'present' },
    { id: 2, volunteerName: 'Robbie Panaligan', email: 'robbie.panaligan@example.com', department: 'Relief Operations', checkInTime: '09:00 AM', checkOutTime: '11:30 AM', duration: '2h 30m', status: 'present' },
    { id: 3, volunteerName: 'Natasya Angelina Lim', email: 'natasya.lim@example.com', department: 'Mobile Kitchen Operations', checkInTime: '08:45 AM', checkOutTime: '01:00 PM', duration: '4h 15m', status: 'present' },
    { id: 4, volunteerName: 'Lea Therese Chua', email: 'lea.chua@example.com', department: 'Individual & Corporate Partnerships', checkInTime: '09:15 AM', checkOutTime: null, duration: null, status: 'present' },
    { id: 5, volunteerName: 'George Arvin Ventura', email: 'george.ventura@example.com', department: 'Mobile Kitchen Operations', checkInTime: null, checkOutTime: null, duration: null, status: 'absent' },
  ]);

  constructor() {}

  readonly Math = Math;

  // Computed signals for stats cards
  presentCount = computed(() =>
    this.attendanceRecords().filter((r) => r.status === 'present').length
  );

  absentCount = computed(() =>
    this.attendanceRecords().filter((r) => r.status === 'absent').length
  );

  totalAttendanceCount = computed(() => this.attendanceRecords().length);

  departmentCount = computed(() => {
    const departments = new Set(this.attendanceRecords().map((r) => r.department));
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
        r.volunteerName.toLowerCase().includes(search) ||
        r.email.toLowerCase().includes(search) ||
        r.department.toLowerCase().includes(search),
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
    this.attendanceRecords.update((records) =>
      records.map((r) => (r.id === recordId ? { ...r, status } : r)),
    );
    this.showSnackbar.emit({ message: `Attendance status updated to ${status}`, type: 'success' });
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
}
