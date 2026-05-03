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
import { InviteService } from '../../services/invite.service';

@Component({
  selector: 'app-user-management',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule],
  templateUrl: './user-management.html',
  styleUrl: './user-management.scss',
})
export class UserManagementComponent {
  private readonly userService = inject(UserService);
  private readonly inviteService = inject(InviteService);
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
  readonly inviteMode = signal<'link'>('link');
  readonly inviteLink = signal('');
  readonly assignedInviteRole = signal<string>('volunteer');
  readonly isCreatingInvite = signal(false);
  readonly showInviteSuccess = signal(false);
  readonly showInviteError = signal(false);
  readonly inviteError = signal<string | null>(null);
  readonly linkCopied = signal(false);
  readonly copyingInviteLink = signal(false);

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
    this.inviteMode.set('link');
    this.inviteLink.set('');
    this.assignedInviteRole.set('volunteer');
    this.showInviteSuccess.set(false);
    this.showInviteError.set(false);
    this.inviteError.set(null);
    this.linkCopied.set(false);
    this.copyingInviteLink.set(false);
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
    this.inviteMode.set('link');
    this.inviteLink.set('');
    this.assignedInviteRole.set('volunteer');
    this.showInviteSuccess.set(false);
    this.showInviteError.set(false);
    this.inviteError.set(null);
    this.linkCopied.set(false);
    this.copyingInviteLink.set(false);
  }

  selectInviteLinkText(element: EventTarget | null): void {
    if (!(element instanceof HTMLElement)) return;
    
    const selection = window.getSelection();
    const range = document.createRange();
    range.selectNodeContents(element);
    selection?.removeAllRanges();
    selection?.addRange(range);
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

  createInvite(): void {
    const formData = this.editFormData();

    this.isCreatingInvite.set(true);

    this.inviteService.createInvite(null, formData.role, false)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (response) => {
          this.inviteLink.set(response.data.invite_link);
          this.assignedInviteRole.set(formData.role);
          this.linkCopied.set(false);
          this.isCreatingInvite.set(false);
          this.showInviteSuccess.set(true);
          this.showEditUserModal.set(false);
          this.showSnackbar.emit({ message: 'Invite created successfully', type: 'success' });
        },
        error: (error: any) => {
          console.error('Error creating invite:', error);
          const errorMessage = error.error?.message || error.error?.error || 'Failed to create invite. Please check your Supabase configuration or try again later.';
          this.inviteError.set(errorMessage);
          this.isCreatingInvite.set(false);
          this.showInviteError.set(true);
          this.showEditUserModal.set(false);
        },
      });
  }

  copyInviteLink(): void {
    if (this.copyingInviteLink()) return; // Prevent multiple rapid clicks
    
    this.copyingInviteLink.set(true);
    navigator.clipboard.writeText(this.inviteLink()).then(() => {
      this.linkCopied.set(true);
      this.showSnackbar.emit({ message: 'Invite link copied to clipboard', type: 'success' });
      
      // Reset the copied state after 3 seconds
      setTimeout(() => {
        this.linkCopied.set(false);
        this.copyingInviteLink.set(false);
      }, 3000);
    }).catch(() => {
      this.copyingInviteLink.set(false);
      this.showSnackbar.emit({ message: 'Failed to copy link', type: 'error' });
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
