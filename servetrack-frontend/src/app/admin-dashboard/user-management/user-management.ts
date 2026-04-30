import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  computed,
  inject,
  signal,
  output,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { User } from '../../models/user';
import { UserService } from '../../services/user.service';

@Component({
  selector: 'app-user-management',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule],
  templateUrl: './user-management.html',
  styleUrl: './user-management.scss',
})
export class UserManagementComponent {
  private readonly userService = inject(UserService);
  private readonly destroyRef = inject(DestroyRef);

  // Outputs
  showSnackbar = output<{ message: string; type: 'success' | 'error' | 'info' }>();

  readonly Math = Math;
  readonly currentDate = new Date();
  readonly isLoading = signal(false);
  readonly users = signal<User[]>([]);
  readonly archivedUsers = signal<User[]>([]);
  readonly showArchivedUsers = signal(false);
  readonly userSearchQuery = signal('');
  readonly userRoleFilter = signal('');
  readonly currentPage = signal(1);
  readonly usersPerPage = signal(5);
  readonly showDeleteUserModal = signal(false);
  readonly deletingUserId = signal<number | null>(null);
  readonly viewingUser = signal<User | null>(null);
  readonly showViewUserModal = signal(false);
  readonly editingUser = signal<User | null>(null);
  readonly showEditUserModal = signal(false);
  readonly editFormData = signal<{ name: string; email: string; role: string }>({ name: '', email: '', role: '' });

  readonly filteredUsers = computed(() => {
    const search = this.userSearchQuery().toLowerCase().trim();
    const users = this.showArchivedUsers()
      ? this.archivedUsers()
      : this.users().filter((user) => !user.deleted_at);

    let filtered = users;

    const role = this.userRoleFilter();
    if (role) {
      filtered = filtered.filter((user) => user.role === role);
    }

    if (search) {
      filtered = filtered.filter(
        (user) =>
          user.name.toLowerCase().includes(search) || user.email.toLowerCase().includes(search),
      );
    }

    return filtered;
  });

  readonly usersTotalPages = computed(() =>
    Math.max(1, Math.ceil(this.filteredUsers().length / this.usersPerPage())),
  );

  readonly paginatedUsers = computed(() => {
    const start = (this.currentPage() - 1) * this.usersPerPage();
    return this.filteredUsers().slice(start, start + this.usersPerPage());
  });

  readonly activeUsersCount = computed(() =>
    this.users().filter((user) => !user.deleted_at).length,
  );

  readonly adminCount = computed(() =>
    this.users().filter((user) => user.role === 'admin' && !user.deleted_at).length,
  );

  readonly coordinatorCount = computed(() =>
    this.users().filter((user) => user.role === 'coordinator' && !user.deleted_at).length,
  );

  readonly volunteerCount = computed(() =>
    this.users().filter((user) => user.role === 'volunteer' && !user.deleted_at).length,
  );

  constructor() {
    this.loadUsers();
    this.loadArchivedUsers();
  }

  formatRole(role: string): string {
    return role.charAt(0).toUpperCase() + role.slice(1);
  }

  openCreateUserModal(): void {
    this.editingUser.set(null);
    this.editFormData.set({ name: '', email: '', role: 'volunteer' });
    this.showEditUserModal.set(true);
  }

  // Tab switching
  switchToActiveUsers(): void {
    this.showArchivedUsers.set(false);
    this.currentPage.set(1);
  }

  switchToArchivedUsers(): void {
    this.showArchivedUsers.set(true);
    this.currentPage.set(1);
  }

  setUserSearchQuery(query: string): void {
    this.userSearchQuery.set(query);
    this.currentPage.set(1);
  }

  setUserRoleFilter(role: string): void {
    this.userRoleFilter.set(role);
    this.currentPage.set(1);
  }

  goToPage(page: number): void {
    if (page >= 1 && page <= this.usersTotalPages()) {
      this.currentPage.set(page);
    }
  }

  nextPage(): void {
    if (this.currentPage() < this.usersTotalPages()) {
      this.currentPage.update((page) => page + 1);
    }
  }

  previousPage(): void {
    if (this.currentPage() > 1) {
      this.currentPage.update((page) => page - 1);
    }
  }

  getPageNumbers(): number[] {
    const total = this.usersTotalPages();
    const current = this.currentPage();
    const pages: number[] = [];

    if (total <= 7) {
      for (let page = 1; page <= total; page += 1) {
        pages.push(page);
      }
    } else if (current <= 3) {
      pages.push(1, 2, 3, 4, -1, total);
    } else if (current >= total - 2) {
      pages.push(1, -1, total - 3, total - 2, total - 1, total);
    } else {
      pages.push(1, -1, current - 1, current, current + 1, -1, total);
    }

    return pages;
  }

  confirmDeleteUser(userId: number): void {
    this.deletingUserId.set(userId);
    this.showDeleteUserModal.set(true);
  }

  closeDeleteUserModal(): void {
    this.showDeleteUserModal.set(false);
    this.deletingUserId.set(null);
  }

  deleteUser(): void {
    const userId = this.deletingUserId();

    if (userId === null) {
      return;
    }

    this.userService
      .softDeleteUser(userId)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          this.users.update((items) => items.filter((user) => user.id !== userId));
          this.loadArchivedUsers();
          this.showSnackbar.emit({ message: 'User archived successfully', type: 'success' });
          this.closeDeleteUserModal();
        },
        error: (error: Error) => {
          console.error('Error archiving user:', error);
          this.showSnackbar.emit({ message: 'Failed to archive user', type: 'error' });
          this.closeDeleteUserModal();
        },
      });
  }

  restoreUser(id: number): void {
    this.userService.restoreUser(id)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          this.loadUsers();
          this.loadArchivedUsers();
          this.showSnackbar.emit({ message: 'User restored successfully', type: 'success' });
        },
        error: (error: Error) => {
          console.error('Error restoring user:', error);
          this.showSnackbar.emit({ message: 'Failed to restore user', type: 'error' });
        },
      });
  }

  openEditUserModal(user: User): void {
    this.editingUser.set(user);
    this.editFormData.set({
      name: user.name,
      email: user.email,
      role: user.role,
    });
    this.showEditUserModal.set(true);
  }

  closeEditUserModal(): void {
    this.showEditUserModal.set(false);
    this.editingUser.set(null);
    this.editFormData.set({ name: '', email: '', role: '' });
  }

  updateEditForm(field: 'name' | 'email' | 'role', value: string): void {
    this.editFormData.update((current) => ({ ...current, [field]: value }));
  }

  saveUser(): void {
    const user = this.editingUser();
    if (!user) return;

    const formData = this.editFormData();

    const updateData: Partial<User> = {
      name: formData.name,
      email: formData.email,
      role: formData.role as 'admin' | 'coordinator' | 'volunteer',
    };

    this.userService.updateUser(user.id, updateData)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          this.loadUsers();
          this.showSnackbar.emit({ message: 'User updated successfully', type: 'success' });
          this.closeEditUserModal();
        },
        error: (error: Error) => {
          console.error('Error updating user:', error);
          this.showSnackbar.emit({ message: 'Failed to update user', type: 'error' });
        },
      });
  }

  openViewUserModal(user: User): void {
    this.viewingUser.set(user);
    this.showViewUserModal.set(true);
  }

  closeViewUserModal(): void {
    this.showViewUserModal.set(false);
    this.viewingUser.set(null);
  }

  private loadUsers(): void {
    this.isLoading.set(true);

    this.userService
      .getUsers()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (response) => {
          this.users.set(response.data ?? []);
          this.isLoading.set(false);
        },
        error: (error: Error) => {
          console.error('Error loading users:', error);
          this.users.set([]);
          this.isLoading.set(false);
        },
      });
  }

  private loadArchivedUsers(): void {
    this.userService
      .getArchivedUsers()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (response) => {
          this.archivedUsers.set(response.data ?? []);
        },
        error: (error: Error) => {
          console.error('Error loading archived users:', error);
          this.archivedUsers.set([]);
        },
      });
  }
}
