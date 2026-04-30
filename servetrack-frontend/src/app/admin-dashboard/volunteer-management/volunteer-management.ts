import {
  ChangeDetectionStrategy,
  Component,
  OnInit,
  computed,
  inject,
  signal,
  DestroyRef,
  output,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import {
  AdminDashboardService,
  ApiResponse,
  DashboardVolunteerRow,
  VolunteerUser,
  VolunteersResponse,
} from '../../services/admin-dashboard.service';

@Component({
  selector: 'app-volunteer-management',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule],
  templateUrl: './volunteer-management.html',
  styleUrl: './volunteer-management.scss',
})
export class VolunteerManagement implements OnInit {
  private adminDashboardService = inject(AdminDashboardService);
  private destroyRef = inject(DestroyRef);

  // Outputs
  showSnackbar = output<{ message: string; type: 'success' | 'error' | 'info' }>();

  // Signals
  isLoading = signal(false);
  volunteerRows = signal<DashboardVolunteerRow[]>([]);
  archivedVolunteerRows = signal<DashboardVolunteerRow[]>([]);
  showArchivedVolunteers = signal(false);
  volunteerSearchQuery = signal('');
  volunteersPage = signal(1);
  volunteersPerPage = signal(5);
  deletingVolunteerId = signal<number | null>(null);
  editingVolunteer = signal<DashboardVolunteerRow | null>(null);
  showEditModal = signal(false);
  showDeleteModal = signal(false);

  // Computed
  filteredVolunteers = computed(() => {
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

  volunteersTotalPages = computed(() =>
    Math.ceil(this.filteredVolunteers().length / this.volunteersPerPage()),
  );

  paginatedVolunteers = computed(() => {
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
              department: 'Unassigned',
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
              department: 'Unassigned',
              status: 'inactive',
              joined_date: v.created_at,
            }));
            this.archivedVolunteerRows.set(rows);
          }
        },
        error: (error: Error) => {
          console.error('Error loading archived volunteers:', error);
        },
      });
  }

  // Search
  setVolunteerSearchQuery(query: string): void {
    this.volunteerSearchQuery.set(query);
    this.volunteersPage.set(1);
  }

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
    this.showEditModal.set(true);
  }

  closeEditModal(): void {
    this.showEditModal.set(false);
    this.editingVolunteer.set(null);
  }

  confirmDeleteVolunteer(id: number): void {
    this.deletingVolunteerId.set(id);
    this.showDeleteModal.set(true);
  }

  closeDeleteModal(): void {
    this.showDeleteModal.set(false);
    this.deletingVolunteerId.set(null);
  }

  archiveVolunteer(): void {
    const id = this.deletingVolunteerId();
    if (id === null) return;

    this.adminDashboardService.softDeleteVolunteer(id).subscribe({
      next: (response: ApiResponse<void>) => {
        if (response.success) {
          this.loadVolunteers();
          this.loadArchivedVolunteers();
          this.showSnackbar.emit({ message: 'Volunteer archived successfully', type: 'success' });
        } else {
          this.showSnackbar.emit({ message: response.message || 'Failed to archive volunteer', type: 'error' });
        }
        this.closeDeleteModal();
      },
      error: (error: Error) => {
        console.error('Error archiving volunteer:', error);
        this.showSnackbar.emit({ message: 'Failed to archive volunteer', type: 'error' });
        this.closeDeleteModal();
      },
    });
  }

  restoreVolunteer(id: number): void {
    this.adminDashboardService.restoreVolunteer(id).subscribe({
      next: (response: ApiResponse<void>) => {
        if (response.success) {
          this.loadVolunteers();
          this.loadArchivedVolunteers();
          this.showSnackbar.emit({ message: 'Volunteer restored successfully', type: 'success' });
        } else {
          this.showSnackbar.emit({ message: response.message || 'Failed to restore volunteer', type: 'error' });
        }
      },
      error: (error: Error) => {
        console.error('Error restoring volunteer:', error);
        this.showSnackbar.emit({ message: 'Failed to restore volunteer', type: 'error' });
      },
    });
  }
}
