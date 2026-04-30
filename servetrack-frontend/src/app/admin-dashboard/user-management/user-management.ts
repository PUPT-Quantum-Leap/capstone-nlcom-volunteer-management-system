import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  computed,
  inject,
  signal,
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

  readonly Math = Math;
  readonly isLoading = signal(false);
  readonly users = signal<User[]>([]);
  readonly userSearchQuery = signal('');
  readonly userRoleFilter = signal('');
  readonly currentPage = signal(1);
  readonly usersPerPage = signal(5);
  readonly showDeleteUserModal = signal(false);
  readonly deletingUserId = signal<number | null>(null);

  readonly filteredUsers = computed(() => {
    let filtered = this.users().filter((user) => !user.deleted_at);

    const role = this.userRoleFilter();
    const search = this.userSearchQuery().toLowerCase().trim();

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

  constructor() {
    this.loadUsers();
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
          this.closeDeleteUserModal();
        },
        error: (error: Error) => {
          console.error('Error archiving user:', error);
          this.closeDeleteUserModal();
        },
      });
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
}
