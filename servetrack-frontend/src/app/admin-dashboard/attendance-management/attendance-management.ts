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
import { AdminDashboardService } from '../../services/admin-dashboard.service';
import { VolunteerUser } from '../../models/user';
import { CustomSelect, SelectOption } from '../../components/custom-select/custom-select';
import { GlobalSearchService } from '../../services/global-search.service';
import { environment } from '../../../environments/environment';
import { Rsvp } from '../../models/rsvp';
import { RsvpService } from '../../services/rsvp.service';


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
  private rsvpService = inject(RsvpService);

  // Dropdown Options
  viewOptions: SelectOption<'events' | 'photos'>[] = [
    { label: 'RSVP Events', value: 'events' },
    { label: 'Attendance Upload', value: 'photos' }
  ];

  statusOptions: SelectOption<'present' | 'absent'>[] = [
    { label: 'Present', value: 'present' },
    { label: 'Absent', value: 'absent' }
  ];

  // Outputs
  showSnackbar = output<{ message: string; type: 'success' | 'error' | 'info' }>();

  // View state
  attendanceView = signal<'events' | 'photos'>('events');
  attendancePage = signal(1);
  attendancePerPage = signal(5);
  attendanceSearchQuery = this.globalSearchService.searchQuery;
  selectedRsvp = signal<Rsvp | null>(null);
  rsvps = signal<Rsvp[]>([]);
  rsvpDateFilter = signal<string>('');
  filteredRsvps = computed(() => {
    const list = this.rsvps();
    const search = this.attendanceSearchQuery().toLowerCase().trim();
    const dateFilter = this.rsvpDateFilter();

    let filtered = list;

    if (dateFilter) {
      filtered = filtered.filter((event) => this.formatAsYmd(event.date) === dateFilter);
    }

    if (!search) {
      return filtered;
    }

    return filtered.filter(
      (event) =>
        event.title.toLowerCase().includes(search) ||
        (event.eventLocation && event.eventLocation.toLowerCase().includes(search))
    );
  });
  rsvpPage = signal(1);
  rsvpPerPage = signal(10);

  paginatedRsvpsList = computed(() => {
    const list = this.filteredRsvps();
    const page = this.rsvpPage();
    const perPage = this.rsvpPerPage();
    const start = (page - 1) * perPage;
    const end = start + perPage;
    return list.slice(start, end);
  });

  rsvpTotalPages = computed(() =>
    Math.ceil(this.filteredRsvps().length / this.rsvpPerPage()),
  );
  attendeeFilter = signal<'all' | 'present' | 'absent'>('all');
  attendeePage = signal(1);
  attendeePerPage = signal(10);

  paginatedAttendeesList = computed(() => {
    const list = this.filteredAttendeesList();
    const page = this.attendeePage();
    const perPage = this.attendeePerPage();
    const start = (page - 1) * perPage;
    const end = start + perPage;
    return list.slice(start, end);
  });

  attendeeTotalPages = computed(() =>
    Math.ceil(this.filteredAttendeesList().length / this.attendeePerPage()),
  );

  attendanceRate = computed(() => {
    const total = this.totalAttendanceCount();
    return total > 0 ? Math.round((this.presentCount() / total) * 100) : 0;
  });

  // Loading state
  isLoading = signal(false);

  // Modal states
  showAssignVolunteerModal = signal(false);
  showPhotoUploadModal = signal(false);
  showAttendanceDetailsModal = signal(false);
  selectedAttendanceRecord = signal<AttendanceRecord | null>(null);

  // Photo upload & gallery
  photoUploadProcessing = signal(false);
  photoUploadPreview = signal<string | null>(null);
  selectedPhotoFile = signal<File | null>(null);
  detectedVolunteersFromPhoto = signal<DetectedVolunteer[]>([]);
  photos = signal<any[]>([]);
  showArchivedPhotos = signal(false);
  activeLightboxPhoto = signal<any | null>(null);
 
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
        this.rsvpPage.set(1);
        this.attendeePage.set(1);
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
    this.loadRsvpEvents();
  }

  // Load attendance data from API
  loadAttendanceData(): void {
    this.isLoading.set(true);
    this.adminDashboardService.fetchAttendanceFromRsvp().subscribe({
      next: (response) => {
        if (response.success && response.data) {
          const mapped: AttendanceRecord[] = response.data.map((item: any) => {
            const formatTime = (timeStr: string | null) => {
              if (!timeStr) return null;
              try {
                const date = new Date(timeStr);
                return date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
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
              status: item.attendance_status === 'no_show' ? 'absent' : 'present',
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

  loadRsvpEvents(): void {
    this.isLoading.set(true);
    this.rsvpService.getRsvps().subscribe({
      next: (response) => {
        this.rsvps.set(response.data || []);
        this.isLoading.set(false);
      },
      error: (err) => {
        console.error('Failed to load RSVP events:', err);
        this.isLoading.set(false);
        this.showSnackbar.emit({ message: 'Failed to load RSVP events', type: 'error' });
      }
    });
  }

  presentCount = computed(() => {
    const records = this.attendanceRecords();
    
    if (this.attendanceView() === 'events') {
      const selected = this.selectedRsvp();
      return selected ? records.filter((r) => r.rsvp_id === selected.id && r.status === 'present').length : 0;
    }
    return records.filter((r) => r.status === 'present').length;
  });

  absentCount = computed(() => {
    const records = this.attendanceRecords();
    
    if (this.attendanceView() === 'events') {
      const selected = this.selectedRsvp();
      return selected ? records.filter((r) => r.rsvp_id === selected.id && r.status === 'absent').length : 0;
    }
    return records.filter((r) => r.status === 'absent').length;
  });

  totalAttendanceCount = computed(() => {
    const records = this.attendanceRecords();
    
    if (this.attendanceView() === 'events') {
      const selected = this.selectedRsvp();
      return selected ? records.filter((r) => r.rsvp_id === selected.id).length : 0;
    }
    return records.length;
  });

  departmentCount = computed(() => {
    const records = this.attendanceRecords();
    
    let targetRecords = records;
    if (this.attendanceView() === 'events') {
      const selected = this.selectedRsvp();
      targetRecords = selected ? records.filter((r) => r.rsvp_id === selected.id) : [];
    }
      
    const departments = new Set(targetRecords.map((r) => r.department));
    return departments.size;
  });

  filteredAttendance = computed(() => {
    const search = this.attendanceSearchQuery().toLowerCase().trim();
    let records = this.attendanceRecords();

    if (this.attendanceView() === 'events') {
      const selected = this.selectedRsvp();
      if (selected) {
        records = records.filter((r) => r.rsvp_id === selected.id);
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




  filteredAttendeesList = computed(() => {
    const list = this.filteredAttendance();
    const filter = this.attendeeFilter();
    if (filter === 'present') {
      return list.filter((r) => r.status === 'present');
    } else if (filter === 'absent') {
      return list.filter((r) => r.status === 'absent');
    }
    return list;
  });

  // View methods
  setAttendanceView(view: 'events' | 'photos'): void {
    this.attendanceView.set(view);
    this.attendancePage.set(1);
    this.rsvpPage.set(1);
    this.attendeePage.set(1);
    this.selectedRsvp.set(null);
    this.attendeeFilter.set('all');
  }

  updateSearchQuery(query: string): void {
    this.globalSearchService.setSearchQuery(query);
  }

  selectRsvp(rsvp: Rsvp): void {
    this.selectedRsvp.set(rsvp);
    this.attendancePage.set(1);
    this.attendeePage.set(1);
    this.attendeeFilter.set('all');
  }

  clearSelectedRsvp(): void {
    this.selectedRsvp.set(null);
    this.attendeeFilter.set('all');
    this.attendeePage.set(1);
    this.globalSearchService.clearSearchQuery();
  }

  setRsvpDateFilter(date: string): void {
    this.rsvpDateFilter.set(date);
    this.rsvpPage.set(1);
  }

  clearRsvpDateFilter(): void {
    this.rsvpDateFilter.set('');
    this.rsvpPage.set(1);
  }

  setAttendeeFilter(filter: 'all' | 'present' | 'absent'): void {
    this.attendeeFilter.set(filter);
    this.attendeePage.set(1);
  }

  // Pagination for Attendees
  previousAttendeePage(): void {
    if (this.attendeePage() > 1) {
      this.attendeePage.update((p) => p - 1);
    }
  }

  nextAttendeePage(): void {
    if (this.attendeePage() < this.attendeeTotalPages()) {
      this.attendeePage.update((p) => p + 1);
    }
  }

  goToAttendeePage(page: number): void {
    this.attendeePage.set(page);
  }

  getAttendeePageNumbers(): number[] {
    const total = this.attendeeTotalPages();
    const current = this.attendeePage();
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



  // Pagination for RSVP Events
  previousRsvpPage(): void {
    if (this.rsvpPage() > 1) {
      this.rsvpPage.update((p) => p - 1);
    }
  }

  nextRsvpPage(): void {
    if (this.rsvpPage() < this.rsvpTotalPages()) {
      this.rsvpPage.update((p) => p + 1);
    }
  }

  goToRsvpPage(page: number): void {
    this.rsvpPage.set(page);
  }

  getRsvpPageNumbers(): number[] {
    const total = this.rsvpTotalPages();
    const current = this.rsvpPage();
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
    
    if (this.attendanceView() === 'events' && this.selectedRsvp()) {
      url += `&rsvp_id=${this.selectedRsvp()!.id}`;
    }
    
    this.showSnackbar.emit({ message: 'Exporting attendance to PDF...', type: 'info' });
    window.open(url, '_blank');
  }

  exportAttendanceToExcel(): void {
    const search = this.attendanceSearchQuery();
    let url = `${environment.apiUrl}/admin/attendance/export/excel?search=${search}`;
    
    if (this.attendanceView() === 'events' && this.selectedRsvp()) {
      url += `&rsvp_id=${this.selectedRsvp()!.id}`;
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
    this.adminDashboardService.fetchAttendancePhotos(this.showArchivedPhotos()).subscribe({
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

  private formatAsYmd(dateStr: string | null | undefined): string {
    if (!dateStr) return '';
    try {
      const parsed = new Date(dateStr);
      if (Number.isNaN(parsed.getTime())) return dateStr;
      return `${parsed.getFullYear()}-${String(parsed.getMonth() + 1).padStart(2, '0')}-${String(parsed.getDate()).padStart(2, '0')}`;
    } catch {
      return dateStr;
    }
  }
}

