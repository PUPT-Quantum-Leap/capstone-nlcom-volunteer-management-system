import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  signal,
  output,
  effect,
  untracked,
  OnInit,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { AdminDashboardService, VolunteerUser } from '../../services/admin-dashboard.service';
import { CustomSelect, SelectOption } from '../../components/custom-select/custom-select';
import { GlobalSearchService } from '../../services/global-search.service';
import { environment } from '../../../environments/environment';

interface AttendanceRecord {
  id: number; // rsvp_response_id
  rsvp_id: number;
  rsvp_title: string;
  rsvp_date: string;
  rsvp_location: string;
  volunteer_id: number;
  volunteerName: string;
  email: string;
  department: string;
  checkInTime: string | null;
  checkOutTime: string | null;
  duration: string | null;
  status: 'present' | 'absent';
  attendance_status: string;
}

interface DetectedVolunteer {
  name: string;
  confidence: number;
}

@Component({
  selector: 'app-attendance-management',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, CustomSelect],
  templateUrl: './attendance-management.html',
  styleUrl: './attendance-management.scss',
})
export class AttendanceManagement implements OnInit {
  protected readonly Math = Math;
  private adminDashboardService = inject(AdminDashboardService);
  private globalSearchService = inject(GlobalSearchService);

  // Dropdown Options
  viewOptions: SelectOption<'calendar' | 'history' | 'photos'>[] = [
    { label: 'Calendar View', value: 'calendar' },
    { label: 'Attendance Confirmation', value: 'history' },
    { label: 'Attendance Upload', value: 'photos' }
  ];

  statusOptions: SelectOption<'present' | 'absent'>[] = [
    { label: 'Present', value: 'present' },
    { label: 'Absent', value: 'absent' }
  ];

  // Outputs
  showSnackbar = output<{ message: string; type: 'success' | 'error' | 'info' }>();

  // View state
  attendanceView = signal<'calendar' | 'history' | 'photos'>('calendar');
  attendancePage = signal(1);
  attendancePerPage = signal(5);
  attendanceSearchQuery = this.globalSearchService.searchQuery;
  attendanceDateFilter = signal(new Date().toISOString().split('T')[0]);
  selectedEventFilter = signal<number>(0);

  eventsOptions = computed(() => {
    const records = this.attendanceRecords();
    const uniqueEvents = new Map<number, string>();
    records.forEach((r) => {
      if (r.rsvp_id && r.rsvp_title) {
        uniqueEvents.set(r.rsvp_id, r.rsvp_title);
      }
    });
    const options: SelectOption<number>[] = [{ label: 'All Events', value: 0 }];
    uniqueEvents.forEach((title, id) => {
      options.push({ label: title, value: id });
    });
    return options;
  });

  // Loading state
  isLoading = signal(false);

  // Modal states
  showAssignVolunteerModal = signal(false);
  showPhotoUploadModal = signal(false);
  showAttendanceDetailsModal = signal(false);
  showCalendarModal = signal(false);
  selectedAttendanceRecord = signal<AttendanceRecord | null>(null);

  // Photo upload & gallery
  photoUploadProcessing = signal(false);
  photoUploadPreview = signal<string | null>(null);
  selectedPhotoFile = signal<File | null>(null);
  detectedVolunteersFromPhoto = signal<DetectedVolunteer[]>([]);
  photos = signal<any[]>([]);
  showArchivedPhotos = signal(false);
  activeLightboxPhoto = signal<any | null>(null);

  // Calendar view state
  calendarDate = signal(new Date());
  weekDays = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
 
  // Assignment
  availableVolunteersForAssignment = signal<VolunteerUser[]>([]);
  selectedVolunteersForAssignment = signal<number[]>([]);
  isAssigningVolunteers = signal(false);

  // Attendance Records
  attendanceRecords = signal<AttendanceRecord[]>([]);

  constructor() {
    effect(() => {
      this.attendanceSearchQuery();
      untracked(() => {
        this.attendancePage.set(1);
      });
    });

    // Auto-reload photos when archived filter changes
    effect(() => {
      const archived = this.showArchivedPhotos();
      const view = this.attendanceView();
      untracked(() => {
        if (view === 'photos') {
          this.loadPhotos();
        }
      });
    });

    // Load initial gallery photos if we switch to photos view
    effect(() => {
      const view = this.attendanceView();
      untracked(() => {
        if (view === 'photos') {
          this.loadPhotos();
        }
      });
    });
  }

  ngOnInit(): void {
    this.loadAttendanceData();
  }

  // Load attendance data from API
  loadAttendanceData(): void {
    this.isLoading.set(true);
    this.adminDashboardService.getAttendanceFromRsvp().subscribe({
      next: (response) => {
        if (response.success && response.data) {
          const mapped: AttendanceRecord[] = response.data.map((item: any) => {
            const formatTime = (timeStr: string | null) => {
              if (!timeStr) return null;
              try {
                const date = new Date(timeStr);
                return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
              } catch {
                return timeStr;
              }
            };

            let duration = null;
            if (item.checked_in_at && item.checked_out_at) {
              const start = new Date(item.checked_in_at);
              const end = new Date(item.checked_out_at);
              const diffMs = end.getTime() - start.getTime();
              const diffMins = Math.floor(diffMs / 60000);
              const hrs = Math.floor(diffMins / 60);
              const mins = diffMins % 60;
              duration = hrs > 0 ? `${hrs}h ${mins}m` : `${mins}m`;
            } else if (item.time_slot) {
              duration = item.time_slot;
            }

            return {
              id: item.id,
              rsvp_id: item.rsvp_id,
              rsvp_title: item.rsvp_title,
              rsvp_date: item.rsvp_date,
              rsvp_location: item.rsvp_location,
              volunteer_id: item.volunteer_id,
              volunteerName: item.volunteer_name || 'Unknown',
              email: item.volunteer_email || 'No email',
              department: item.volunteer_department || 'Unassigned',
              checkInTime: formatTime(item.checked_in_at),
              checkOutTime: formatTime(item.checked_out_at),
              duration: duration,
              status: (item.attendance_status === 'checked_in' || item.attendance_status === 'checked_out') ? 'present' : 'absent',
              attendance_status: item.attendance_status,
            };
          });
          this.attendanceRecords.set(mapped);
        }
        this.isLoading.set(false);
      },
      error: (err) => {
        console.error('Failed to load attendance:', err);
        this.isLoading.set(false);
        this.showSnackbar.emit({ message: 'Failed to load attendance data', type: 'error' });
      }
    });
  }

  // Computed signals for stats cards (based on filtered list by date if in daily, or overall)
  presentCount = computed(() => {
    const selectedDate = this.attendanceDateFilter();
    const selectedEventId = this.selectedEventFilter();
    const records = this.attendanceRecords();
    
    if (this.attendanceView() === 'calendar') {
      return records.filter((r) => r.rsvp_date === selectedDate && r.status === 'present').length;
    } else if (this.attendanceView() === 'history' && selectedEventId !== 0) {
      return records.filter((r) => r.rsvp_id === selectedEventId && r.status === 'present').length;
    }
    return records.filter((r) => r.status === 'present').length;
  });

  absentCount = computed(() => {
    const selectedDate = this.attendanceDateFilter();
    const selectedEventId = this.selectedEventFilter();
    const records = this.attendanceRecords();
    
    if (this.attendanceView() === 'calendar') {
      return records.filter((r) => r.rsvp_date === selectedDate && r.status === 'absent').length;
    } else if (this.attendanceView() === 'history' && selectedEventId !== 0) {
      return records.filter((r) => r.rsvp_id === selectedEventId && r.status === 'absent').length;
    }
    return records.filter((r) => r.status === 'absent').length;
  });

  totalAttendanceCount = computed(() => {
    const selectedDate = this.attendanceDateFilter();
    const selectedEventId = this.selectedEventFilter();
    const records = this.attendanceRecords();
    
    if (this.attendanceView() === 'calendar') {
      return records.filter((r) => r.rsvp_date === selectedDate).length;
    } else if (this.attendanceView() === 'history' && selectedEventId !== 0) {
      return records.filter((r) => r.rsvp_id === selectedEventId).length;
    }
    return records.length;
  });

  departmentCount = computed(() => {
    const selectedDate = this.attendanceDateFilter();
    const selectedEventId = this.selectedEventFilter();
    const records = this.attendanceRecords();
    
    let targetRecords = records;
    if (this.attendanceView() === 'calendar') {
      targetRecords = records.filter((r) => r.rsvp_date === selectedDate);
    } else if (this.attendanceView() === 'history' && selectedEventId !== 0) {
      targetRecords = records.filter((r) => r.rsvp_id === selectedEventId);
    }
      
    const departments = new Set(targetRecords.map((r) => r.department));
    return departments.size;
  });

  filteredAttendance = computed(() => {
    const search = this.attendanceSearchQuery().toLowerCase().trim();
    const selectedDate = this.attendanceDateFilter();
    const selectedEventId = this.selectedEventFilter();
    let records = this.attendanceRecords();

    // Filter by selected date in calendar view
    if (this.attendanceView() === 'calendar') {
      records = records.filter((r) => r.rsvp_date === selectedDate);
    } else if (this.attendanceView() === 'history') {
      if (selectedEventId !== 0) {
        records = records.filter((r) => r.rsvp_id === selectedEventId);
      }
    }

    if (!search) {
      return records;
    }

    return records.filter(
      (r) =>
        r.volunteerName.toLowerCase().includes(search) ||
        r.email.toLowerCase().includes(search) ||
        r.department.toLowerCase().includes(search) ||
        (r.rsvp_title && r.rsvp_title.toLowerCase().includes(search))
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

  presentVolunteers = computed(() => {
    return this.filteredAttendance().filter((r) => r.status === 'present');
  });

  absentVolunteers = computed(() => {
    return this.filteredAttendance().filter((r) => r.status === 'absent');
  });

  // View methods
  setAttendanceView(view: 'calendar' | 'history' | 'photos'): void {
    this.attendanceView.set(view);
    this.attendancePage.set(1);
    this.selectedEventFilter.set(0);
    if (view === 'calendar') {
      this.showCalendarModal.set(true);
    }
  }

  closeCalendarModal(): void {
    this.showCalendarModal.set(false);
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

  // Status update calling API
  updateAttendanceStatus(recordId: number, status: 'present' | 'absent'): void {
    this.adminDashboardService.updateAttendanceStatus(recordId, status).subscribe({
      next: (response) => {
        if (response.success) {
          this.showSnackbar.emit({ message: `Attendance status updated to ${status}`, type: 'success' });
          this.loadAttendanceData();
        } else {
          this.showSnackbar.emit({ message: response.message || 'Failed to update status', type: 'error' });
        }
      },
      error: (err) => {
        console.error('Error updating attendance status:', err);
        this.showSnackbar.emit({ message: 'Error communicating with server', type: 'error' });
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

  // Export using window downloads
  exportAttendanceToPDF(): void {
    const search = this.attendanceSearchQuery();
    let url = `${environment.apiUrl}/admin/attendance/export/pdf?search=${search}`;
    
    if (this.attendanceView() === 'calendar') {
      url += `&date=${this.attendanceDateFilter()}`;
    } else if (this.attendanceView() === 'history' && this.selectedEventFilter() !== 0) {
      url += `&rsvp_id=${this.selectedEventFilter()}`;
    }
    
    this.showSnackbar.emit({ message: 'Exporting attendance to PDF...', type: 'info' });
    window.open(url, '_blank');
  }

  exportAttendanceToExcel(): void {
    const search = this.attendanceSearchQuery();
    let url = `${environment.apiUrl}/admin/attendance/export/excel?search=${search}`;
    
    if (this.attendanceView() === 'calendar') {
      url += `&date=${this.attendanceDateFilter()}`;
    } else if (this.attendanceView() === 'history' && this.selectedEventFilter() !== 0) {
      url += `&rsvp_id=${this.selectedEventFilter()}`;
    }
    
    this.showSnackbar.emit({ message: 'Exporting attendance to Excel...', type: 'info' });
    window.open(url, '_blank');
  }

  // Photo upload modal
  openPhotoUploadModal(): void {
    this.showPhotoUploadModal.set(true);
    this.photoUploadPreview.set(null);
    this.selectedPhotoFile.set(null);
    this.photoUploadProcessing.set(false);
  }

  closePhotoUploadModal(): void {
    this.showPhotoUploadModal.set(false);
    this.photoUploadPreview.set(null);
    this.selectedPhotoFile.set(null);
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

    this.selectedPhotoFile.set(file);

    const reader = new FileReader();
    reader.onload = () => {
      this.photoUploadPreview.set(reader.result as string);
    };
    reader.readAsDataURL(file);
  }

  async uploadPhoto(): Promise<void> {
    const file = this.selectedPhotoFile();
    if (!file) {
      this.showSnackbar.emit({ message: 'Please select a photo first', type: 'error' });
      return;
    }

    this.photoUploadProcessing.set(true);

    this.adminDashboardService.uploadAttendancePhoto(file).subscribe({
      next: (response) => {
        this.photoUploadProcessing.set(false);
        if (response.success) {
          this.closePhotoUploadModal();
          this.showSnackbar.emit({ message: 'Photo uploaded successfully. It will be archived after 30 days.', type: 'success' });
          this.loadAttendanceData();
          this.loadPhotos();
        } else {
          this.showSnackbar.emit({ message: response.message || 'Failed to upload photo', type: 'error' });
        }
      },
      error: (err) => {
        this.photoUploadProcessing.set(false);
        console.error('Error uploading photo:', err);
        this.showSnackbar.emit({ message: 'Error uploading photo to server', type: 'error' });
      }
    });
  }

  // Load photos from API
  loadPhotos(): void {
    this.isLoading.set(true);
    this.adminDashboardService.getAttendancePhotos(this.showArchivedPhotos()).subscribe({
      next: (response) => {
        if (response.success && response.data) {
          const items = response.data.data || [];
          this.photos.set(items.map((p: any) => {
            const uploadedAt = new Date(p.uploaded_at || p.created_at);
            const archiveDeadline = new Date(uploadedAt.getTime() + 30 * 24 * 60 * 60 * 1000);
            const now = new Date();
            const diffTime = archiveDeadline.getTime() - now.getTime();
            const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

            return {
              ...p,
              url: p.file_path ? `${environment.apiUrl.replace('/api', '')}/storage/${p.file_path}` : null,
              daysLeft: diffDays > 0 ? diffDays : 0,
              formattedUploadedAt: uploadedAt.toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' })
            };
          }));
        }
        this.isLoading.set(false);
      },
      error: (err) => {
        console.error('Failed to load photos:', err);
        this.isLoading.set(false);
      }
    });
  }

  deletePhoto(photoId: number): void {
    if (confirm('Are you sure you want to delete this photo?')) {
      this.adminDashboardService.deleteAttendancePhoto(photoId).subscribe({
        next: (response) => {
          if (response.success) {
            this.showSnackbar.emit({ message: 'Photo deleted successfully', type: 'success' });
            this.loadPhotos();
          } else {
            this.showSnackbar.emit({ message: response.message || 'Failed to delete photo', type: 'error' });
          }
        },
        error: (err) => {
          console.error('Error deleting photo:', err);
          this.showSnackbar.emit({ message: 'Error communicating with server', type: 'error' });
        }
      });
    }
  }

  // Lightbox
  openLightbox(photo: any): void {
    this.activeLightboxPhoto.set(photo);
  }

  closeLightbox(): void {
    this.activeLightboxPhoto.set(null);
  }

  // Calendar helpers
  prevMonth(): void {
    const current = this.calendarDate();
    this.calendarDate.set(new Date(current.getFullYear(), current.getMonth() - 1, 1));
  }

  nextMonth(): void {
    const current = this.calendarDate();
    this.calendarDate.set(new Date(current.getFullYear(), current.getMonth() + 1, 1));
  }

  getCalendarCells(): (number | null)[] {
    const date = this.calendarDate();
    const year = date.getFullYear();
    const month = date.getMonth();
    const firstDay = new Date(year, month, 1).getDay();
    const totalDays = new Date(year, month + 1, 0).getDate();

    const cells: (number | null)[] = [];
    for (let i = 0; i < firstDay; i++) {
      cells.push(null);
    }
    for (let i = 1; i <= totalDays; i++) {
      cells.push(i);
    }
    return cells;
  }

  getAttendanceForDate(day: number) {
    const date = this.calendarDate();
    const year = date.getFullYear();
    const month = date.getMonth();
    const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    
    const dayRecords = this.attendanceRecords().filter((r) => r.rsvp_date === dateStr);
    const present = dayRecords.filter((r) => r.status === 'present').length;
    const absent = dayRecords.filter((r) => r.status === 'absent').length;

    return {
      dateStr,
      present,
      absent,
      total: dayRecords.length
    };
  }

  selectCalendarDay(dateStr: string): void {
    this.attendanceDateFilter.set(dateStr);
    this.attendancePage.set(1);
    this.attendanceView.set('calendar');
    this.showCalendarModal.set(false);
    this.showSnackbar.emit({ message: `Viewing attendance for ${dateStr}`, type: 'success' });
  }

  // Assignment modal mock functions
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

  isEditable(record: AttendanceRecord): boolean {
    if (!record.rsvp_date) return true;
    try {
      const eventDate = new Date(record.rsvp_date);
      eventDate.setHours(0, 0, 0, 0);
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      const diffTime = today.getTime() - eventDate.getTime();
      const diffDays = diffTime / (1000 * 60 * 60 * 24);
      return diffDays <= 7;
    } catch {
      return true;
    }
  }
}

