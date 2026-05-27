import {
  ChangeDetectionStrategy,
  Component,
  OnInit,
  computed,
  inject,
  signal,
  DestroyRef,
  output,
  effect,
  untracked,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { CustomSelect, SelectOption } from '../../components/custom-select/custom-select';
import {
  AdminDashboardService,
  ApiResponse,
  DashboardVolunteerRow,
  VolunteerUser,
  VolunteersResponse,
} from '../../services/admin-dashboard.service';
import { GlobalSearchService } from '../../services/global-search.service';

@Component({
  selector: 'app-volunteer-management',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, CustomSelect],
  templateUrl: './volunteer-management.html',
  styleUrl: './volunteer-management.scss',
})
export class VolunteerManagement implements OnInit {
  private adminDashboardService = inject(AdminDashboardService);
  private destroyRef = inject(DestroyRef);
  private globalSearchService = inject(GlobalSearchService);

  // Dropdown Options
  statusOptions: SelectOption<string>[] = [
    { label: 'Active Volunteers', value: 'active' },
    { label: 'Archived Volunteers', value: 'archived' }
  ];

  // Outputs
  showSnackbar = output<{ message: string; type: 'success' | 'error' | 'info' }>();

  // Signals
  isLoading = signal(false);
  volunteerRows = signal<DashboardVolunteerRow[]>([]);
  archivedVolunteerRows = signal<DashboardVolunteerRow[]>([]);
  showArchivedVolunteers = signal(false);
  volunteerSearchQuery = this.globalSearchService.searchQuery;
  volunteersPage = signal(1);
  volunteersPerPage = signal(5);
  deletingVolunteerId = signal<number | null>(null);
  isSaving = signal(false);
  editingVolunteer = signal<DashboardVolunteerRow | null>(null);
  viewingVolunteer = signal<DashboardVolunteerRow | null>(null);
  showEditModal = signal(false);
  showDeleteModal = signal(false);
  showViewModal = signal(false);
  showEditSuccess = signal(false);
  showRestoreModal = signal(false);
  restoringVolunteerId = signal<number | null>(null);
  editFormData = signal<{
    first_name: string;
    last_name: string;
    email: string;
    mobile_number: string;
    facebook_name: string;
  }>({
    first_name: '',
    last_name: '',
    email: '',
    mobile_number: '',
    facebook_name: '',
  });

  readonly editFormErrors = signal<Record<string, string>>({});

  // Computed
  readonly activeVolunteersCount = computed(() => this.volunteerRows().length);

  readonly archivedVolunteersCount = computed(() => this.archivedVolunteerRows().length);

  readonly totalVolunteersCount = computed(() =>
    this.volunteerRows().length + this.archivedVolunteerRows().length
  );

  readonly departmentCount = computed(() => {
    const departments = new Set(this.volunteerRows().map((v) => v.department));
    return departments.size;
  });

  readonly filteredVolunteers = computed(() => {
    const search = this.volunteerSearchQuery().toLowerCase().trim();
    const volunteers = this.showArchivedVolunteers()
      ? this.archivedVolunteerRows()
      : this.volunteerRows();

    if (!search) {
      return volunteers;
    }

    return volunteers.filter(
      (v) =>
        v.name.toLowerCase().includes(search) ||
        v.email.toLowerCase().includes(search) ||
        (v.facebookName && v.facebookName.toLowerCase().includes(search)) ||
        v.department.toLowerCase().includes(search),
    );
  });

  readonly volunteersTotalPages = computed(() =>
    Math.ceil(this.filteredVolunteers().length / this.volunteersPerPage()),
  );

  readonly paginatedVolunteers = computed(() => {
    const filtered = this.filteredVolunteers();
    const page = this.volunteersPage();
    const perPage = this.volunteersPerPage();
    const start = (page - 1) * perPage;
    const end = start + perPage;
    return filtered.slice(start, end);
  });

  readonly Math = Math;

  ngOnInit(): void {
    this.loadVolunteers();
    this.loadArchivedVolunteers();
  }

  constructor() {
    effect(() => {
      this.volunteerSearchQuery();
      untracked(() => {
        this.volunteersPage.set(1);
      });
    });
  }

  private loadVolunteers(): void {
    this.isLoading.set(true);
    this.adminDashboardService
      .getVolunteers()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (response: VolunteersResponse) => {
          if (response.success && response.data) {
            const rows: DashboardVolunteerRow[] = response.data.map((v) => ({
              id: v.volunteer_id,
              name: v.full_name,
              email: v.email,
              phone: v.mobile_number,
              facebookName: v.facebook_name,
              department: v.positions && v.positions.length > 0
                ? v.positions.join(', ')
                : 'Unassigned',
              status: 'active',
              joined_date: v.created_at,
            }));
            this.volunteerRows.set(rows);
          }
          this.isLoading.set(false);
        },
        error: (error: Error) => {
          console.error('Error loading volunteers:', error);
          this.showSnackbar.emit({ message: 'Failed to load volunteers', type: 'error' });
          this.isLoading.set(false);
        },
      });
  }

  private loadArchivedVolunteers(): void {
    this.adminDashboardService
      .getArchivedVolunteers()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (response: VolunteersResponse) => {
          if (response.success && response.data) {
            const rows: DashboardVolunteerRow[] = response.data.map((v) => ({
              id: v.volunteer_id,
              name: v.full_name,
              email: v.email,
              phone: v.mobile_number,
              facebookName: v.facebook_name,
              department: v.positions && v.positions.length > 0
                ? v.positions.join(', ')
                : 'Unassigned',
              status: 'inactive',
              joined_date: v.created_at,
            }));
            this.archivedVolunteerRows.set(rows);
          }
        },
        error: (error: Error) => {
          console.error('Error loading archived volunteers:', error);
          this.showSnackbar.emit({ message: 'Failed to load archived volunteers', type: 'error' });
        },
      });
  }

  // Search removed, handled by global search effect

  // Tab switching
  switchToActiveVolunteers(): void {
    this.showArchivedVolunteers.set(false);
    this.volunteersPage.set(1);
  }

  switchToArchivedVolunteers(): void {
    this.showArchivedVolunteers.set(true);
    this.volunteersPage.set(1);
  }

  // Pagination
  goToVolunteersPage(page: number): void {
    const totalPages = this.volunteersTotalPages();
    if (page >= 1 && page <= totalPages) {
      this.volunteersPage.set(page);
    }
  }

  nextVolunteersPage(): void {
    const totalPages = this.volunteersTotalPages();
    if (this.volunteersPage() < totalPages) {
      this.volunteersPage.update((page) => page + 1);
    }
  }

  previousVolunteersPage(): void {
    if (this.volunteersPage() > 1) {
      this.volunteersPage.update((page) => page - 1);
    }
  }

  getVolunteersPageNumbers(): number[] {
    const total = this.volunteersTotalPages();
    const current = this.volunteersPage();
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

  // Actions
  openEditVolunteerModal(volunteer: DashboardVolunteerRow): void {
    this.editingVolunteer.set(volunteer);
    this.showEditSuccess.set(false);
    this.editFormErrors.set({});
    const nameParts = volunteer.name.split(' ', 2);
    this.editFormData.set({
      first_name: nameParts[0] || '',
      last_name: nameParts[1] || '',
      email: volunteer.email,
      mobile_number: volunteer.phone,
      facebook_name: volunteer.facebookName || '',
    });
    this.showEditModal.set(true);
  }

  closeEditModal(): void {
    this.showEditModal.set(false);
    this.editingVolunteer.set(null);
    this.showEditSuccess.set(false);
    this.editFormErrors.set({});
    this.editFormData.set({
      first_name: '',
      last_name: '',
      email: '',
      mobile_number: '',
      facebook_name: '',
    });
  }

  updateEditForm(field: 'first_name' | 'last_name' | 'email' | 'mobile_number' | 'facebook_name', value: string): void {
    this.editFormData.update((current) => ({ ...current, [field]: value }));
    this.editFormErrors.update((current) => {
      if (current[field]) {
        const next = { ...current };
        delete next[field];
        return next;
      }
      return current;
    });
  }

  saveVolunteer(): void {
    const volunteer = this.editingVolunteer();
    if (!volunteer) return;

    const formData = this.editFormData();

    this.isSaving.set(true);
    this.adminDashboardService.updateVolunteer(volunteer.id, formData)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          this.loadVolunteers();
          this.loadArchivedVolunteers();
          this.showEditSuccess.set(true);
          this.isSaving.set(false);
        },
        error: (error: any) => {
          console.error('Error updating volunteer:', error);
          this.editFormErrors.set({});
          if (error?.error?.errors) {
            const errs: Record<string, string> = {};
            for (const [field, messages] of Object.entries(error.error.errors)) {
              errs[field] = (messages as string[]).join(' ');
            }
            this.editFormErrors.set(errs);
            this.showSnackbar.emit({ message: 'Please fix the errors below', type: 'error' });
          } else {
            const msg = error?.error?.message || 'Failed to update volunteer';
            this.showSnackbar.emit({ message: msg, type: 'error' });
          }
          this.isSaving.set(false);
        },
      });
  }

  confirmDeleteVolunteer(id: number): void {
    this.deletingVolunteerId.set(id);
    this.showDeleteModal.set(true);
  }

  closeDeleteModal(): void {
    this.showDeleteModal.set(false);
    this.deletingVolunteerId.set(null);
  }

  confirmRestoreVolunteer(id: number): void {
    this.restoringVolunteerId.set(id);
    this.showRestoreModal.set(true);
  }

  closeRestoreModal(): void {
    this.showRestoreModal.set(false);
    this.restoringVolunteerId.set(null);
  }

  openViewModal(volunteer: DashboardVolunteerRow): void {
    this.viewingVolunteer.set(volunteer);
    this.showViewModal.set(true);
  }

  closeViewModal(): void {
    this.showViewModal.set(false);
    this.viewingVolunteer.set(null);
  }

  archiveVolunteer(): void {
    const id = this.deletingVolunteerId();
    if (id === null) return;

    this.isSaving.set(true);
    this.adminDashboardService.softDeleteVolunteer(id)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          this.loadVolunteers();
          this.loadArchivedVolunteers();
          this.showSnackbar.emit({ message: 'Volunteer archived successfully', type: 'success' });
          this.isSaving.set(false);
          this.closeDeleteModal();
        },
        error: (error: Error) => {
          console.error('Error archiving volunteer:', error);
          this.showSnackbar.emit({ message: 'Failed to archive volunteer', type: 'error' });
          this.isSaving.set(false);
          this.closeDeleteModal();
        },
      });
  }

  restoreVolunteer(): void {
    const id = this.restoringVolunteerId();
    if (id === null) return;

    this.isSaving.set(true);
    this.adminDashboardService.restoreVolunteer(id)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          this.loadVolunteers();
          this.loadArchivedVolunteers();
          this.showSnackbar.emit({ message: 'Volunteer restored successfully', type: 'success' });
          this.isSaving.set(false);
          this.closeRestoreModal();
        },
        error: (error: Error) => {
          console.error('Error restoring volunteer:', error);
          this.showSnackbar.emit({ message: 'Failed to restore volunteer', type: 'error' });
          this.isSaving.set(false);
          this.closeRestoreModal();
        },
      });
  }
}
